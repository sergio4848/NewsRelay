import { _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const data = await mkdtemp(join(tmpdir(), 'newsrelay-smoke-'));
const launch = () =>
  electron.launch({
    ...(process.env.NEWSRELAY_EXECUTABLE
      ? { executablePath: process.env.NEWSRELAY_EXECUTABLE }
      : {}),
    args: ['dist-test/main/main.cjs'],
    env: { ...process.env, NEWSRELAY_SMOKE: '1', NEWSRELAY_DATA: data },
    timeout: 30000,
  });
let app = await launch();
const originalClipboard = await app.evaluate(({ clipboard }) => clipboard.readText());
try {
  let page = await app.firstWindow();
  await page.waitForFunction(() => !!window.newsrelay);
  const api = (fn) => page.evaluate(fn);
  assert.equal((await api(() => window.newsrelay.snapshot())).license.status, 'TRIAL_AVAILABLE');
  await page.getByRole('button', { name: 'Start 7-Day Trial', exact: true }).click();
  await page.waitForFunction(
    async () => (await window.newsrelay.snapshot()).license.status === 'TRIAL_ACTIVE',
  );
  await api(async () => {
    const s = await window.newsrelay.snapshot();
    await window.newsrelay.saveConfig({ ...s.config, setup: true });
  });
  let state = await api(() => window.newsrelay.snapshot());
  assert.equal(state.demo, true);
  assert.equal(state.state.items.length, 3);
  assert.equal(state.state.program, null);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  await page.evaluate(() =>
    window.newsrelay.credential('demo-newsroom', 'smoke-credential-must-be-encrypted'),
  );
  assert.ok(
    !JSON.stringify(await api(() => window.newsrelay.snapshot())).includes('smoke-credential'),
  );
  await page.locator('.story-select').first().click();
  await page.getByRole('button', { name: 'TAKE', exact: true }).click();
  await page.waitForFunction(async () => !!(await window.newsrelay.snapshot()).state.program);
  await page.getByRole('button', { name: 'HOLD', exact: true }).click();
  state = await api(() => window.newsrelay.snapshot());
  assert.equal(state.state.hold, true);
  const second = state.state.items.find((i) => i.id !== state.state.program.id);
  await page.evaluate((id) => window.newsrelay.command({ type: 'queue', id }), second.id);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  state = await api(() => window.newsrelay.snapshot());
  assert.ok(state.state.program);
  await page.getByRole('button', { name: 'Control', exact: true }).click();
  await mkdir('work', { recursive: true });
  await page.screenshot({ path: resolve('work/control-room.png') });
  await api(() => window.newsrelay.copyOutput(false));
  const outputUrl = await app.evaluate(({ clipboard }) => clipboard.readText());
  const pendingOutput = app.waitForEvent('window');
  await app.evaluate(async ({ BrowserWindow }, url) => {
    const outputWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
        backgroundThrottling: false,
      },
    });
    await outputWindow.loadURL(url);
  }, outputUrl);
  const outputPage = await pendingOutput;
  await outputPage.locator('.graphic h1').waitFor();
  assert.equal(await outputPage.locator('.graphic h1').textContent(), state.state.program.headline);
  await outputPage.reload();
  await outputPage.locator('.graphic h1').waitFor();
  await outputPage.screenshot({ path: resolve('work/broadcast-output.png'), omitBackground: true });
  // Paid activation and deactivation exercise the real IPC/service/output boundary.
  await api(() => window.newsrelay.license({ action: 'activate', key: 'fixture-professional' }));
  await api(() => window.newsrelay.license({ action: 'deactivate' }));
  const deniedTake = await page.evaluate(async () => {
    try {
      await window.newsrelay.command({ type: 'take' });
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(deniedTake, true);
  assert.equal(
    (await api(() => window.newsrelay.snapshot())).state.program.headline,
    state.state.program.headline,
  );
  await outputPage.reload();
  await outputPage.locator('.graphic h1').waitFor();
  assert.equal(await outputPage.locator('.graphic h1').textContent(), state.state.program.headline);
  await api(() => window.newsrelay.license({ action: 'activate', key: 'fixture-professional' }));
  await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), originalClipboard);
  await app.close();
  assert.ok(
    !(await readFile(join(data, 'demo.sqlite'))).includes(
      Buffer.from('smoke-credential-must-be-encrypted'),
    ),
  );
  app = await launch();
  page = await app.firstWindow();
  await page.waitForFunction(() => !!window.newsrelay);
  state = await page.evaluate(() => window.newsrelay.snapshot());
  assert.equal(state.state.mode, 'manual');
  assert.equal(state.state.program, null);
  await page.evaluate(() =>
    window.newsrelay.command({
      type: 'compose',
      headline: 'Independent editorial story',
      body: 'Operator-created copy',
      publisher: 'Editorial desk',
    }),
  );
  state = await page.evaluate(() => window.newsrelay.snapshot());
  assert.equal(state.state.preview.headline, 'Independent editorial story');
  assert.equal(state.state.program, null);
  await page.evaluate(() => window.newsrelay.demo(false));
  state = await page.evaluate(() => window.newsrelay.snapshot());
  assert.equal(state.state.items.length, 0);
  assert.equal(state.config.sources.length, 0);
  await page.evaluate(() => window.newsrelay.demo(true));
  state = await page.evaluate(() => window.newsrelay.snapshot());
  assert.equal(state.state.items.length, 4);
  assert.equal(state.state.rundown.length, 1);
  await page.evaluate(async () => {
    const s = await window.newsrelay.snapshot();
    await window.newsrelay.saveConfig({ ...s.config, language: 'tr' });
  });
  await page.getByRole('button', { name: 'YAYINI TEMİZLE', exact: true }).waitFor();
  state = await page.evaluate(() => window.newsrelay.command({ type: 'clear' }));
  assert.equal(state.state.program, null);
  await writeFile(
    'work/smoke-result.json',
    JSON.stringify(
      {
        passed: true,
        checks: [
          'sandboxed preload',
          'offline demo',
          'preview/take',
          'hold',
          'navigation preserves program',
          'SQLite restart recovery',
          'Turkish UI',
          'clear',
          'OS-encrypted credentials',
          'read-only output rendering and refresh',
          'manual composition',
          'live/demo database isolation',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    'Electron smoke passed: demo, preview/take, hold, navigation, recovery, Turkish UI, clear, vault encryption, output refresh, composition and workspace isolation.',
  );
} finally {
  try {
    await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), originalClipboard);
  } finally {
    await app.close();
  }
}
