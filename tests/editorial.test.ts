import { describe, it, expect } from 'vitest';
import { defaultConfig, emptyState, sourceSchema, configSchema } from '../src/core/model';
import { normalize, demoSource, parseFeed } from '../src/connectors/connectors';
import { ingest, reduce, advance, priority, similarity } from '../src/core/editorial';
import { migrateLegacy } from '../src/core/migration';
import { redact } from '../src/core/redact';
const source = () => ({ ...demoSource(), autoAir: true, minPriority: 40 });
const config = () => ({ ...defaultConfig(), sources: [source()] });
const item = (id = '1', body = 'Breaking: harbour service resumes after repair') =>
  normalize({ id, headline: body, body }, source());
describe('editorial safety', () => {
  it('manual ingestion does not preview, queue or publish', () => {
    const r = ingest(emptyState(), item(), config());
    expect(r.state.items).toHaveLength(1);
    expect(r.state.program).toBeNull();
    expect(r.state.preview).toBeNull();
    expect(r.state.rundown).toEqual([]);
  });
  it('assisted queues trusted sources but never publishes', () => {
    const r = ingest({ ...emptyState(), mode: 'assisted' }, item(), config());
    expect(r.state.rundown).toHaveLength(1);
    expect(r.state.program).toBeNull();
  });
  it.each(['standard', 'unverified'] as const)('assisted does not queue %s sources', (trust) => {
    const c = config();
    c.sources[0]!.trust = trust;
    expect(ingest({ ...emptyState(), mode: 'assisted' }, item(), c).state.rundown).toEqual([]);
  });
  it('auto-air requires source permission', () => {
    const c = config();
    c.sources[0]!.autoAir = false;
    expect(ingest({ ...emptyState(), mode: 'auto' }, item(), c).state.program).toBeNull();
  });
  it('auto-air checks minimum score', () => {
    const c = config();
    c.sources[0]!.minPriority = 100;
    expect(
      ingest({ ...emptyState(), mode: 'auto' }, item('1', 'A normal story'), c).state.program,
    ).toBeNull();
  });
  it('approved auto-air publishes', () =>
    expect(
      ingest({ ...emptyState(), mode: 'auto' }, item(), config()).state.program?.externalId,
    ).toBe('1'));
  it('hold preserves program while receiving stories and blocks take/next', () => {
    let s = ingest({ ...emptyState(), mode: 'auto' }, item(), config()).state;
    s = reduce(s, { type: 'hold' }, config());
    const current = s.program?.id;
    s = ingest(s, item('2', 'Science centre opens on Tuesday'), config()).state;
    expect(s.rundown).toHaveLength(1);
    s = reduce(s, { type: 'preview', id: s.rundown[0]! }, config());
    s = reduce(s, { type: 'take' }, config());
    s = reduce(s, { type: 'next' }, config());
    expect(s.program?.id).toBe(current);
    s = reduce(s, { type: 'hold' }, config());
    s = reduce(s, { type: 'next' }, config());
    expect(s.program?.externalId).toBe('2');
  });
  it('selection and editing never modify program', () => {
    let s = ingest({ ...emptyState(), mode: 'auto' }, item(), config()).state;
    s = reduce(s, { type: 'preview', id: s.items[0]!.id }, config());
    s = reduce(
      s,
      { type: 'edit', headline: 'Edited', body: 'Different', template: 'quote' },
      config(),
    );
    expect(s.program?.headline).not.toBe('Edited');
    s = reduce(s, { type: 'take' }, config());
    expect(s.program?.headline).toBe('Edited');
  });
  it('clear blanks, releases hold and disarms automation', () => {
    let s = ingest({ ...emptyState(), mode: 'auto' }, item(), config()).state;
    s = reduce(s, { type: 'hold' }, config());
    s = reduce(s, { type: 'clear' }, config());
    expect(s.program).toBeNull();
    expect(s.mode).toBe('manual');
    expect(s.hold).toBe(false);
  });
  it('rechecks revoked permission during progression', () => {
    const i = item(),
      c = config();
    const s = { ...emptyState(), items: [i], rundown: [i.id], mode: 'auto' as const };
    c.sources[0]!.autoAir = false;
    expect(advance(s, c, true).program).toBeNull();
    expect(s.rundown).toHaveLength(1);
  });
  it('reorders without duplicates', () => {
    const a = item(),
      b = item('2', 'Local forecast is clear');
    let s = { ...emptyState(), items: [a, b], rundown: [a.id, b.id] };
    s = reduce(s, { type: 'move', id: b.id, direction: -1 }, config());
    expect(s.rundown).toEqual([b.id, a.id]);
    s = reduce(s, { type: 'queue', id: b.id }, config());
    expect(s.rundown).toHaveLength(2);
  });
  it('bounded incoming preserves queued stories', () => {
    const protectedItem = item('saved', 'Protected');
    let s = { ...emptyState(), items: [protectedItem], rundown: [protectedItem.id] };
    for (let n = 0; n < 510; n++)
      s = ingest(
        s,
        item(String(n), 'Unique story ' + n + ' arbitrary sequence ' + n),
        config(),
      ).state;
    expect(s.items.length).toBeLessThanOrEqual(500);
    expect(s.items.some((i) => i.id === protectedItem.id)).toBe(true);
  });
});
describe('filters, provenance and priority', () => {
  it('blacklist matches Turkish case', () => {
    const c = config();
    c.blacklist = ['ÇEKİLİŞ'];
    expect(ingest(emptyState(), item('1', 'çekiliş başladı'), c).event).toBe('filtered');
  });
  it('disabled source is rejected', () => {
    const c = config();
    c.sources[0]!.enabled = false;
    expect(ingest(emptyState(), item(), c).event).toBe('disabled');
  });
  it('repeated provider ID does not add provenance', () => {
    const a = item();
    let s = ingest(emptyState(), a, config()).state;
    const result = ingest(s, item(), config());
    s = result.state;
    expect(result.event).toBe('repeated');
    expect(s.items[0]?.references).toHaveLength(1);
  });
  it('similar reports retain secondary publisher', () => {
    const c = config(),
      other = { ...source(), id: 'other', name: 'Second source' };
    c.sources.push(other);
    const s = ingest(emptyState(), item(), c).state;
    const result = ingest(
      s,
      normalize({ id: '2', headline: item().headline, body: item().body }, other),
      c,
    );
    expect(result.event).toBe('merged');
    expect(result.state.items[0]?.references).toHaveLength(2);
  });
  it('different groups do not merge', () => {
    const c = config(),
      other = { ...source(), id: 'other', group: 'Other' };
    c.sources.push(other);
    const s = ingest(emptyState(), item(), c).state;
    expect(
      ingest(s, normalize({ id: '2', headline: item().headline }, other), c).state.items,
    ).toHaveLength(2);
  });
  it('priority is bounded and deterministic', () => {
    expect(priority('breaking', source())).toBe(100);
    expect(priority('normal', { ...source(), trust: 'unverified', priorityModifier: -30 })).toBe(0);
    expect(similarity('hello world', 'world hello')).toBe(1);
  });
});
describe('normalization and imports', () => {
  it('normalizes provider data into a domain item', () => {
    const i = item();
    expect(i.provider).toBe('demo');
    expect(i.externalId).toBe('1');
    expect(i.id).not.toBe('1');
    expect(i.fingerprint).toContain('breaking');
  });
  it('rejects executable media URLs', () =>
    expect(() =>
      normalize(
        { id: '1', headline: 'test', media: [{ type: 'image', url: 'javascript:alert(1)' }] },
        source(),
      ),
    ).toThrow());
  it('parses RSS and Atom without HTML', () => {
    expect(
      parseFeed(
        '<rss><channel><item><guid>1</guid><title>News</title><description>&lt;b&gt;Report&lt;/b&gt;</description><link>https://example.com/news</link></item></channel></rss>',
        source(),
      )[0]?.headline,
    ).toBe('News');
    expect(
      parseFeed(
        '<feed><entry><id>2</id><title>Atom</title><link href="https://example.com/item"/></entry></feed>',
        source(),
      )[0]?.url,
    ).toBe('https://example.com/item');
  });
  it('rejects XML entity declarations', () =>
    expect(() => parseFeed('<!DOCTYPE rss><rss/>', source())).toThrow());
  it('rejects secret-bearing config and unknown fields', () => {
    expect(() => sourceSchema.parse({ ...source(), token: 'secret' })).toThrow();
    expect(() =>
      sourceSchema.parse({ ...source(), endpoint: 'https://example.com/?api_key=private' }),
    ).toThrow();
    expect(() => configSchema.parse({ ...config(), version: 99 })).toThrow();
  });
  it('rejects duplicate source IDs', () =>
    expect(() => configSchema.parse({ ...config(), sources: [source(), source()] })).toThrow());
  it('migrates legacy preferences and disables auto-air', () => {
    const c = migrateLegacy({
      accounts: [{ username: 'example', tier: 'tier1', group: 'Example' }],
      pollMode: 'live',
      autoQueue: true,
      includeReplies: true,
      blacklist: ['spam'],
    });
    expect(c.sources[0]?.trust).toBe('trusted');
    expect(c.sources[0]?.interval).toBe(30000);
    expect(c.sources[0]?.autoAir).toBe(false);
    expect(c.sources[0]?.includeReplies).toBe(true);
    expect(c.blacklist).toEqual(['spam']);
  });
  it('paused legacy remains disabled', () =>
    expect(
      migrateLegacy({ accounts: [{ username: 'sample' }], pollMode: 'paused' }).sources[0]?.enabled,
    ).toBe(false));
  it('redacts credentials and URLs', () => {
    const result = redact(
      'Bearer secret-value token=private password=pass https://example.com/?key=hidden customneedle',
      ['customneedle'],
    );
    for (const secret of ['secret-value', 'private', 'pass ', 'hidden', 'customneedle'])
      expect(result).not.toContain(secret);
  });
});
