import {
  denied,
  eligible,
  licenseSchema,
  type Feature,
  type LicenseAction,
  type LicenseProvider,
  type LicenseState,
} from './model';
export class LicenseService {
  private state: LicenseState = denied();
  private checkedAt = -Infinity;
  private busy = false;
  private timer?: ReturnType<typeof setInterval>;
  private nextRefresh = 0;
  changed: () => void = () => {};
  constructor(
    private provider: LicenseProvider,
    private monotonic = () => performance.now(),
  ) {}
  snapshot(): LicenseState {
    if (eligible(this.state) && this.monotonic() - this.checkedAt <= 120000)
      return structuredClone(this.state);
    if (this.state.features.length)
      return {
        ...this.state,
        status:
          this.state.trialExpiresAt && this.state.trialExpiresAt <= Date.now()
            ? 'TRIAL_EXPIRED'
            : this.state.expiresAt && this.state.expiresAt <= Date.now()
              ? 'LICENSE_EXPIRED'
              : 'VALIDATION_ERROR',
        issue: 'validation',
        features: [],
      };
    return structuredClone(this.state);
  }
  allows(feature: Feature) {
    const s = this.snapshot();
    return eligible(s) && s.features.includes(feature);
  }
  require(feature: Feature) {
    if (!this.allows(feature)) throw new Error('License entitlement required');
  }
  async run(action: LicenseAction, key?: string) {
    if (this.busy) return { ...this.snapshot(), issue: 'busy' as const };
    this.busy = true;
    try {
      this.state = licenseSchema.parse(await this.provider.run(action, key));
      this.checkedAt = this.monotonic();
    } catch {
      this.state = denied('unavailable');
    } finally {
      this.busy = false;
      // A failed observer (for example unavailable history storage) must not turn
      // a licensing event into an unhandled rejection that terminates playout.
      try {
        this.changed();
      } catch {
        /* Authority is already updated; output remains independent. */
      }
    }
    return this.snapshot();
  }
  async start() {
    await this.run('check');
    this.nextRefresh = this.monotonic() + 3600000;
    void this.run('refresh');
    this.timer = setInterval(() => {
      const refresh = this.monotonic() >= this.nextRefresh;
      if (refresh) this.nextRefresh = this.monotonic() + 3600000;
      void this.run(refresh ? 'refresh' : 'check');
    }, 10000);
    this.timer.unref();
  }
  close() {
    clearInterval(this.timer);
    this.provider.close();
  }
}
export function licenseDiagnostics(s: LicenseState) {
  return {
    status: s.status,
    edition: s.edition,
    configured: s.configured,
    provider: s.provider,
    sdkVersion: s.sdkVersion,
    issue: s.issue,
    expiresAt: s.expiresAt,
    trialExpiresAt: s.trialExpiresAt,
    offlineGraceUntil: s.offlineGraceUntil,
    lastValidatedAt: s.lastValidatedAt,
    features: [...s.features],
  };
}
