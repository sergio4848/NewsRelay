import { _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const data = await mkdtemp(join(tmpdir(), 'newsrelay-license-production-'));
const marker = JSON.parse(await readFile('dist/license-build.json', 'utf8'));
assert.equal(marker.test, false);
if (marker.configured)
  throw new Error('Missing-configuration smoke requires the unconfigured public build');
const main = await readFile('dist/main/main.cjs', 'utf8');
const worker = await readFile('dist/main/licensing-worker.cjs', 'utf8');
assert.ok(!/MockLicenseProvider|fixture-professional|fixture-license/.test(main + worker));
const app = await electron.launch({
  ...(process.env.NEWSRELAY_EXECUTABLE ? { executablePath: process.env.NEWSRELAY_EXECUTABLE } : {}),
  args: ['.'],
  env: {
    ...process.env,
    NEWSRELAY_SMOKE: '1',
    NEWSRELAY_DATA: data,
    NEWSRELAY_LICENSE_PROVIDER: 'mock',
    NEWSRELAY_LICENSE_STATUS: 'LICENSE_ACTIVE',
  },
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!window.newsrelay);
  const s = await page.evaluate(() => window.newsrelay.snapshot());
  assert.equal(s.license.provider, 'cryptlex');
  assert.equal(s.license.status, 'VALIDATION_ERROR');
  assert.equal(s.license.issue, 'configuration');
  assert.equal(s.state.items.length, 0);
  assert.equal(s.state.program, null);
  assert.ok(!s.license.features.length);
  assert.equal(
    await page.evaluate(async () => {
      try {
        await window.newsrelay.command({
          type: 'compose',
          headline: 'Blocked',
          body: '',
          publisher: 'Test',
        });
        return false;
      } catch {
        return true;
      }
    }),
    true,
  );
  assert.equal(
    (await page.evaluate(() => window.newsrelay.license({ action: 'trial' }))).issue,
    'configuration',
  );
  assert.equal(
    (
      await page.evaluate(() =>
        window.newsrelay.license({ action: 'activate', key: 'fixture-professional' }),
      )
    ).issue,
    'configuration',
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh status', exact: true }).waitFor();
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: resolve('work/license-production-en.png'), fullPage: true });
  await page.evaluate(async () => {
    const s = await window.newsrelay.snapshot();
    await window.newsrelay.saveConfig({ ...s.config, language: 'tr' });
  });
  await page.getByRole('button', { name: 'Durumu yenile', exact: true }).waitFor();
  await page.screenshot({ path: resolve('work/license-production-tr.png'), fullPage: true });
  // Native addon and companion DLL really load under Electron, including ASAR unpacking.
  const version = s.license.sdkVersion;
  assert.match(version, /^3\./);
  console.log(
    'Production licensing smoke passed: native SDK ' +
      version +
      ', no mock bypass, missing configuration denied, IPC guards, EN/TR Settings.',
  );
} finally {
  await app.close();
}
