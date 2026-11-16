/*
 * Cloudflare build: dist/ (browser файлууд) + worker/migrations.gen.js (SQL migration-уудыг
 * Worker bundle-д оруулна, учир нь Worker дээр fs-ээр унших боломжгүй).   npm run build:cf
 */
const fs = require('fs');
const path = require('path');

require('./build.js');
const MIG = path.join(__dirname, '..', 'server', 'migrations');
const list = fs
  .readdirSync(MIG)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: fs.readFileSync(path.join(MIG, name), 'utf8') }));
fs.writeFileSync(
  path.join(__dirname, '..', 'worker', 'migrations.gen.js'),
  '// АВТОМАТААР ҮҮСНЭ (scripts/build-worker.js) — гараар бүү засна\nexport default ' +
    JSON.stringify(list, null, 1) +
    ';\n',
);
console.log('worker/migrations.gen.js:', list.map((m) => m.name).join(', '));
