/* Нийтлэг туслах функцууд: цаг (Улаанбаатар), алдаа, id, тоолуур, шалгалт */
const crypto = require('crypto');

const TZ = 'Asia/Ulaanbaatar';
const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
/** Улаанбаатарын цагаар: { y, m, d, h, mi, month: 'YYYY-MM', date: 'YYYY-MM-DD', hm: 'HH:MM' } */
function local(t = new Date()) {
  const p = {};
  for (const x of FMT.formatToParts(t)) p[x.type] = x.value;
  const h = String(Number(p.hour) % 24).padStart(2, '0');
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(h),
    mi: Number(p.minute),
    month: p.year + '-' + p.month,
    date: p.year + '-' + p.month + '-' + p.day,
    hm: h + ':' + p.minute,
  };
}
const month = (t) => local(t).month;
const today = (t) => local(t).date;
/** 'YYYY-MM-DD' + n хоног */
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** 'YYYY-MM' + n сар */
function addMonths(mon, n) {
  const [y, m] = mon.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}
const monthLabel = (mon) => Number(mon.slice(5, 7)) + '-р сар';
const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ''));
const money = (n) => '₮' + Math.round(Number(n) || 0).toLocaleString('en-US');

class HttpError extends Error {
  constructor(status, msg, extra) {
    super(msg);
    this.status = status;
    this.extra = extra || {};
  }
}
const bad = (msg, extra) => new HttpError(400, msg, extra);
const forbid = (msg = 'Эрх хүрэхгүй байна') => new HttpError(403, msg);
const notFound = (msg = 'Олдсонгүй') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

const rid = (n = 12) => crypto.randomBytes(n).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
/** Тогтмол хугацаанд харьцуулна (timing attack-аас хамгаална) */
function safeEq(a, b) {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Хотхон бүрийн дугаарлалт (REQ-1052, LK-0431 …) — atomic */
async function next(q, cx, name, start) {
  const { rows } = await q(
    `insert into counters (cx_id, name, n) values ($1, $2, $3)
     on conflict (cx_id, name) do update set n = counters.n + 1 returning n`,
    [cx, name, start],
  );
  return rows[0].n;
}
const pad = (n, w = 2) => String(n).padStart(w, '0');

const clean = (s, max = 500) =>
  String(s == null ? '' : s)
    .trim()
    .slice(0, max);
const digits = (s) => String(s == null ? '' : s).replace(/\D/g, '');
/** Бүхэл тоо шалгана: int(v, 1, 30) → тоо эсвэл null */
function int(v, min = -Infinity, max = Infinity) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
/** Мөнгөн дүн: "₮1,200,000" → 1200000 */
const amount = (v) => {
  const n = Number(String(v == null ? '' : v).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
/** "5-34" → { b: 5, n: 34 } */
function unitKey(s) {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(s || '').trim());
  return m ? { b: Number(m[1]), n: Number(m[2]) } : null;
}

module.exports = {
  TZ,
  local,
  month,
  today,
  addDays,
  addMonths,
  monthLabel,
  isMonth,
  money,
  HttpError,
  bad,
  forbid,
  notFound,
  conflict,
  rid,
  sha256,
  safeEq,
  next,
  pad,
  clean,
  digits,
  int,
  amount,
  unitKey,
};
