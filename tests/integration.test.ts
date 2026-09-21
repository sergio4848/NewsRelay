import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Repository } from '../src/persistence/database';
import { emptyState, defaultConfig } from '../src/core/model';
import { demoSource, normalize } from '../src/connectors/connectors';
import { BrowserOutput } from '../src/output/server';
it('SQLite migration and durable transaction recovery', () => {
  const path = mkdtempSync(join(tmpdir(), 'newsrelay-test-'));
  try {
    const file = join(path, 'state.db'),
      repo = new Repository(file);
    const item = normalize({ id: 'one', headline: 'Durable story' }, demoSource());
    const state = { ...emptyState(), items: [item], rundown: [item.id] };
    repo.commit(state, 'queued', item.id, () => repo.set('cursor:demo', 'cursor-1'));
    repo.close();
    const restored = new Repository(file);
    expect(restored.state().rundown).toEqual([item.id]);
    expect(restored.get('cursor:demo', '')).toBe('cursor-1');
    expect(restored.history()[0]?.event).toBe('queued');
    expect(restored.health()).toBe('ok');
    expect(() =>
      restored.commit(emptyState(), 'broken', undefined, () => {
        throw new Error('rollback');
      }),
    ).toThrow();
    expect(restored.state().rundown).toHaveLength(1);
    restored.close();
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});
it('refuses unknown future schema', () => {
  const path = mkdtempSync(join(tmpdir(), 'newsrelay-schema-'));
  const file = join(path, 'state.db'),
    db = new DatabaseSync(file);
  db.exec('PRAGMA user_version=99');
  db.close();
  expect(() => new Repository(file)).toThrow('newer');
});
it('output protects state, denies web origins and exposes no operational commands', async () => {
  const root = mkdtempSync(join(tmpdir(), 'newsrelay-output-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'output.html'), '<!doctype html>');
  const token = 'fixture-only-output-capability';
  const item = normalize({ id: '1', headline: 'Test output' }, demoSource()),
    theme = defaultConfig().theme;
  const server = new BrowserOutput(
    root,
    token,
    () => ({ program: null, theme, language: 'en', test: false }),
    () => {
      throw new Error('Unauthorized');
    },
    item,
  );
  try {
    const port = await server.start(0),
      base = 'http://127.0.0.1:' + port;
    expect((await fetch(base + '/state')).status).toBe(403);
    expect(
      (
        await fetch(base + '/state', {
          headers: { Authorization: 'Bearer ' + token, Origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
    const response = await fetch(base + '/state', {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Object.keys(data).sort()).toEqual(['language', 'program', 'test', 'theme']);
    expect(data.program).toBeNull();
    expect(
      (
        await (
          await fetch(base + '/state?test=1', { headers: { Authorization: 'Bearer ' + token } })
        ).json()
      ).program.headline,
    ).toBe('Test output');
    expect((await fetch(base + '/command', { method: 'POST' })).status).toBe(405);
    expect((await fetch(base + '/output.html')).status).toBe(403);
    expect((await fetch(server.url())).status).toBe(200);
    expect((await fetch(base + '/../../package.json')).status).toBe(404);
  } finally {
    await server.stop();
    rmSync(root, { recursive: true, force: true });
  }
});
