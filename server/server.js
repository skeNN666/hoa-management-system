/*
 * СӨХ Platform — локал server (Node 20+):
 *   npm start                       → http://localhost:8080
 *   PORT=3000 npm start
 *
 * • Статик файлуудыг (index.html, js/, css/ …) өгнө, /api/* → server/app.js
 * • DATABASE_URL байхгүй бол PGlite (server/data/pg)-д хадгална; анх хоосон бол демо өгөгдөл үүснэ
 *   (SEED_DEMO=0 бол үүсгэхгүй). Production (Vercel) нь api/index.js-ээр ажиллана.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./app');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
// browser-т өгөхгүй хавтас, файлууд
const HIDDEN = /^(server|tests|api|scripts|dist|node_modules)([\\/]|$)|(^|[\\/])\.|^package(-lock)?\.json$|^vercel\.json$/;

function serveStatic(req, res, url) {
  let p;
  try {
    p = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || HIDDEN.test(rel)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return handle(req, res);
  serveStatic(req, res, url);
});

if (require.main === module) {
  (async () => {
    const db = require('./db');
    await db.ready();
    if (process.env.SEED_DEMO !== '0') {
      const { rows } = await db.query('select count(*)::int as n from complexes');
      if (!rows[0].n) {
        console.log('Демо өгөгдөл үүсгэж байна…');
        await require('./seed').seed();
      }
    }
    server.listen(PORT, () => console.log('СӨХ Platform → http://localhost:' + PORT + '  (DB: ' + db.kind + ')'));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
module.exports = server;
