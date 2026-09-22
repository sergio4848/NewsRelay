import {
  denied,
  featureIds,
  type LicenseProvider,
  type LicenseAction,
  type LicenseState,
} from '../../src/licensing/model';
export class MockLicenseProvider implements LicenseProvider {
  calls: LicenseAction[] = [];
  state: LicenseState = {
    ...denied(),
    status: 'TRIAL_AVAILABLE',
    configured: true,
    provider: 'test',
  };
  trialExpiry?: number;
  async run(action: LicenseAction, key?: string) {
    this.calls.push(action);
    if (action === 'trial' && this.state.status === 'TRIAL_AVAILABLE') {
      this.trialExpiry ??= Date.now() + 7 * 86400000;
      this.state = {
        ...this.state,
        status: 'TRIAL_ACTIVE',
        edition: 'Evaluation',
        features: [...featureIds],
        trialExpiresAt: this.trialExpiry,
        validUntil: this.trialExpiry,
        activationId: 'fixture-license-trial',
        activationCount: 1,
        activationLimit: 1,
      };
    }
    if (action === 'activate') {
      if (key === 'fixture-limit')
        this.state = {
          ...this.state,
          status: 'ACTIVATION_LIMIT_REACHED',
          features: [],
          issue: 'activationLimit',
        };
      else if (key === 'fixture-professional' || key === 'fixture-enterprise')
        this.state = {
          ...this.state,
          issue: undefined,
          status: 'LICENSE_ACTIVE',
          edition: key === 'fixture-enterprise' ? 'Enterprise' : 'Professional',
          features: [...featureIds],
          validUntil: Date.now() + 7 * 86400000,
          expiresAt: Date.now() + 14 * 86400000,
          offlineGraceUntil: Date.now() + 7 * 86400000,
          lastValidatedAt: Date.now(),
          activationId: 'fixture-license-paid',
          activationCount: 1,
          activationLimit: 2,
        };
      else return { ...this.state, issue: 'invalidKey' as const };
    }
    if (action === 'deactivate')
      this.state = { ...denied(), status: 'TRIAL_AVAILABLE', configured: true, provider: 'test' };
    if (this.state.validUntil && this.state.validUntil <= Date.now())
      this.state = {
        ...this.state,
        status: this.state.edition === 'Evaluation' ? 'TRIAL_EXPIRED' : 'LICENSE_EXPIRED',
        features: [],
      };
    return structuredClone(this.state);
  }
  close() {}
}
