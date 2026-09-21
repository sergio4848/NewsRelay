import { randomUUID } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import {
  itemSchema,
  mediaSchema,
  safeUrl,
  sourceSchema,
  type Source,
  type Item,
  type Health,
} from '../core/model';
import { priority, words } from '../core/editorial';
const wireSchema = z.object({
  id: z.union([z.string(), z.number()]),
  headline: z.string().min(1).max(280),
  body: z.string().max(5000).default(''),
  url: z.string().default(''),
  publishedAt: z.string().datetime().optional(),
  publisher: z.string().max(100).optional(),
  media: z.array(mediaSchema).max(4).default([]),
});
export function normalize(raw: unknown, source: Source): Item {
  const v = wireSchema.parse(raw),
    text = v.body || v.headline,
    score = priority(v.headline + ' ' + text, source),
    now = new Date().toISOString();
  return itemSchema.parse({
    id: randomUUID(),
    externalId: String(v.id),
    connectorId: source.id,
    provider: source.kind,
    publisher: {
      id: source.id,
      name: v.publisher || source.name,
      handle: source.handle || undefined,
    },
    headline: v.headline,
    body: text,
    url: safeUrl(v.url) ? v.url : '',
    publishedAt: v.publishedAt || now,
    ingestedAt: now,
    media: source.media ? v.media : [],
    metadata: {},
    trust: source.trust,
    priority: score,
    group: source.group,
    fingerprint: words(text).split(' ').slice(0, 14).join(' '),
    references: [
      { connectorId: source.id, externalId: String(v.id), publisher: v.publisher || source.name },
    ],
    editorial: 'incoming',
    broadcast: 'off',
    template: score >= 75 ? 'breaking' : 'headline',
  });
}
export interface SourceConnector {
  readonly identity: string;
  readonly metadata: { name: string; eventBased: boolean };
  validate(): void;
  start(): void;
  stop(): void;
  health(): Health;
  poll(
    cursor: string | undefined,
    secret: string | undefined,
  ): Promise<{ items: Item[]; cursor?: string }>;
  normalize(raw: unknown): Item;
}
export async function request(
  url: string,
  secret?: string,
): Promise<{ text: string; remaining?: number; resetAt?: number }> {
  const validationUrl = new URL(url);
  // X continuation cursors are provider pagination state, not credentials.
  if (
    validationUrl.hostname === 'api.x.com' &&
    validationUrl.pathname === '/2/tweets/search/recent'
  )
    validationUrl.searchParams.delete('next_token');
  if (!safeUrl(validationUrl.href)) throw new Error('Invalid endpoint');
  const response = await fetch(url, {
    headers: secret ? { Authorization: 'Bearer ' + secret } : {},
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Provider HTTP ' + response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      length += r.value.length;
      if (length > 2_000_000) throw new Error('Response exceeds limit');
      chunks.push(r.value);
    }
  } finally {
    await reader.cancel();
  }
  const numeric = (name: string) => {
    const v = response.headers.get(name);
    return v !== null && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  return {
    text: Buffer.concat(chunks).toString('utf8'),
    remaining: numeric('x-rate-limit-remaining'),
    resetAt: numeric('x-rate-limit-reset'),
  };
}
export class FeedConnector implements SourceConnector {
  readonly identity: string;
  readonly metadata: { name: string; eventBased: boolean };
  protected status: Health = { status: 'offline', reads: 0 };
  constructor(protected source: Source) {
    this.identity = source.id;
    this.metadata = { name: source.kind, eventBased: source.kind === 'webhook' };
  }
  validate() {
    sourceSchema.parse(this.source);
  }
  start() {
    this.validate();
  }
  stop() {
    this.status.status = 'offline';
  }
  health() {
    return { ...this.status };
  }
  normalize(raw: unknown) {
    return normalize(raw, this.source);
  }
  protected async fetch(url: string, secret?: string) {
    const r = await request(url, secret);
    this.status = {
      status: 'connected',
      lastSuccess: new Date().toISOString(),
      remaining: r.remaining,
      resetAt: r.resetAt,
      reads: this.status.reads + 1,
    };
    return r.text;
  }
  async poll(_cursor?: string, secret?: string): Promise<{ items: Item[]; cursor?: string }> {
    if (this.source.kind === 'webhook') return { items: [] };
    const body = await this.fetch(this.source.endpoint, secret);
    if (this.source.kind === 'rest') {
      const rows = z.array(wireSchema).max(200).parse(JSON.parse(body));
      return { items: rows.map((r) => this.normalize(r)) };
    }
    return { items: parseFeed(body, this.source) };
  }
}
function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) return text(value['#text']);
  return '';
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
export function parseFeed(xml: string, source: Source): Item[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML declarations not supported');
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    isArray: (name) => ['item', 'entry', 'link'].includes(name),
  });
  const root = record(parser.parse(xml)),
    channel = record(record(root.rss).channel),
    feed = record(root.feed);
  const rows = channel.item || feed.entry || [];
  if (!Array.isArray(rows)) throw new Error('Invalid feed');
  return rows.slice(0, 200).map((raw) => {
    const r = record(raw),
      links = Array.isArray(r.link) ? r.link : [],
      link = links.find((l) => typeof l === 'string' || record(l)['@_rel'] !== 'self'),
      href = typeof link === 'string' ? link : text(record(link)['@_href']);
    const plain = (s: unknown) =>
      text(s)
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .trim();
    const headline = plain(r.title).slice(0, 280),
      body = plain(r.description || r.summary || r.content).slice(0, 5000),
      date = new Date(text(r.pubDate || r.published || r.updated));
    return normalize(
      {
        id: text(r.guid || r.id) || href || headline,
        headline,
        body,
        url: href,
        publishedAt: Number.isFinite(date.getTime()) ? date.toISOString() : undefined,
      },
      source,
    );
  });
}
const xPayload = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        created_at: z.string().optional(),
        attachments: z.object({ media_keys: z.array(z.string()) }).optional(),
      }),
    )
    .default([]),
  meta: z
    .object({ newest_id: z.string().optional(), next_token: z.string().optional() })
    .optional(),
});
export class XConnector extends FeedConnector {
  async poll(cursor?: string, secret?: string) {
    if (!secret) throw new Error('Credential required');
    const saved = cursor
      ? (JSON.parse(cursor) as { since?: string; next?: string; newest?: string; start?: string })
      : { start: new Date(Date.now() - 60000).toISOString() };
    const params = new URLSearchParams({
      query:
        'from:' +
        this.source.handle +
        (this.source.includeReplies ? '' : ' -is:reply') +
        (this.source.includeReposts ? '' : ' -is:retweet'),
      max_results: '100',
      'tweet.fields': 'created_at,attachments',
    });
    if (saved.since) params.set('since_id', saved.since);
    else if (saved.start) params.set('start_time', saved.start);
    if (saved.next) params.set('next_token', saved.next);
    const payload = xPayload.parse(
      JSON.parse(await this.fetch('https://api.x.com/2/tweets/search/recent?' + params, secret)),
    );
    const items = payload.data
      .map((row) => {
        const i = this.normalize({
          id: row.id,
          headline: row.text.slice(0, 280),
          body: row.text.slice(0, 5000),
          publishedAt: row.created_at,
          url: 'https://x.com/' + this.source.handle + '/status/' + row.id,
        });
        i.metadata = { mediaPending: row.attachments?.media_keys?.length ? 'true' : 'false' };
        return i;
      })
      .reverse();
    const newest = saved.newest || payload.meta?.newest_id || saved.since;
    return {
      items,
      cursor: JSON.stringify(
        payload.meta?.next_token
          ? { ...saved, next: payload.meta.next_token, newest }
          : { since: newest, start: newest ? undefined : saved.start },
      ),
    };
  }
  async loadMedia(item: Item, secret?: string): Promise<Item> {
    if (!secret) throw new Error('Credential required');
    const mediaResponse = z.object({
      includes: z
        .object({
          media: z
            .array(
              z.object({
                type: z.string(),
                url: z.string().optional(),
                preview_image_url: z.string().optional(),
                alt_text: z.string().optional(),
                variants: z
                  .array(
                    z.object({
                      content_type: z.string(),
                      url: z.string(),
                      bit_rate: z.number().optional(),
                    }),
                  )
                  .optional(),
              }),
            )
            .default([]),
        })
        .optional(),
    });
    const p = mediaResponse.parse(
      JSON.parse(
        await this.fetch(
          'https://api.x.com/2/tweets/' +
            encodeURIComponent(item.externalId) +
            '?expansions=attachments.media_keys&media.fields=type,url,preview_image_url,variants,alt_text',
          secret,
        ),
      ),
    );
    const attachments = (p.includes?.media || []).slice(0, 4).flatMap((m) => {
      const v = m.variants
        ?.filter((v) => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0];
      const url = v?.url || m.url || m.preview_image_url;
      return url && safeUrl(url)
        ? [
            {
              type: v ? ('video' as const) : ('image' as const),
              url,
              alt: (m.alt_text || '').slice(0, 300),
            },
          ]
        : [];
    });
    return { ...item, media: attachments, metadata: { mediaPending: 'false' } };
  }
}
export const demoSource = () =>
  sourceSchema.parse({
    id: 'demo-newsroom',
    name: 'Example Newsroom',
    kind: 'demo',
    enabled: true,
    trust: 'official',
    group: 'Demo',
    autoAir: false,
    priorityModifier: 20,
  });
