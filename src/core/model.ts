import { z } from 'zod';
export const brand = {
  name: 'NewsRelay',
  subtitle: 'Broadcast News Automation',
  maker: 'S-AI Media Works',
  version: '5.0.0',
} as const;
export function safeUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      ![...u.searchParams.keys()].some((k) => /token|key|secret|password|auth/i.test(k))
    );
  } catch {
    return false;
  }
}
const url = z
  .string()
  .max(2048)
  .refine((v) => !v || safeUrl(v));
export const trustSchema = z.enum(['official', 'trusted', 'standard', 'unverified']);
export const templateSchema = z.enum(['headline', 'breaking', 'quote', 'media', 'ticker']);
export const sourceSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    name: z.string().min(1).max(80),
    kind: z.enum(['x', 'rss', 'rest', 'webhook', 'demo']),
    endpoint: url.default(''),
    handle: z
      .string()
      .regex(/^[A-Za-z0-9_]{0,15}$/)
      .default(''),
    enabled: z.boolean().default(false),
    trust: trustSchema.default('unverified'),
    group: z.string().max(60).default('General'),
    priorityModifier: z.number().int().min(-30).max(30).default(0),
    autoAir: z.boolean().default(false),
    minPriority: z.number().min(0).max(100).default(42),
    media: z.boolean().default(false),
    interval: z.number().int().min(15000).max(3600000).default(120000),
    blacklist: z.array(z.string().max(100)).max(100).default([]),
    includeReplies: z.boolean().default(false),
    includeReposts: z.boolean().default(false),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (['rss', 'rest'].includes(s.kind) && !s.endpoint)
      ctx.addIssue({ code: 'custom', message: 'Endpoint required' });
    if (s.kind === 'x' && !s.handle) ctx.addIssue({ code: 'custom', message: 'Handle required' });
  });
export type Source = z.infer<typeof sourceSchema>;
export const themeSchema = z
  .object({
    customer: z.string().max(60),
    logo: url,
    primary: z.string().regex(/^#[0-9a-f]{6}$/i),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    label: z.string().max(40),
    scale: z.number().min(0.8).max(1.2),
  })
  .strict();
export const configSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(sourceSchema).max(100),
    language: z.enum(['en', 'tr']),
    duration: z.number().int().min(5000).max(120000),
    blacklist: z.array(z.string().max(100)).max(100),
    theme: themeSchema,
    setup: z.boolean(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (new Set(c.sources.map((s) => s.id)).size !== c.sources.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate source IDs' });
  });
export type Config = z.infer<typeof configSchema>;
export const mediaSchema = z
  .object({ type: z.enum(['image', 'video']), url, alt: z.string().max(300).default('') })
  .strict();
export const itemSchema = z.object({
  id: z.string().max(100),
  externalId: z.string().max(200),
  connectorId: z.string().max(80),
  provider: z.string().max(30),
  publisher: z.object({
    id: z.string().max(200),
    name: z.string().max(100),
    handle: z.string().max(80).optional(),
    avatar: url.optional(),
  }),
  headline: z.string().min(1).max(280),
  body: z.string().max(5000),
  url,
  publishedAt: z.string().datetime(),
  ingestedAt: z.string().datetime(),
  media: z.array(mediaSchema).max(4),
  metadata: z.record(z.string(), z.string().max(200)).default({}),
  trust: trustSchema,
  priority: z.number().min(0).max(100),
  group: z.string().max(60),
  fingerprint: z.string().max(1000),
  references: z
    .array(z.object({ connectorId: z.string(), externalId: z.string(), publisher: z.string() }))
    .max(30),
  editorial: z.enum(['incoming', 'queued', 'previewed', 'aired']),
  broadcast: z.enum(['off', 'program']),
  template: templateSchema,
});
export type Item = z.infer<typeof itemSchema>;
export const stateSchema = z.object({
  items: z.array(itemSchema).max(500),
  rundown: z.array(z.string()).max(200),
  preview: itemSchema.nullable(),
  program: itemSchema.nullable(),
  hold: z.boolean(),
  mode: z.enum(['manual', 'assisted', 'auto']),
  takenAt: z.number().nullable(),
});
export type State = z.infer<typeof stateSchema>;
export type Health = {
  status: 'connected' | 'degraded' | 'offline';
  lastSuccess?: string;
  error?: string;
  remaining?: number;
  resetAt?: number;
  reads: number;
};
export type Audit = { at: string; event: string; itemId?: string };
export type Snapshot = {
  state: State;
  config: Config;
  demo: boolean;
  health: Record<string, Health>;
  history: Audit[];
  output: { port: number; clients: number };
  database: string;
};
export const defaultConfig = (): Config => ({
  version: 1,
  sources: [],
  language: 'en',
  duration: 25000,
  blacklist: [],
  theme: {
    customer: 'Newsroom',
    logo: '',
    primary: '#1b2025',
    accent: '#bf303a',
    label: 'NEWS',
    scale: 1,
  },
  setup: false,
});
export const emptyState = (): State => ({
  items: [],
  rundown: [],
  preview: null,
  program: null,
  hold: false,
  mode: 'manual',
  takenAt: null,
});
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('compose'),
    headline: z.string().trim().min(1).max(280),
    body: z.string().max(5000),
    publisher: z.string().trim().min(1).max(80),
  }),
  z.object({ type: z.literal('preview'), id: z.string() }),
  z.object({ type: z.literal('queue'), id: z.string() }),
  z.object({
    type: z.literal('edit'),
    headline: z.string().min(1).max(280),
    body: z.string().max(5000),
    template: templateSchema,
  }),
  z.object({ type: z.literal('take') }),
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('hold') }),
  z.object({ type: z.literal('clear') }),
  z.object({ type: z.literal('remove'), id: z.string() }),
  z.object({
    type: z.literal('move'),
    id: z.string(),
    direction: z.union([z.literal(-1), z.literal(1)]),
  }),
  z.object({ type: z.literal('mode'), mode: z.enum(['manual', 'assisted', 'auto']) }),
]);
export type Command = z.infer<typeof commandSchema>;
export interface DesktopBridge {
  snapshot(): Promise<Snapshot>;
  command(command: Command): Promise<Snapshot>;
  saveConfig(config: Config): Promise<Snapshot>;
  credential(id: string, value: string): Promise<void>;
  poll(): Promise<void>;
  media(id: string): Promise<Snapshot>;
  demo(value: boolean): Promise<Snapshot>;
  copyOutput(test: boolean): Promise<void>;
  copyWebhook(id: string): Promise<void>;
  transfer(action: 'export' | 'import' | 'legacy' | 'diagnostics'): Promise<Snapshot>;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
}
