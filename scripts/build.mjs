import { build } from 'esbuild';
import './notices.mjs';
await build({
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/main/main.cjs',
  platform: 'node',
  target: 'node24',
  bundle: true,
  external: ['electron'],
  format: 'cjs',
});
await build({
  entryPoints: ['src/main/preload.ts'],
  outfile: 'dist/main/preload.cjs',
  platform: 'node',
  bundle: true,
  external: ['electron'],
  format: 'cjs',
});
