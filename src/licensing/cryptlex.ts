import {
  LexActivator as sdk,
  LexActivatorException,
  LexStatusCodes as codes,
  PermissionFlags,
} from '@cryptlex/lexactivator';
import {
  denied,
  eligible,
  featureIds,
  type LicenseAction,
  type LicenseProvider,
  type LicenseState,
} from './model';
export type ProductConfig = { productId: string; productData: string };
// Narrow facade permits deterministic adapter tests without replacing the production provider.
export type CryptlexSDK = Pick<
  typeof sdk,
  | 'SetProductData'
  | 'SetProductId'
  | 'SetLicenseKey'
  | 'IsLicenseGenuine'
  | 'IsTrialGenuine'
  | 'GetLastActivationError'
  | 'GetLicenseType'
  | 'GetLicenseMetadata'
  | 'GetLicenseExpiryDate'
  | 'GetServerSyncGracePeriodExpiryDate'
  | 'GetActivationLastSyncedDate'
  | 'GetActivationId'
  | 'GetLicenseTotalActivations'
  | 'GetLicenseAllowedActivations'
  | 'GetFeatureEntitlements'
  | 'GetTrialExpiryDate'
  | 'GetTrialId'
  | 'ActivateLicense'
  | 'ActivateTrial'
  | 'SyncLicenseActivation'
  | 'SyncTrialActivation'
  | 'DeactivateLicense'
