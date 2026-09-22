import { app, BrowserWindow, ipcMain, dialog, clipboard, session, shell } from 'electron';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { Repository } from '../persistence/database';
import { Vault } from './vault';
import { Newsroom } from './service';
import { BrowserOutput, equal } from '../output/server';
import { commandSchema, configSchema, brand } from '../core/model';
import { migrateLegacy } from '../core/migration';
import { DemoConnector, demoSource } from '../connectors/connectors';
import { redact } from '../core/redact';
import { LicenseService, licenseDiagnostics } from '../licensing/service';
import { WorkerLicenseProvider } from '../licensing/worker-provider';
import { contactIds, licenseRequestSchema } from '../licensing/model';
let licensing: LicenseService;
let window: BrowserWindow;
let newsroom: Newsroom;
let output: BrowserOutput;
let timer: ReturnType<typeof setInterval>;
let switching = false;
const smoke = process.env.NEWSRELAY_SMOKE === '1';
if (smoke && process.env.NEWSRELAY_DATA) app.setPath('userData', process.env.NEWSRELAY_DATA);
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  window?.show();
  window?.focus();
});
async function openRoom(demo: boolean) {
  const dir = app.getPath('userData');
  await mkdir(dir, { recursive: true });
  const repo = new Repository(join(dir, demo ? 'demo.sqlite' : 'newsroom.sqlite'));
  const vault = new Vault(repo);
  newsroom = new Newsroom(repo, vault, demo, licensing, __LICENSE_CONFIG__.contacts);
  if (demo && !newsroom.state.items.length && licensing.allows('output.obs')) await newsroom.seed();
  const fixture = (await new DemoConnector(demoSource()).poll()).items[0];
  if (!fixture) throw new Error('Test fixture unavailable');
  output = new BrowserOutput(
    join(__dirname, '../renderer'),
    vault.token('output'),
    () => ({
      program: newsroom.state.program,
      theme: newsroom.outputTheme(),
      language: newsroom.config.language,
      test: false,
    }),
    (id, body, token) => {
      const expected = vault.get('webhook:' + id);
      if (!expected || !equal(token, expected)) throw new Error('Unauthorized');
      newsroom.accept(id, body);
    },
    fixture,
    () => licensing.allows('output.obs'),
  );
  const port = await output.start(repo.get('output-port', 0));
  repo.set('output-port', port);
  newsroom.output.port = port;
  newsroom.changed = () => {
    if (window && !window.isDestroyed()) window.webContents.send('state', newsroom.snapshot());
  };
  timer = setInterval(() => {
    if (switching) return;
    const fatal = () => {
      clearInterval(timer);
      dialog.showErrorBox('NewsRelay', 'Storage or source service unavailable. Restart NewsRelay.');
    };
    try {
      newsroom.tick();
      const clients = output.clients();
      if (newsroom.output.clients !== clients) {
        newsroom.output.clients = clients;
        newsroom.changed();
      }
      void newsroom.poll().catch(fatal);
    } catch {
      fatal();
    }
  }, 1000);
}
function handle(name: string, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle(name, async (event, ...args: unknown[]) => {
    const expected = pathToFileURL(join(__dirname, '../renderer/index.html')).href;
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== expected
    )
      throw new Error('Unauthorized');
    if (switching) throw new Error('Changing operating mode');
    try {
      return await fn(...args);
    } catch {
      throw new Error('Operation failed. Check configuration and Diagnostics.');
    }
  });
}
async function transfer(action: unknown) {
  const kind = z.enum(['export', 'import', 'legacy', 'diagnostics']).parse(action);
  if (kind === 'export' || kind === 'diagnostics') {
    const save = await dialog.showSaveDialog(window, {
      defaultPath:
        kind === 'export' ? 'NewsRelay-configuration.json' : 'NewsRelay-diagnostics.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (save.filePath) {
      const config = configSchema.parse(newsroom.config);
      const data =
        kind === 'export'
          ? { ...config, sources: config.sources.map((s) => ({ ...s, autoAir: false })) }
          : {
              version: brand.version,
              licensing: licenseDiagnostics(licensing.snapshot()),
              database: newsroom.repo.health(),
              demo: newsroom.demo,
              output: { clients: output.clients(), active: !!newsroom.state.program },
              connectors: Object.values(newsroom.health).map((h) => ({
                status: h.status,
                lastSuccess: h.lastSuccess,
                remaining: h.remaining,
                reads: h.reads,
                error: h.error ? 'sourceUnavailable' : undefined,
              })),
            };
      const content = JSON.stringify(data, null, 2);
      await writeFile(save.filePath, kind === 'diagnostics' ? redact(content) : content, 'utf8');
    }
  } else {
    licensing.require('output.obs');
    const selection = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    const path = selection.filePaths[0];
    if (path) {
      if ((await stat(path)).size > 1_000_000) throw new Error('Import too large');
      const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
      const config = kind === 'legacy' ? migrateLegacy(raw) : configSchema.parse(raw);
      const confirm = await dialog.showMessageBox(window, {
        type: 'question',
        message:
          newsroom.config.language === 'tr'
            ? 'Kaynak ve tema ayarları değiştirilsin mi?'
            : 'Replace source and theme settings?',
        detail: config.sources.length + ' sources',
        buttons: newsroom.config.language === 'tr' ? ['İptal', 'İçe aktar'] : ['Cancel', 'Import'],
        defaultId: 0,
        cancelId: 0,
      });
      if (confirm.response === 1) {
        const validated = newsroom.validateConfig(
          { ...config, sources: config.sources.map((s) => ({ ...s, autoAir: false })) },
          true,
        );
        newsroom.command({ type: 'clear' });
        newsroom.save(validated);
      }
    }
  }
  return newsroom.snapshot();
}
async function boot() {
  await app.whenReady();
  if (__LICENSE_TEST_BUILD__ && app.isPackaged)
    throw new Error('Test builds cannot run as packaged applications');
  licensing = new LicenseService(
    new WorkerLicenseProvider(join(__dirname, 'licensing-worker.cjs'), __LICENSE_CONFIG__),
  );
  await licensing.start();
  app.setName(brand.name);
  session.defaultSession.setPermissionRequestHandler((_w, _p, callback) => callback(false));
  await openRoom(smoke);
  let lastLicenseStatus = '';
  licensing.changed = () => {
    const status = licensing.snapshot().status;
    if (status !== lastLicenseStatus) {
      newsroom.repo.audit('license-' + status);
      lastLicenseStatus = status;
    }
    newsroom.licenseChanged();
  };
  window = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    backgroundColor: '#14181c',
    title: brand.name,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  handle('snapshot', () => newsroom.snapshot());
  handle('license', async (raw) => {
    const request = licenseRequestSchema.parse(raw);
    const state = await licensing.run(
      request.action,
      request.action === 'activate' ? request.key : undefined,
    );
    if (newsroom.demo && !newsroom.state.items.length && licensing.allows('output.obs'))
      await newsroom.seed();
    return state;
  });
  handle('contact', async (raw) => {
    const id = z.enum(contactIds).parse(raw);
    const target = __LICENSE_CONFIG__.contacts[id];
    if (!target) throw new Error('Contact is not configured');
    await shell.openExternal(id.endsWith('Email') ? 'mailto:' + target : target);
  });
  handle('command', (c) => newsroom.command(commandSchema.parse(c)));
  handle('saveConfig', (c) => newsroom.save(configSchema.parse(c)));
  handle('credential', (id, value) => {
    licensing.require('output.obs');
    const key = z.string().max(80).parse(id);
    if (!newsroom.config.sources.some((s) => s.id === key)) throw new Error('Unknown source');
    newsroom.vault.put('source:' + key, z.string().min(1).max(8192).parse(value));
  });
  handle('poll', () => newsroom.poll(true));
  handle('media', (id) => newsroom.media(z.string().max(100).parse(id)));
  handle('copyOutput', (test) => {
    licensing.require('output.obs');
    clipboard.writeText(output.url(z.boolean().parse(test)));
  });
  handle('copyWebhook', (id) => {
    licensing.require('connector.webhook');
    const key = z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,80}$/)
      .parse(id);
    if (!newsroom.config.sources.some((s) => s.id === key && s.kind === 'webhook'))
      throw new Error('Unknown source');
    clipboard.writeText(
      JSON.stringify({
        url: output.webhookUrl(key),
        authorization: 'Bearer ' + newsroom.vault.token('webhook:' + key),
      }),
    );
  });
  handle('demo', async (value) => {
    const demo = z.boolean().parse(value);
    if (demo === newsroom.demo) return newsroom.snapshot();
    licensing.require('output.obs');
    if (newsroom.state.program) throw new Error('Clear Program before changing operating mode');
    switching = true;
    try {
      clearInterval(timer);
      newsroom.stop();
      await output.stop();
      newsroom.repo.close();
      await openRoom(demo);
      return newsroom.snapshot();
    } finally {
      switching = false;
    }
  });
  handle('transfer', transfer);
  await window.loadFile(join(__dirname, '../renderer/index.html'));
}
app.on('window-all-closed', () => {
  clearInterval(timer);
  newsroom?.stop();
  app.quit();
});
app.on('before-quit', () => {
  clearInterval(timer);
  licensing?.close();
});
void boot().catch(() => {
  dialog.showErrorBox(
    'NewsRelay',
    'NewsRelay could not start. Check that its data folder and output port are available.',
  );
  app.quit();
});
