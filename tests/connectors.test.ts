import { afterEach, it, expect, vi } from 'vitest';
import { XConnector, RESTConnector, request, normalize } from '../src/connectors/connectors';
import { sourceSchema } from '../src/core/model';
afterEach(() => vi.unstubAllGlobals());
const source = () =>
  sourceSchema.parse({
    id: 'fixture-x',
    name: 'Example Desk',
    kind: 'x',
    handle: 'example',
    enabled: true,
    trust: 'trusted',
    media: true,
  });
it('X recent search keeps continuation and advances only after last page', async () => {
  const calls: string[] = [];
  let count = 0;
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    return new Response(
      JSON.stringify(
        count++ === 0
          ? {
              data: [
                {
                  id: '20',
                  text: 'Fresh report',
                  created_at: '2026-09-21T00:00:00Z',
                  attachments: { media_keys: ['m1'] },
                },
              ],
              meta: { newest_id: '20', next_token: 'page2' },
            }
          : { data: [{ id: '11', text: 'Earlier report' }], meta: { newest_id: '11' } },
      ),
      { headers: { 'x-rate-limit-remaining': '9' } },
    );
  });
  const c = new XConnector(source());
  const first = await c.poll(JSON.stringify({ since: '10' }), 'fixture-credential');
  expect(first.items[0]?.metadata.mediaPending).toBe('true');
  expect(first.items[0]?.publisher.name).toBe('Example Desk');
  expect(JSON.parse(first.cursor).since).toBe('10');
  const second = await c.poll(first.cursor, 'fixture-credential');
  expect(JSON.parse(second.cursor).since).toBe('20');
  expect(new URL(calls[1]!).searchParams.get('next_token')).toBe('page2');
  expect(c.health().remaining).toBe(9);
});
it('X requires a credential before network activity', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(new XConnector(source()).poll()).rejects.toThrow('Credential required');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('X media loads on demand and rejects executable media URLs', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          includes: {
            media: [
              { type: 'photo', url: 'javascript:bad' },
              {
                type: 'video',
                variants: [
                  { content_type: 'video/mp4', url: 'https://example.com/clip.mp4', bit_rate: 200 },
                ],
              },
            ],
          },
        }),
      ),
  );
  const c = new XConnector(source()),
    i = normalize({ id: '20', headline: 'Media report' }, source());
  const loaded = await c.loadMedia(i, 'fixture-credential');
  expect(i.media).toHaveLength(0);
  expect(loaded.media).toHaveLength(1);
  expect(loaded.media[0]?.type).toBe('video');
});
it('REST accepts the documented canonical payload', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify([{ id: 'a', headline: 'Canonical report', publisher: 'Example Desk' }]),
      ),
  );
  const c = new RESTConnector(
    sourceSchema.parse({
      id: 'rest',
      name: 'REST',
      kind: 'rest',
      endpoint: 'https://example.com/news',
    }),
  );
  expect((await c.poll()).items[0]?.headline).toBe('Canonical report');
});
it('provider failure never reflects private response text', async () => {
  vi.stubGlobal('fetch', async () => new Response('private-provider-body', { status: 401 }));
  await expect(request('https://example.com/news', 'fixture-credential')).rejects.toThrow(
    'Provider HTTP 401',
  );
});
it('bounds provider response bodies', async () => {
  vi.stubGlobal('fetch', async () => new Response('x'.repeat(2_000_001)));
  await expect(request('https://example.com/news')).rejects.toThrow('Response exceeds limit');
});
