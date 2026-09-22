import { it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../src/persistence/database';
import { Newsroom } from '../src/main/service';
import { BrowserOutput } from '../src/output/server';
import { LicenseService } from '../src/licensing/service';
import { MockLicenseProvider } from './fixtures/mock-license';
import { defaultConfig, sourceSchema } from '../src/core/model';
import { featureIds, type LicenseState } from '../src/licensing/model';
const contacts = {
  salesEmail: '',
  salesWebsite: '',
  supportEmail: '',
  contactURL: '',
  privacyURL: '',
  termsURL: '',
};
const vault = { get: () => undefined, put: () => {}, token: () => 'fixture-token' };
it('revoked branding keeps Program intact but prevents new custom output until default theme is restored', async () => {
  const ctx = await room();
  try {
    ctx.room.save({ ...ctx.room.config, theme: { ...ctx.room.config.theme, label: 'CUSTOM' } });
    await ctx.room.seed();
    ctx.room.command({ type: 'preview', id: ctx.room.state.items[0]!.id });
    ctx.room.command({ type: 'take' });
    const program = ctx.room.state.program;
    ctx.provider.state.features = featureIds.filter((f) => f !== 'branding.custom');
    await ctx.license.run('check');
    expect(ctx.room.state.program).toEqual(program);
    expect(ctx.room.outputTheme().label).toBe('CUSTOM');
    expect(() => ctx.room.command({ type: 'take' })).toThrow('License');
    expect(() =>
      ctx.room.validateConfig(
        { ...ctx.room.config, theme: { ...ctx.room.config.theme, label: 'DENIED' } },
        true,
      ),
    ).toThrow('License');
    expect(ctx.room.state.program).toEqual(program);
    ctx.room.command({ type: 'clear' });
    ctx.room.save({ ...ctx.room.config, theme: defaultConfig().theme });
    ctx.room.command({ type: 'take' });
    expect(ctx.room.state.program).not.toBeNull();
  } finally {
    ctx.cleanup();
  }
});
afterEach(() => vi.unstubAllGlobals());
async function room(demo = true) {
  const dir = mkdtempSync(join(tmpdir(), 'newsrelay-licensed-'));
  const provider = new MockLicenseProvider();
  await provider.run('activate', 'fixture-professional');
  const license = new LicenseService(provider);
  await license.run('check');
  const repo = new Repository(join(dir, 'newsroom.sqlite'));
  const room = new Newsroom(repo, vault, demo, license, contacts);
  return {
    dir,
    provider,
    license,
    repo,
    room,
    cleanup: () => {
      room.stop();
      license.close();
      repo.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
it.each([
  'TRIAL_EXPIRED',
  'LICENSE_EXPIRED',
  'LICENSE_SUSPENDED',
  'LICENSE_REVOKED',
  'VALIDATION_ERROR',
  'ACTIVATION_LIMIT_REACHED',
] as const)(
  'keeps real HTTP Program alive during %s, denies new work and preserves customer data',
  async (status) => {
    const ctx = await room();
    const { room: r, license, provider, repo } = ctx;
    await r.seed();
    const first = r.state.items[0]!,
      second = r.state.items[1]!;
    r.command({ type: 'preview', id: first.id });
    r.command({ type: 'take' });
    r.command({ type: 'queue', id: second.id });
    r.command({ type: 'mode', mode: 'auto' });
    repo.set('cursor:fixture', 'durable-cursor');
    repo.set('credential:source:fixture', 'encrypted-fixture');
    const saved = structuredClone({
      program: r.state.program,
      items: r.state.items,
      rundown: r.state.rundown,
      config: r.config,
      history: repo.history(),
    });
    const server = new BrowserOutput(
      ctx.dir,
      'fixture-output',
      () => ({
        program: r.state.program,
        theme: r.config.theme,
        language: r.config.language,
        test: false,
      }),
      () => {},
      first,
      () => license.allows('output.obs'),
    );
    const port = await server.start(0);
    try {
      provider.state = { ...provider.state, status, features: [] };
      await license.run('check');
      r.tick();
      for (const command of [
        { type: 'take' },
        { type: 'next' },
        { type: 'compose', headline: 'Denied', body: '', publisher: 'Desk' },
        { type: 'mode', mode: 'auto' },
      ] as const)
        expect(() => r.command(command)).toThrow('License');
      expect(() => r.accept('any', {})).toThrow('License');
      await expect(r.poll(true)).rejects.toThrow('License');
      const response = await fetch(`http://127.0.0.1:${port}/state`, {
        headers: { Authorization: 'Bearer fixture-output' },
      });
      expect(response.status).toBe(200);
      expect((await response.json()).program).toEqual(saved.program);
      expect(r.state.mode).toBe('manual');
      expect(r.state.program).toEqual(saved.program);
      expect(r.config).toEqual(saved.config);
      expect(r.state.items).toEqual(saved.items);
      expect(r.state.rundown).toEqual(saved.rundown);
      expect(repo.history()).toEqual(expect.arrayContaining(saved.history));
      expect(repo.get('cursor:fixture', '')).toBe('durable-cursor');
      expect(repo.get('credential:source:fixture', '')).toBe('encrypted-fixture');
      expect(
        (
          await (
            await fetch(`http://127.0.0.1:${port}/state?test=1`, {
              headers: { Authorization: 'Bearer fixture-output' },
            })
          ).json()
        ).program,
      ).toEqual(saved.program);
      r.command({ type: 'hold' });
      expect(r.state.program).toEqual(saved.program);
      r.command({ type: 'clear' });
      expect(r.state.program).toBeNull();
      await provider.run('activate', 'fixture-professional');
      await license.run('check');
      r.tick();
      expect(r.state.mode).toBe('manual');
      expect(r.state.program).toBeNull();
    } finally {
      await server.stop();
      ctx.cleanup();
    }
  },
);
it('verified offline grace continues new operations and automatic expiry does not blank output', async () => {
  const ctx = await room();
  try {
    ctx.provider.state.status = 'OFFLINE_GRACE';
    await ctx.license.run('check');
    await ctx.room.seed();
    ctx.room.command({ type: 'preview', id: ctx.room.state.items[0]!.id });
    ctx.room.command({ type: 'take' });
    const program = ctx.room.state.program;
    ctx.provider.state.validUntil = Date.now() - 1;
    await ctx.license.run('check');
    ctx.room.tick();
    expect(ctx.room.state.program).toEqual(program);
    expect(() => ctx.room.command({ type: 'next' })).toThrow();
  } finally {
    ctx.cleanup();
  }
});
it.each(featureIds)('enforces feature %s in services, beyond renderer', async (feature) => {
  const ctx = await room(false);
  try {
    ctx.provider.state.features = featureIds.filter((f) => f !== feature);
    await ctx.license.run('check');
    if (feature.startsWith('connector.')) {
      const kind = feature.slice(10);
      const source = sourceSchema.parse({
        id: 'test',
        name: 'Test',
        kind,
        endpoint: 'https://feeds.example.test/news',
        handle: 'example',
        enabled: true,
      });
      expect(() => ctx.room.save({ ...ctx.room.config, sources: [source] })).toThrow('License');
    } else if (feature === 'branding.custom')
      expect(() =>
        ctx.room.save({
          ...ctx.room.config,
          theme: { ...ctx.room.config.theme, label: 'Changed' },
        }),
      ).toThrow('License');
    else if (feature === 'workflow.auto_air')
      expect(() => ctx.room.command({ type: 'mode', mode: 'auto' })).toThrow('License');
    else
      expect(() =>
        ctx.room.command({ type: 'compose', headline: 'Denied', body: '', publisher: 'Desk' }),
      ).toThrow('License');
  } finally {
    ctx.cleanup();
  }
});
it('discards an in-flight connector response after license revocation', async () => {
  const ctx = await room(false);
  let resolve!: (value: Response) => void;
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  try {
    ctx.room.save({
      ...ctx.room.config,
      sources: [
        sourceSchema.parse({
          id: 'rest-test',
          name: 'Test',
          kind: 'rest',
          enabled: true,
          endpoint: 'https://feeds.example.test/news',
        }),
      ],
    });
    const pending = ctx.room.poll(true);
    ctx.provider.state = { ...ctx.provider.state, status: 'LICENSE_REVOKED', features: [] };
    await ctx.license.run('check');
    resolve(Response.json([{ id: 'late', headline: 'Must not enter newsroom' }]));
    await pending;
    expect(ctx.room.state.items).toEqual([]);
    expect(ctx.repo.get('cursor:rest-test', null)).toBeNull();
  } finally {
    ctx.cleanup();
  }
});
it('ignores forged persisted license grants and preserves 5.0 editorial data on upgrade', async () => {
  const ctx = await room(false);
  try {
    ctx.repo.set('license', { status: 'LICENSE_ACTIVE', features: featureIds });
    const config = { ...defaultConfig(), setup: true };
    ctx.repo.set('config', config);
    ctx.provider.state = { ...ctx.provider.state, status: 'LICENSE_EXPIRED', features: [] };
    await ctx.license.run('check');
    const reopened = new Newsroom(ctx.repo, vault, false, ctx.license, contacts);
    expect(reopened.config).toEqual(config);
    expect(reopened.snapshot().license.status).toBe('LICENSE_EXPIRED');
    expect(() => reopened.command({ type: 'take' })).toThrow('License');
    reopened.save({ ...config, language: 'tr' });
    expect(reopened.config.language).toBe('tr');
    reopened.stop();
  } finally {
    ctx.cleanup();
  }
});
it('does not leak normalized provider identifiers through safe diagnostic projection', async () => {
  const { licenseDiagnostics } = await import('../src/licensing/service');
  const raw = {
    ...new MockLicenseProvider().state,
    activationId: 'private-device-id',
  } satisfies LicenseState;
  expect(JSON.stringify(licenseDiagnostics(raw))).not.toContain('private-device-id');
});
