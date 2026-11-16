/*
 * Vercel build: зөвхөн browser-т хэрэгтэй файлуудыг dist/ руу хуулна.
 * (server/, tests/, node_modules/ г.м. нийтэд харагдахгүй.)  node scripts/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const DIRS = ['css', 'js', 'vendor'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
console.log('dist/ бэлэн:', fs.readdirSync(OUT).join(', '));
