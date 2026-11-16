/*
 * Нэвтрэлт: нууц үг (scrypt), session (httpOnly cookie), оролдлогын хязгаар, SMS OTP.
 *   Нууц үг:  's1$<salt>$<hash>' (scrypt N=16384, r=8, p=1)
 *   Хуучин js/accounts.js-ийн cyrb53 hash-тай бүртгэл нэвтрэх үедээ автоматаар scrypt болно.
 */
const crypto = require('crypto');
const { promisify } = require('util');
const db = require('../db');
const { HttpError, rid, sha256, safeEq, clean, digits } = require('./util');
const { addCookie } = require('./http');
const Legacy = require('../../js/accounts.js');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'sokh_sid';
const SESSION_DAYS = 30;
const ROLES = ['admin', 'staff', 'resident'];

async function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const h = await scrypt(String(pw), salt, 32);
  return 's1$' + salt + '$' + h.toString('base64url');
}
/** → 'ok' | 'legacy' (дахин hash хийх) | false */
async function verifyPw(pw, acc) {
  const s = String(acc.pw || '');
  if (s.startsWith('s1$')) {
    const [, salt, h] = s.split('$');
    const x = await scrypt(String(pw || ''), salt, 32);
    return safeEq(x.toString('base64url'), h) ? 'ok' : false;
  }
  return s && safeEq(Legacy.hash(pw, acc.id), s) ? 'legacy' : false;
}
/** Бүртгэл олдоогүй үед ч ижил хугацаа зарцуулна (хэрэглэгч байгаа эсэхийг таахаас хамгаална) */
const dummy = () => scrypt('x', 'dummy-salt', 32);

function checkPw(pw, pw2) {
  if (String(pw || '').length < 6) return 'Нууц үг дор хаяж 6 тэмдэгт байна';
  if (String(pw).length > 200) return 'Нууц үг хэт урт байна';
  if (pw2 !== undefined && pw !== pw2) return 'Нууц үг таарахгүй байна';
  return null;
}
const checkPhone = (p) => (/^\d{8}$/.test(digits(p)) ? null : 'Утасны дугаар 8 оронтой байна');
/** Нэвтрэх нэрийг харьцуулах хэлбэр: оршин суугч → утасны цифр, бусад → жижиг үсэг */
const loginKey = (role, login) =>
  role === 'resident' ? digits(login) : clean(login, 64).toLowerCase().replace(/\s+/g, '');

/* ---------- session ---------- */
const isSecure = (req) =>
  process.env.SECURE_COOKIES === '1' ||
  String(req.headers['x-forwarded-proto'] || '').startsWith('https') ||
  !!(req.socket && req.socket.encrypted);

async function createSession(c, acc) {
  const token = rid(32);
  await db.query(
    `insert into sessions (token_hash, account_id, expires_at, ip, ua)
     values ($1, $2, now() + interval '${SESSION_DAYS} days', $3, $4)`,
    [sha256(token), acc.id, c.ip, clean(c.req.headers['user-agent'], 200)],
  );
  addCookie(c.res, COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: isSecure(c.req) });
}
async function endSession(c) {
  const t = c.cookies[COOKIE];
  if (t) await db.query('delete from sessions where token_hash = $1', [sha256(t)]);
  addCookie(c.res, COOKIE, '', { maxAge: 0, secure: isSecure(c.req) });
}
/** cookie → идэвхтэй бүртгэл | null */
async function sessionUser(c) {
  const t = c.cookies[COOKIE];
  if (!t || t.length > 100) return null;
  const { rows } = await db.query(
    `select a.*, s.token_hash as sid from sessions s join accounts a on a.id = s.account_id
     where s.token_hash = $1 and s.expires_at > now() and a.status = 'active'`,
    [sha256(t)],
  );
  return rows[0] || null;
}

/* ---------- оролдлогын хязгаар ---------- */
/** Түлхүүр бүрийн бүтэлгүй оролдлого max-д хүрсэн бол 429 */
async function limitCheck(keys, max) {
  const { rows } = await db.query(
    'select key, n from rate_limits where key = any($1) and reset_at > now()',
    [keys],
  );
  for (const r of rows) {
    const i = keys.indexOf(r.key);
    if (r.n >= max[i])
      throw new HttpError(429, 'Хэт олон оролдлого хийлээ. 15 минутын дараа дахин оролдоно уу.');
  }
}
async function limitHit(keys, sec = 900) {
  for (const k of keys)
    await db.query(
      `insert into rate_limits (key, n, reset_at) values ($1, 1, now() + $2 * interval '1 second')
       on conflict (key) do update set
         n = case when rate_limits.reset_at <= now() then 1 else rate_limits.n + 1 end,
         reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end`,
      [k, sec],
    );
}
const limitClear = (key) => db.query('delete from rate_limits where key = $1', [key]);

/** Бүртгэлийг client-д буцаах хэлбэр (нууц үггүй; хуучин frontend-ийн талбарын нэртэй) */
function pub(a) {
  if (!a) return null;
  return {
    id: a.id,
    role: a.role,
    cx: a.cx_id,
    login: a.login,
    name: a.name,
    phone: a.phone,
    status: a.status,
    unit_id: a.unit_id,
    b: a.b,
    u: a.u,
    fam: a.fam,
    pos: a.pos,
    cats: a.cats || [],
    note: a.note,
    at: a.created_at ? new Date(a.created_at).getTime() : null,
    by: a.decided_by || a.created_by || '',
    dAt: a.decided_at ? new Date(a.decided_at).getTime() : null,
  };
}

/** Эрх бүрийн зөвшөөрөл (frontend-ийн js/api.js RIGHTS-тэй ижил) */
const RIGHTS = {
  admin: ['editLayout', 'assignSlot', 'finance', 'viewAll'],
  staff: ['viewAll'],
  resident: [],
};

module.exports = {
  COOKIE,
  ROLES,
  RIGHTS,
  hashPw,
  verifyPw,
  dummy,
  checkPw,
  checkPhone,
  loginKey,
  createSession,
  endSession,
  sessionUser,
  limitCheck,
  limitHit,
  limitClear,
  pub,
};
