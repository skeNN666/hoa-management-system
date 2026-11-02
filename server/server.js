/*
 * СӨХ Platform — жижиг backend (нэмэлт сан хэрэггүй, Node 18+):
 *   node server/server.js            → http://localhost:8080
 *   PORT=3000 node server/server.js
 *
 * • Статик файлуудыг (index.html, js/, css/ …) өгнө.
 * • Хотхоны map-ыг server/data/layouts.json-д хадгална → бүх компьютер дээр ижил харагдана.
 *
 *   GET    /api/ping
 *   GET    /api/layouts          — засварласан бүх map
 *   PUT    /api/layouts/:id      — map хадгалах   (зөвхөн тухайн хотхоны админ)
 *   DELETE /api/layouts/:id      — анхных руу буцаах (зөвхөн тухайн хотхоны админ)
 *
 *   POST   /api/accounts/register — СӨХ бүртгүүлэх / оршин суугчийн хүсэлт (нээлттэй)
 *   POST   /api/accounts/login    — { role, cx, login, pw } → { acc }
 *   GET    /api/accounts          — тухайн хотхоны бүртгэлүүд (зөвхөн админ)
 *   POST   /api/accounts/staff    — ажилтан үүсгэх (зөвхөн админ)
 *   POST   /api/accounts/resident — оршин суугчийг админ өөрөө бүртгэх (шууд идэвхтэй)
 *   PATCH  /api/accounts/:id      — { status, note } батлах / татгалзах (зөвхөн админ)
 *   Дүрэм нь js/accounts.js-д (browser-ийн offline горимтой ижил).
 *
 * Эрх: X-Sokh-Role: admin, X-Sokh-Cx: <хотхоны id> толгой шаардана — хотхон бүрийн админ зөвхөн
 * өөрийн хотхоны map-ыг өөрчилнө. Анхаар: энэ нь demo түвшний шалгалт; бодит системд нууц
 * үгээр нэвтрүүлж, серверт session / JWT ашиглана.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = process.env.SOKH_DATA || path.join(__dirname, 'data'); // тестэд өөр хавтас
const FILE = path.join(DATA, 'layouts.json');
const ACC_FILE = path.join(DATA, 'accounts.json');
const Accounts = require(path.join(ROOT, 'js', 'accounts.js'));
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 8 * 1024 * 1024; // дэвсгэр зурагтай map ч багтана
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function readAll(file = FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeAll(list, file = FILE) {
  fs.mkdirSync(DATA, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list));
  fs.renameSync(tmp, file); // хагас бичигдсэн файл үлдээхгүй
}
const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
function body(req) {
  return new Promise((ok, bad) => {
    let n = 0;
    const parts = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_BODY) {
        bad(new Error('too big'));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
    req.on('error', bad);
  });
}
/** Тухайн хотхоны админ мөн эсэх */
function authorize(req, id) {
  const role = req.headers['x-sokh-role'],
    cx = req.headers['x-sokh-cx'];
  if (role !== 'admin') return 'Map засах эрх зөвхөн админд байна';
  if (cx !== id) return 'Зөвхөн өөрийн хотхоны map-ыг өөрчилнө';
  return null;
}
/** Хадгалах map-ын үндсэн бүтцийг шалгана */
function validLayout(L, id) {
  if (!L || typeof L !== 'object') return 'JSON биш';
  if (L.id !== id) return 'id таарахгүй байна';
  if (!Array.isArray(L.buildings) || !L.buildings.length) return 'buildings хоосон';
  if (!Array.isArray(L.roads) || !Array.isArray(L.lots)) return 'roads / lots буруу';
  if (L.bg && !/^data:image\//.test(String(L.bg.src || ''))) return 'дэвсгэр зураг буруу';
  return null;
}

async function json(req) {
  try {
    const j = JSON.parse(await body(req));
    return j && typeof j === 'object' ? j : null;
  } catch (e) {
    return null;
  }
}
/** Accounts.* үр дүнг хариу болгоно (амжилттай бол нууц үггүй acc) */
function reply(res, r, list) {
  if (!r.ok) return send(res, 400, { error: r.msg, status: r.status });
  if (list) writeAll(list, ACC_FILE);
  return send(res, 200, { ok: true, msg: r.msg, acc: Accounts.pub(r.acc) });
}
async function accounts(req, res, sub) {
  const list = readAll(ACC_FILE);
  if (req.method === 'POST' && (sub === 'register' || sub === 'login')) {
    const x = await json(req);
    if (!x) return send(res, 400, { error: 'Буруу өгөгдөл' });
    if (sub === 'login') return reply(res, Accounts.check(list, x.role, x.cx, x.login, x.pw));
    return reply(res, Accounts.register(list, x), list);
  }
  // үлдсэн нь зөвхөн тухайн хотхоны админд
  const cx = req.headers['x-sokh-cx'];
  if (req.headers['x-sokh-role'] !== 'admin' || !cx)
    return send(res, 403, { error: 'Зөвхөн СӨХ-ийн админ' });
  let by = '';
  try {
    by = decodeURIComponent(req.headers['x-sokh-user'] || '');
  } catch (e) {}
  if (req.method === 'GET' && !sub)
    return send(res, 200, list.filter((a) => a.cx === cx).map(Accounts.pub));
  if (req.method === 'POST' && (sub === 'staff' || sub === 'resident')) {
    const x = await json(req);
    if (!x) return send(res, 400, { error: 'Буруу өгөгдөл' });
    const make = sub === 'staff' ? Accounts.createStaff : Accounts.createResident;
    return reply(res, make(list, cx, x, by), list);
  }
  if (req.method === 'PATCH' && sub) {
    const x = await json(req);
    if (!x) return send(res, 400, { error: 'Буруу өгөгдөл' });
    return reply(res, Accounts.decide(list, cx, sub, x.status, x.note, by), list);
  }
  return send(res, 405, { error: 'Method not allowed' });
}

async function api(req, res, url) {
  const a = /^\/api\/accounts(?:\/([\w-]+))?$/.exec(url.pathname);
  if (a) return accounts(req, res, a[1]);
  const m = /^\/api\/layouts(?:\/([\w-]+))?$/.exec(url.pathname);
  if (url.pathname === '/api/ping') return send(res, 200, { ok: true });
  if (!m) return send(res, 404, { error: 'Олдсонгүй' });
  const id = m[1];
  if (req.method === 'GET' && !id) return send(res, 200, readAll());
  if (!id) return send(res, 405, { error: 'Method not allowed' });
  const deny = authorize(req, id);
  if (deny) return send(res, 403, { error: deny });
  if (req.method === 'PUT') {
    let L;
    try {
      L = JSON.parse(await body(req));
    } catch (e) {
      return send(res, 400, { error: 'Буруу эсвэл хэт том өгөгдөл' });
    }
    const bad = validLayout(L, id);
    if (bad) return send(res, 400, { error: bad });
    writeAll(
      readAll()
        .filter((x) => x.id !== id)
        .concat([L]),
    );
    return send(res, 200, { ok: true, msg: 'Хадгаллаа' });
  }
  if (req.method === 'DELETE') {
    writeAll(readAll().filter((x) => x.id !== id));
    return send(res, 200, { ok: true, msg: 'Анхны map руу буцлаа' });
  }
  return send(res, 405, { error: 'Method not allowed' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  // ROOT-оос гадагш, server/ болон далд (.git г.м.) файлыг өгөхгүй
  const rel = path.relative(ROOT, file);
  if (
    rel.startsWith('..') ||
    path.isAbsolute(rel) ||
    /^(server|tests)[\\/]|(^|[\\/])\./.test(rel)
  ) {
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
  if (url.pathname.startsWith('/api/'))
    return api(req, res, url).catch(() => send(res, 500, { error: 'Серверийн алдаа' }));
  serveStatic(req, res, url);
});
if (require.main === module)
  server.listen(PORT, () => console.log('СӨХ Platform → http://localhost:' + PORT));
module.exports = server;
