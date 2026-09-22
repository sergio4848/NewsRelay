import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const seen = new Set();
const sections = [];
async function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const root = join('node_modules', name);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const files = (await readdir(root)).filter((f) =>
    /^(license|licence|copying|notice|third[-_]party[-_]notices)(\.|$)/i.test(f),
  );
  sections.push(name + ' ' + pkg.version + '\nLicense declared by package: ' + pkg.license + '\n');
  for (const file of files) sections.push(await readFile(join(root, file), 'utf8'));
  for (const dep of Object.keys(pkg.dependencies || {})) await visit(dep);
}
for (const name of Object.keys(manifest.dependencies)) await visit(name);
await writeFile('dist/THIRD_PARTY_NOTICES.txt', sections.join('\n\n----------------\n\n'));