export class DemoConnector extends FeedConnector {
  async poll() {
    this.status = { status: 'connected', reads: 0, lastSuccess: new Date().toISOString() };
    return {
      items: [
        this.normalize({
          id: 'demo-1',
          headline: 'Harbour rail service resumes after planned maintenance',
          body: 'Example story: the harbour line has reopened following scheduled overnight maintenance. Regular services are running.',
        }),
        this.normalize({
          id: 'demo-2',
          headline: 'Breaking: regional observatory opens new public science centre',
          body: 'Example story: the regional observatory has opened its new science centre. The opening programme continues throughout the week.',
        }),
        this.normalize({
          id: 'demo-3',
          headline: 'Yeni kültür merkezi hafta sonu kapılarını açıyor',
          body: 'Örnek haber: yeni kültür merkezinde hafta sonu halka açık etkinlikler düzenlenecek.',
        }),
      ],
    };
  }
}
export class WebhookConnector extends FeedConnector {}
export class RSSConnector extends FeedConnector {}
export class RESTConnector extends FeedConnector {}
export function connector(source: Source): SourceConnector {
  switch (source.kind) {
    case 'x':
      return new XConnector(source);
    case 'demo':
      return new DemoConnector(source);
    case 'rss':
      return new RSSConnector(source);
    case 'rest':
      return new RESTConnector(source);
    case 'webhook':
      return new WebhookConnector(source);
  }
}
