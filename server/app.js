/*
 * СӨХ Platform — API (Node http handler). Local (server/server.js) болон Cloudflare Worker
 * (worker/index.js) хоёуланд ижил ажиллана. Бүх endpoint-ийн жагсаалт: README.md → «Backend API».
 *
 * Эрх: httpOnly session cookie (sokh_sid). Header-ийн X-Sokh-Role г.м.-д итгэхгүй.
 * CSRF: өөрчлөх хүсэлт (POST/PUT/PATCH/DELETE) нь JSON эсвэл зураг байх ёстой — өөр сайтын
 * <form> ийм төрөл илгээж чаддаггүй (SameSite=Lax cookie-тэй хамт).
 */
const db = require('./db');
const { readBody, send, parseCookies } = require('./lib/http');
const { HttpError, forbid } = require('./lib/util');
const auth = require('./lib/auth');

const routes = [];
/** on('POST', '/api/requests/:id/status', fn, { open: true }) */
function on(method, pattern, fn, opt = {}) {
  const keys = [];
  const re = new RegExp(
    '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
  );
  routes.push({ method, re, keys, fn, opt });
}

class Ctx {
  constructor(req, res, url, params) {
    this.req = req;
    this.res = res;
    this.url = url;
    this.params = params;
    this.query = Object.fromEntries(url.searchParams);
    this.cookies = parseCookies(req.headers.cookie);
    this.ip =
      // Cloudflare дээр cf-connecting-ip-г Cloudflare өөрөө тавина; бусад орчинд түүнд итгэхгүй
      String(
        (process.env.SOKH_RUNTIME === 'cloudflare' && req.headers['cf-connecting-ip']) ||
          req.headers['x-forwarded-for'] ||
          '',
      )
        .split(',')[0]
        .trim() ||
      (req.socket && req.socket.remoteAddress) ||
      '';
    this.me = undefined;
    this._body = null;
  }
  /** JSON body (default ≤ 1MB) */
  async json(limit = 1024 * 1024) {
    if (this._body) return this._body;
    const buf = await readBody(this.req, limit);
    let x;
    try {
      x = JSON.parse(buf.toString('utf8') || '{}');
    } catch (e) {
      throw new HttpError(400, 'Буруу өгөгдөл');
    }
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw new HttpError(400, 'Буруу өгөгдөл');
    return (this._body = x);
  }
  raw(limit) {
    return readBody(this.req, limit);
  }
  async user() {
    if (this.me === undefined) this.me = await auth.sessionUser(this);
    return this.me;
  }
  /** Нэвтэрсэн хэрэглэгч шаардана; roles өгвөл тэдгээрийн аль нэг байх ёстой */
  async need(...roles) {
    const u = await this.user();
    if (!u) throw new HttpError(401, 'Нэвтэрнэ үү');
    if (roles.length && !roles.includes(u.role)) throw forbid();
    return u;
  }
  /** Сайтын бүрэн хаяг (QPay callback г.м.) */
  base() {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
    const h = this.req.headers['x-forwarded-host'] || this.req.headers.host || 'localhost';
    const proto = String(this.req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    return proto + '://' + h;
  }
}

const SIMPLE = /^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)/i;
function csrfOk(req) {
  const ct = String(req.headers['content-type'] || '');
  return !SIMPLE.test(ct);
}

// static require (Cloudflare Worker-ийн bundler dynamic require-ийг дэмждэггүй)
[
  require('./routes/auth'),
  require('./routes/complexes'),
  require('./routes/billing'),
  require('./routes/requests'),
  require('./routes/iot'),
  require('./routes/parking'),
  require('./routes/finance'),
  require('./routes/notify'),
  require('./routes/boot'),
].forEach((m) => m(on));

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  let route = null,
    params = {},
    pathHit = false;
  for (const r of routes) {
    const m = r.re.exec(p);
    if (!m) continue;
    pathHit = true;
    if (r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) continue;
    route = r;
    r.keys.forEach((k, i) => {
      try {
        params[k] = decodeURIComponent(m[i + 1]);
      } catch (e) {
        params[k] = m[i + 1];
      }
    });
    break;
  }
  if (!route)
    return send(res, pathHit ? 405 : 404, { error: pathHit ? 'Method not allowed' : 'Олдсонгүй' });
  const c = new Ctx(req, res, url, params);
  try {
    if (!['GET', 'HEAD'].includes(req.method) && !route.opt.open && !csrfOk(req))
      throw new HttpError(415, 'JSON өгөгдөл илгээнэ үү');
    await db.ready();
    const out = await route.fn(c);
    if (!res.writableEnded && !res.headersSent)
      send(res, 200, out === undefined ? { ok: true } : out);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...e.extra });
    if (e && e.code === '23505') return send(res, 409, { error: 'Давхардсан бүртгэл байна' });
    console.error(e);
    send(res, 500, { error: 'Серверийн алдаа' });
  }
}

module.exports = { handle, routes };
