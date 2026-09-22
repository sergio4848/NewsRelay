import { z } from 'zod';
import { defaultConfig, sourceSchema, type Config } from './model';
const legacySchema = z.object({
  accounts: z
    .array(
      z.object({
        username: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
        name: z.string().max(80).optional(),
        group: z.string().max(60).optional(),
        tier: z.string().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .max(100),
  blacklist: z.array(z.string().max(100)).max(100).default([]),
  pollMode: z.enum(['paused', 'economy', 'live']).default('paused'),
  includeReplies: z.boolean().default(false),
  includeRetweets: z.boolean().default(false),
});
export function migrateLegacy(input: unknown): Config {
  const old = legacySchema.parse(input),
    config = defaultConfig();
  config.blacklist = old.blacklist;
  config.sources = old.accounts.map((a) =>
    sourceSchema.parse({
      id: 'x-' + a.username.toLowerCase(),
      kind: 'x',
      name: a.name || a.username,
      handle: a.username,
      group: a.group || 'General',
      trust:
        a.tier === 'official'
          ? 'official'
          : ['tier1', 'reporter'].includes(a.tier || '')
            ? 'trusted'
            : a.tier === 'media'
              ? 'standard'
              : 'unverified',
      enabled: old.pollMode !== 'paused' && a.enabled !== false,
      interval: old.pollMode === 'live' ? 30000 : 120000,
      includeReplies: old.includeReplies,
      includeReposts: old.includeRetweets,
      autoAir: false,
    }),
  );
  return config;
}
