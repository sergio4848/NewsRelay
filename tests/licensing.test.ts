import { it, expect, vi, afterEach } from 'vitest';
import { LexStatusCodes as C, LexActivatorException } from '@cryptlex/lexactivator';
import { CryptlexLicenseProvider, type CryptlexSDK } from '../src/licensing/cryptlex';
import { LicenseService, licenseDiagnostics } from '../src/licensing/service';
import {
  denied,
  eligible,
  featureIds,
  licenseSchema,
  type LicenseState,
} from '../src/licensing/model';
import { MockLicenseProvider } from './fixtures/mock-license';
import { redact } from '../src/core/redact';
it('redacts license key fields and explicit secrets from diagnostic text', () => {
  const text = redact(
    'license_key="fixture-confidential-key" LICENSE_KEY: fixture-hidden-key licenseKey=fixture-private-key',
    ['fixture-other-secret'],
  );
  expect(text).not.toMatch(/fixture-confidential|fixture-hidden|fixture-private/);
  expect(text.match(/REDACTED/g)).toHaveLength(3);
});
afterEach(() => vi.restoreAllMocks());
function sdkFixture() {
  const m = {
    paid: C.LA_FAIL,
    trial: C.LA_FAIL,
    last: C.LA_OK,
    network: true,
    edition: 'Professional',
    type: 'node-locked' as 'node-locked' | 'hosted-floating',
    grace: Date.now() / 1000 + 7 * 86400,
    expires: Date.now() / 1000 + 60 * 86400,
    trialExpiry: 0,
    features: [...featureIds].map((featureName) => ({
      featureName,
      featureDisplayName: featureName,
      value: 'true',
      baseValue: 'true',
      expiresAt: 0,
    })),
    key: '',
    starts: 0,
  };
  const online = () => {
    if (!m.network) throw new LexActivatorException(C.LA_E_INET);
  };
  const api: CryptlexSDK = {
    SetProductData: () => {},
    SetProductId: () => {},
    SetLicenseKey: (key) => {
      m.key = key;
    },
    IsLicenseGenuine: () => m.paid,
    IsTrialGenuine: () => m.trial,
    GetLastActivationError: () => m.last,
    GetLicenseType: () => m.type,
    GetLicenseMetadata: () => m.edition,
    GetLicenseExpiryDate: () => m.expires,
    GetServerSyncGracePeriodExpiryDate: () => m.grace,
    GetActivationLastSyncedDate: () => Date.now() / 1000,
    GetActivationId: () => 'test-device-id',
    GetLicenseTotalActivations: () => 1,
    GetLicenseAllowedActivations: () => 2,
    GetFeatureEntitlements: () => m.features,
    GetTrialExpiryDate: () => m.trialExpiry,
    GetTrialId: () => 'test-trial-id',
    ActivateTrial: () => {
      online();
      m.starts++;
      if (m.trialExpiry && m.trialExpiry <= Date.now() / 1000) {
        m.trial = C.LA_TRIAL_EXPIRED;
        return m.trial;
      }
      m.trialExpiry ||= Date.now() / 1000 + 7 * 86400;
      m.trial = C.LA_OK;
      return C.LA_OK;
    },
    ActivateLicense: () => {
      online();
      if (m.key === 'fixture-limit') throw new LexActivatorException(C.LA_E_ACTIVATION_LIMIT);
      if (m.key !== 'fixture-paid') throw new LexActivatorException(C.LA_E_LICENSE_KEY);
      m.paid = C.LA_OK;
      return m.paid;
    },
    SyncLicenseActivation: () => {
      online();
      return m.paid;
    },
    SyncTrialActivation: () => {
      online();
      return m.trial;
    },
    DeactivateLicense: () => {
      online();
      m.paid = C.LA_FAIL;
      return C.LA_OK;
    },
  };
  return {
    m,
    api,
    provider: new CryptlexLicenseProvider(
      { productId: 'fixture-product', productData: 'fixture-public-data' },
      api,
    ),
  };
}
it('starts no trial during checks/refresh and activates exactly on explicit request', async () => {
  const { m, provider } = sdkFixture();
  expect((await provider.run('check')).status).toBe('TRIAL_AVAILABLE');
  await provider.run('refresh');
  expect(m.starts).toBe(0);
  const state = await provider.run('trial');
  expect(state.status).toBe('TRIAL_ACTIVE');
  expect(state.activationLimit).toBe(1);
  expect(state.trialExpiresAt! - Date.now()).toBeCloseTo(7 * 86400000, -3);
  await provider.run('trial');
  await provider.run('refresh');
  expect(m.starts).toBe(1);
});
it('provider trial record survives app recreation and rejects renewal by preference reset', async () => {
  const { m, api, provider } = sdkFixture();
  await provider.run('trial');
  m.trialExpiry = Date.now() / 1000 - 1;
  m.trial = C.LA_TRIAL_EXPIRED;
  const recreated = new CryptlexLicenseProvider(
    { productId: 'fixture-product', productData: 'fixture-public-data' },
    api,
  );
  expect((await recreated.run('trial')).status).toBe('TRIAL_EXPIRED');
  expect(m.starts).toBe(1);
});
it('fresh offline installation and failed trial never grant access', async () => {
  const { m, provider } = sdkFixture();
  m.network = false;
  expect(eligible(await provider.run('check'))).toBe(false);
  const result = await provider.run('trial');
  expect(result.issue).toBe('network');
  expect(result.features).toEqual([]);
});
it.each(['Professional', 'Enterprise'])(
  'activates provisioned %s and reports provider limits',
  async (edition) => {
    const { m, provider } = sdkFixture();
    m.edition = edition;
    const s = await provider.run('activate', 'fixture-paid');
    expect(s.edition).toBe(edition);
    expect(s.activationLimit).toBe(2);
    expect(s.features).toEqual(featureIds);
    expect(JSON.stringify(s)).not.toContain('fixture-paid');
  },
);
it.each([
  ['fixture-invalid', 'invalidKey'],
  ['fixture-limit', 'activationLimit'],
])('normalizes rejected key %s', async (key, issue) => {
  const { provider } = sdkFixture();
  const s = await provider.run('activate', key);
  expect(s.issue).toBe(issue);
  expect(eligible(s)).toBe(false);
  expect(s.features).toEqual([]);
});
it('retains cryptographically verified access during outage but not beyond grace', async () => {
  const { m, provider } = sdkFixture();
  await provider.run('activate', 'fixture-paid');
  m.network = false;
  const s = await provider.run('refresh');
  expect(s.status).toBe('OFFLINE_GRACE');
  expect(eligible(s)).toBe(true);
  m.grace = Date.now() / 1000 - 1;
  expect(eligible(await provider.run('check'))).toBe(false);
  m.paid = C.LA_GRACE_PERIOD_OVER;
  expect(eligible(await provider.run('refresh'))).toBe(false);
  m.network = true;
  m.grace = Date.now() / 1000 + 86400;
  m.paid = C.LA_OK;
  expect((await provider.run('refresh')).status).toBe('LICENSE_ACTIVE');
});
it.each([
  [C.LA_EXPIRED, 'LICENSE_EXPIRED'],
  [C.LA_SUSPENDED, 'LICENSE_SUSPENDED'],
  [C.LA_E_REVOKED, 'LICENSE_REVOKED'],
  [C.LA_E_ACTIVATION_NOT_FOUND, 'LICENSE_REVOKED'],
  [C.LA_E_TIME, 'VALIDATION_ERROR'],
  [C.LA_E_TIME_MODIFIED, 'VALIDATION_ERROR'],
  [C.LA_E_MACHINE_FINGERPRINT, 'VALIDATION_ERROR'],
])('denies SDK status %s without falling back to trial', async (code, status) => {
  const { m, provider } = sdkFixture();
  m.paid = Number(code);
  m.trial = C.LA_OK;
  m.trialExpiry = Date.now() / 1000 + 86400;
  const s = await provider.run('check');
  expect(s.status).toBe(status);
  expect(s.features).toEqual([]);
});
it('honors SDK last revocation even after SDK clears activation data', async () => {
  const { m, provider } = sdkFixture();
  m.last = C.LA_E_REVOKED;
  expect((await provider.run('check')).status).toBe('LICENSE_REVOKED');
  expect((await provider.run('trial')).status).toBe('LICENSE_REVOKED');
});
it('deactivation releases access only on confirmed success and supports reactivation', async () => {
  const { m, provider } = sdkFixture();
  await provider.run('activate', 'fixture-paid');
  m.network = false;
  const offline = await provider.run('deactivate');
  expect(eligible(offline)).toBe(true);
  expect(offline.issue).toBe('network');
  m.network = true;
  expect(eligible(await provider.run('deactivate'))).toBe(false);
  expect(eligible(await provider.run('activate', 'fixture-paid'))).toBe(true);
});
it('requires configured supported edition, node-locked type and finite signed grace', async () => {
  const { m, provider } = sdkFixture();
  m.paid = C.LA_OK;
  m.edition = 'Unprovisioned';
  expect((await provider.run('check')).issue).toBe('policy');
  m.edition = 'Professional';
  m.type = 'hosted-floating';
  expect(eligible(await provider.run('check'))).toBe(false);
  m.type = 'node-locked';
  m.grace = 0;
  expect((await provider.run('check')).issue).toBe('policy');
});
it('denies missing and expired feature entitlements while retaining existing flags', async () => {
  const { m, provider } = sdkFixture();
  m.paid = C.LA_OK;
  m.features = m.features.filter((f) => f.featureName !== 'connector.x');
  m.features[0]!.expiresAt = Date.now() / 1000 - 1;
  const s = await provider.run('check');
  expect(s.features).not.toContain('connector.x');
  expect(s.features).not.toContain('connector.rss');
  expect(s.features).toContain('output.obs');
});
it('missing public product configuration fails closed without calling SDK', async () => {
  const { api } = sdkFixture();
  const spy = vi.spyOn(api, 'SetProductData');
  const provider = new CryptlexLicenseProvider({ productId: '', productData: '' }, api);
  expect((await provider.run('activate', 'fixture-paid')).issue).toBe('configuration');
  expect(spy).not.toHaveBeenCalled();
});
it('retains expired activation details for support/deactivation without granting features', async () => {
  const { m, provider } = sdkFixture();
  m.paid = C.LA_EXPIRED;
  const state = await provider.run('check');
  expect(state.activationId).toBe('test-device-id');
  expect(state.edition).toBe('Professional');
  expect(state.features).toEqual([]);
  expect((await provider.run('deactivate')).status).toBe('TRIAL_AVAILABLE');
});
it('observer failure cannot reject licensing transitions or restore access', async () => {
  const p = new MockLicenseProvider();
  const service = new LicenseService(p);
  service.changed = () => {
    throw new Error('fixture-storage-failure');
  };
  await expect(service.run('check')).resolves.toMatchObject({ status: 'TRIAL_AVAILABLE' });
  expect(service.allows('output.obs')).toBe(false);
});
it('bounds stale in-memory authority without a provider call on the playout path', async () => {
  const p = new MockLicenseProvider();
  await p.run('activate', 'fixture-professional');
  let time = 0;
  const service = new LicenseService(p, () => time);
  await service.run('check');
  const count = p.calls.length;
  expect(service.allows('output.obs')).toBe(true);
  expect(p.calls.length).toBe(count);
  const leaked = service.snapshot();
  leaked.features.length = 0;
  expect(service.allows('output.obs')).toBe(true);
  time = 120001;
  expect(service.allows('output.obs')).toBe(false);
  await service.run('check');
  expect(service.allows('output.obs')).toBe(true);
});
it('validates provider output and allowlists diagnostics, stripping keys and identifiers', async () => {
  const p = new MockLicenseProvider();
  await p.run('activate', 'fixture-professional');
  const state = licenseSchema.parse({
    ...p.state,
    licenseKey: 'fixture-sensitive-key',
    raw: { secret: 'fixture-secret' },
  });
  const text = JSON.stringify(licenseDiagnostics(state));
  expect(text).not.toMatch(/fixture-sensitive|fixture-secret|fixture-license-paid|activationId/);
  const invalid = new LicenseService({
    run: async () => ({ ...denied(), status: 'unknown' }) as unknown as LicenseState,
    close: () => {},
  });
  expect((await invalid.run('check')).issue).toBe('unavailable');
  expect(invalid.allows('output.obs')).toBe(false);
});
