import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
let failed = false;
for (const file of files) {
  if (
    /(^|\/)(\.env(?!\.example)|node_modules|runtime|release|diagnostics)(\/|$)|\.(sqlite|db|zip|dmp|log)$/.test(
      file,
    )
  ) {
    console.error('Forbidden tracked file: ' + file);
    failed = true;
  }
  const content = execFileSync('git', ['show', ':' + file], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  for (const pattern of [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /gh[pousr]_[A-Za-z0-9]{30,}/,
    /github_pat_[A-Za-z0-9_]{40,}/,
    /AKIA[A-Z0-9]{16}/,
  ]) {
    if (pattern.test(content)) {
      console.error('Potential secret in ' + file);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log(
  'Tracked-content secret patterns and forbidden paths checked (' +
    files.length +
    ' files). Review staged diff separately.',
);
