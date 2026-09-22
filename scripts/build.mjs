import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { z } from 'zod';
import './notices.mjs';
const test = process.argv.includes('--test');
const out = test ? 'dist-test' : 'dist';
const url = z.union([
  z.literal(''),
  z.url().refine((value) => {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  }),
]);
const email = z.union([z.literal(''), z.email()]);
const schema = z
  .object({
    productId: z.string().max(256),
    productData: z.string().max(100000),
    contacts: z
      .object({
        salesEmail: email,
        salesWebsite: url,
        supportEmail: email,
        contactURL: url,
        privacyURL: url,
        termsURL: url,
      })
      .strict(),
  })
  .strict();
let text;
try {
  text = await readFile('config/licensing.local.json', 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  text = await readFile('config/licensing.example.json', 'utf8');
}
const config = schema.parse(JSON.parse(text));
await mkdir(out + '/main', { recursive: true });
if (test) await cp('dist/renderer', out + '/renderer', { recursive: true });
await writeFile(
  out + '/license-build.json',
  JSON.stringify({ test, configured: !!(config.productId && config.productData) }),
);
await build({
  entryPoints: ['src/main/main.ts'],
  outfile: out + '/main/main.cjs',
  platform: 'node',
  target: 'node24',
  bundle: true,
  external: ['electron'],
  format: 'cjs',
  define: {
    __LICENSE_TEST_BUILD__: JSON.stringify(test),
    __LICENSE_CONFIG__: JSON.stringify(config),
  },
});
await build({
  entryPoints: ['src/main/preload.ts'],
  outfile: out + '/main/preload.cjs',
  platform: 'node',
  bundle: true,
  external: ['electron'],
  format: 'cjs',
});
await build({
  entryPoints: [test ? 'tests/fixtures/license-worker.ts' : 'src/licensing/worker.ts'],
  outfile: out + '/main/licensing-worker.cjs',
  platform: 'node',
  target: 'node24',
  bundle: true,
  format: 'cjs',
  external: ['@cryptlex/lexactivator'],
});