>;
function codeOf(error: unknown): number {
  return error instanceof LexActivatorException ? error.code : -999;
}
function invoke(fn: () => number) {
  try {
    return fn();
  } catch (error) {
    return codeOf(error);
  }
}
function optional<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
const date = (value: number) => (value > 0 ? value * 1000 : undefined);
export function mapStatus(code: number): Pick<LicenseState, 'status' | 'issue'> {
  if (code === codes.LA_EXPIRED) return { status: 'LICENSE_EXPIRED' };
  if (code === codes.LA_TRIAL_EXPIRED) return { status: 'TRIAL_EXPIRED' };
  if (code === codes.LA_SUSPENDED) return { status: 'LICENSE_SUSPENDED' };
  if ([codes.LA_E_REVOKED, codes.LA_E_ACTIVATION_NOT_FOUND].includes(code))
    return { status: 'LICENSE_REVOKED' };
  if ([codes.LA_E_ACTIVATION_LIMIT, codes.LA_E_TRIAL_ACTIVATION_LIMIT].includes(code))
    return { status: 'ACTIVATION_LIMIT_REACHED', issue: 'activationLimit' };
  const issue = [
    codes.LA_E_INET,
    codes.LA_E_SERVER,
    codes.LA_E_RATE_LIMIT,
    codes.LA_E_NET_PROXY,
  ].includes(code)
    ? 'network'
    : [codes.LA_E_TIME, codes.LA_E_TIME_MODIFIED].includes(code)
      ? 'clock'
      : code === codes.LA_E_LICENSE_KEY
        ? 'invalidKey'
        : code === codes.LA_E_DEACTIVATION_LIMIT
          ? 'deactivation'
          : 'validation';
  return { status: 'VALIDATION_ERROR', issue };
}
export class CryptlexLicenseProvider implements LicenseProvider {
  private ready = false;
  private offline = false;
  constructor(
    config: ProductConfig,
    private api: CryptlexSDK = sdk,
  ) {
    if (!config.productId || !config.productData) return;
    try {
      api.SetProductData(config.productData);
      api.SetProductId(config.productId, PermissionFlags.LA_USER);
      this.ready = true;
    } catch {
      /* normalized, no raw SDK payload */
    }
  }
  private invalid(code: number): LicenseState {
    const state: LicenseState = { ...denied(), configured: true, ...mapStatus(code) };
    if (code === codes.LA_TRIAL_EXPIRED) {
      state.edition = 'Evaluation';
      state.trialExpiresAt = optional(() => date(this.api.GetTrialExpiryDate()));
      state.activationId = optional(() => this.api.GetTrialId());
    } else if ([codes.LA_EXPIRED, codes.LA_SUSPENDED, codes.LA_GRACE_PERIOD_OVER].includes(code)) {
      const edition = optional(() => this.api.GetLicenseMetadata('newsrelay.edition'));
      state.edition = edition === 'Professional' || edition === 'Enterprise' ? edition : null;
      state.expiresAt = optional(() => date(this.api.GetLicenseExpiryDate()));
      state.offlineGraceUntil = optional(() => date(this.api.GetServerSyncGracePeriodExpiryDate()));
      state.lastValidatedAt = optional(() => date(this.api.GetActivationLastSyncedDate()));
      state.activationId = optional(() => this.api.GetActivationId());
      state.activationCount = optional(() => this.api.GetLicenseTotalActivations());
      state.activationLimit = optional(() => this.api.GetLicenseAllowedActivations());
    }
    return state;
  }
  private check(): LicenseState {
    if (!this.ready) return denied('configuration');
    const paid = invoke(() => this.api.IsLicenseGenuine());
    if (paid === codes.LA_OK) {
      try {
        const edition = this.api.GetLicenseMetadata('newsrelay.edition');
        if (
          this.api.GetLicenseType() !== 'node-locked' ||
          !['Professional', 'Enterprise'].includes(edition)
        )
          return { ...denied('policy'), configured: true };
        const expiresAt = date(this.api.GetLicenseExpiryDate());
        const offlineGraceUntil = date(this.api.GetServerSyncGracePeriodExpiryDate());
        // Unlimited grace is deliberately not accepted for this commercial product.
        if (!offlineGraceUntil) return { ...denied('policy'), configured: true };
        const entitlements = this.api.GetFeatureEntitlements();
        const features = featureIds.filter((id) =>
          entitlements.some(
            (e) =>
              e.featureName === id &&
              e.value === 'true' &&
              (!e.expiresAt || e.expiresAt * 1000 > Date.now()),
          ),
        );
        const featureExpiry = entitlements
          .filter(
            (e) =>
              features.includes(e.featureName as (typeof featureIds)[number]) && e.expiresAt > 0,
          )
          .map((e) => e.expiresAt * 1000);
        const validUntil = Math.min(expiresAt || Infinity, offlineGraceUntil, ...featureExpiry);
        if (validUntil <= Date.now()) return { ...denied('validation'), configured: true };
        return {
          status: this.offline
            ? 'OFFLINE_GRACE'
            : expiresAt && expiresAt - Date.now() <= 30 * 86400000
              ? 'EXPIRING_SOON'
              : 'LICENSE_ACTIVE',
          edition: edition as 'Professional' | 'Enterprise',
          features,
          expiresAt,
          offlineGraceUntil,
          validUntil,
          lastValidatedAt: date(this.api.GetActivationLastSyncedDate()),
          activationId: this.api.GetActivationId(),
          activationCount: this.api.GetLicenseTotalActivations(),
          activationLimit: this.api.GetLicenseAllowedActivations(),
          configured: true,
          provider: 'cryptlex',
          issue: this.offline ? 'network' : undefined,
        };
      } catch {
        return { ...denied('policy'), configured: true };
      }
    }
    if (paid !== codes.LA_FAIL) return this.invalid(paid);
    const lastError = optional(() => this.api.GetLastActivationError());
    if (lastError && lastError !== codes.LA_OK && lastError !== codes.LA_FAIL)
      return this.invalid(lastError);
    const trial = invoke(() => this.api.IsTrialGenuine());
    if (trial === codes.LA_FAIL)
      return { ...denied(), status: 'TRIAL_AVAILABLE', configured: true };
    if (trial !== codes.LA_OK) return this.invalid(trial);
    const expiry = optional(() => date(this.api.GetTrialExpiryDate()));
    if (!expiry || expiry <= Date.now()) return this.invalid(codes.LA_TRIAL_EXPIRED);
    return {
      status: 'TRIAL_ACTIVE',
      edition: 'Evaluation',
      features: [...featureIds],
      trialExpiresAt: expiry,
      validUntil: expiry,
      activationLimit: 1,
      activationCount: 1,
      activationId: optional(() => this.api.GetTrialId()),
      configured: true,
      provider: 'cryptlex',
      issue: this.offline ? 'network' : undefined,
    };
  }
  async run(action: LicenseAction, key?: string): Promise<LicenseState> {
    if (!this.ready) return denied('configuration');
    const before = this.check();
    if (action === 'check') return before;
    if (action === 'trial' && before.status !== 'TRIAL_AVAILABLE') return before;
    if (action === 'activate' && eligible(before) && before.edition !== 'Evaluation')
      return { ...before, issue: 'policy' };
    if (action === 'refresh' && !before.edition && before.status === 'TRIAL_AVAILABLE')
      return before;
    let code: number;
    try {
      if (action === 'activate') {
        if (!key) return { ...before, issue: 'invalidKey' };
        this.api.SetLicenseKey(key);
        code = this.api.ActivateLicense();
      } else if (action === 'trial') code = this.api.ActivateTrial();
      else if (action === 'deactivate') code = this.api.DeactivateLicense();
      else
        code =
          before.edition === 'Evaluation' || before.status === 'TRIAL_EXPIRED'
            ? this.api.SyncTrialActivation()
            : this.api.SyncLicenseActivation();
    } catch (error) {
      code = codeOf(error);
    }
    this.offline = mapStatus(code).issue === 'network';
    const after = this.check();
    if (code === codes.LA_OK) {
      this.offline = false;
      return after;
    }
    // Network failure grants nothing: independently recheck SDK signed local state.
    if (eligible(after) && (this.offline || action === 'deactivate' || action === 'activate'))
      return { ...after, issue: mapStatus(code).issue || 'validation' };
    return { ...after, ...mapStatus(code), features: [] };
  }
  close() {
    /* SDK state belongs to OS user; never Reset on exit/uninstall. */
  }
}
