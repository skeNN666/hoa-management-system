/* HTTP туслах: body унших, JSON хариу, cookie */
const { HttpError } = require('./util');

/** Body-г Buffer болгож уншина (хэт том бол 413) */
function readBody(req, limit) {
  return new Promise((ok, fail) => {
    let n = 0;
    const parts = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) {
        fail(new HttpError(413, 'Өгөгдөл хэт том байна'));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', fail);
  });
}

function send(res, code, obj, headers) {
  if (res.headersSent) return;
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const k in headers || {}) res.setHeader(k, headers[k]);
  res.end(JSON.stringify(obj));
}

function parseCookies(h) {
  const o = {};
  String(h || '')
    .split(';')
    .forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) {
        const k = p.slice(0, i).trim();
        try {
          o[k] = decodeURIComponent(p.slice(i + 1).trim());
        } catch (e) {}
      }
    });
  return o;
}
function addCookie(res, name, value, { maxAge, secure } = {}) {
  const c = [
    name + '=' + encodeURIComponent(value),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + Math.floor(maxAge == null ? 0 : maxAge),
  ];
  if (secure) c.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [].concat(prev || [], c.join('; ')));
}

module.exports = { readBody, send, parseCookies, addCookie };
