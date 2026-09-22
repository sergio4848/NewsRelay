const { readFileSync } = require('node:fs');
module.exports = async () => {
  const marker = JSON.parse(readFileSync('dist/license-build.json', 'utf8'));
  const worker = readFileSync('dist/main/licensing-worker.cjs', 'utf8');
  if (marker.test !== false || /MockLicenseProvider|fixture-license|tests\/fixtures/.test(worker))
    throw new Error('Production packaging refuses test licensing');
};
