import { parentPort } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { MockLicenseProvider } from './mock-license';
import { licenseSchema, type LicenseAction } from '../../src/licensing/model';
const provider = new MockLicenseProvider();
const file = process.env.NEWSRELAY_DATA + '-fixture-license.json';
try {
  provider.state = licenseSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  provider.trialExpiry = provider.state.trialExpiresAt;
} catch {
  /* new test installation */
}
parentPort?.on('message', (m: { id: number; action: LicenseAction; key?: string }) => {
  void provider.run(m.action, m.key).then((state) => {
    writeFileSync(file, JSON.stringify(state));
    parentPort?.postMessage({ id: m.id, state });
  });
});
