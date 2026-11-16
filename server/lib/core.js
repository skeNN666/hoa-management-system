/*
 * Хотхоны нийтлэг логик: тохиргоо, map → айл/зогсоол/гэрэл, хувилбар (ver), audit,
 * ажилтан сонгох, хийсэн ажил бүртгэх, файл хадгалах.
 */
const { derive, original } = require('./layout');
const { next, pad, local, rid, bad, notFound } = require('./util');

const DEFAULTS = {
  invoice: {
    auto: true,
    day: 1, // сар бүрийн хэдэнд нэхэмжлэх
    time: '09:00',
    due: 10, // сарын хэдний дотор төлөх
    remBefore: true, // хугацаанаас 3 хоногийн өмнө сануулах
    remAfter: true, // хугацаа хэтэрсний маргааш сануулах
    remSms: true,
    fee: 85000, // шинэ айлын анхны сарын хураамж
  },
  sla: 30, // хүсэлтийг хүлээн авах хугацаа (минут)
  fund: { opening: 0, since: '' }, // сангийн эхний үлдэгдэл, аль сараас
  leak: { autoClose: true },
  park: { holdMin: 10, offerMin: 5 },
};
function merge(a, b) {
  const o = Array.isArray(a) ? a.slice() : { ...a };
  for (const k in b || {})
    o[k] =
      b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object'
        ? merge(a[k], b[k])
        : b[k];
  return o;
}
const settingsOf = (cx) => merge(DEFAULTS, (cx && cx.settings) || {});

async function getComplex(q, id, lock) {
  const { rows } = await q(
    'select * from complexes where id = $1' + (lock ? ' for update' : ''),
    [id],
  );
  if (!rows[0]) throw notFound('Хотхон олдсонгүй');
  return rows[0];
}
/** Хотхоны map: засварласан эсвэл кодонд байгаа анхных */
const layoutOf = (cx) => cx.layout || original(cx.id);

/** Өөрчлөлт бүрийн дараа: client-ууд шинэчлэгдэх дохио */
const touch = (q, cx) => q('update complexes set ver = ver + 1 where id = $1', [cx]);

/**
 * map-аас айл, зогсоол, гэрлийг DB-тэй тааруулна. Map-аас хасагдсан айл, зогсоолыг устгахгүй
 * (нэхэмжлэл, түрээсийн түүх үлдэнэ) — active=false болгоно.
 */
async function syncLayout(q, cx, L, fee) {
  const d = derive(L);
  await q(
    `insert into units (cx_id, b, n, floor, fee)
     select $1, (u->>'b')::int, (u->>'n')::int, (u->>'floor')::int, $3
     from jsonb_array_elements($2::jsonb) u
     on conflict (cx_id, b, n) do update set floor = excluded.floor, active = true`,
    [cx, JSON.stringify(d.units), fee],
  );
  await q(
    `update units set active = false where cx_id = $1 and active and (b, n) not in
     (select (u->>'b')::int, (u->>'n')::int from jsonb_array_elements($2::jsonb) u)`,
    [cx, JSON.stringify(d.units)],
  );
  await q(
    `insert into slots (cx_id, id, zone)
     select $1, s->>'id', s->>'zone' from jsonb_array_elements($2::jsonb) s
     on conflict (cx_id, id) do update set zone = excluded.zone, active = true`,
    [cx, JSON.stringify(d.slots)],
  );
  await q('update slots set active = false where cx_id = $1 and not (id = any($2))', [
    cx,
    d.slots.map((s) => s.id),
  ]);
  await q(
    `insert into lights (cx_id, id, loc, x, z)
     select $1, l->>'id', l->>'loc', (l->>'x')::real, (l->>'z')::real
     from jsonb_array_elements($2::jsonb) l
     on conflict (cx_id, id) do update set loc = excluded.loc, x = excluded.x, z = excluded.z`,
    [cx, JSON.stringify(d.lights)],
  );
  await q('delete from lights where cx_id = $1 and not (id = any($2))', [
    cx,
    d.lights.map((l) => l.id),
  ]);
  return { units: d.units.length, slots: d.slots.length, lights: d.lights.length };
}

async function audit(q, c, action, entity, entityId, data) {
  const u = c && c.me;
  await q(
    `insert into audit_log (cx_id, account_id, action, entity, entity_id, data, ip)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      (u && u.cx_id) || (data && data.cx) || null,
      u ? u.id : null,
      action,
      entity || '',
      String(entityId == null ? '' : entityId),
      JSON.stringify(data || {}),
      (c && c.ip) || '',
    ],
  );
}

/** Айл (b, n) → units мөр */
async function unitByBN(q, cx, b, n) {
  const { rows } = await q('select * from units where cx_id = $1 and b = $2 and n = $3 and active', [
    cx,
    b,
    n,
  ]);
  return rows[0] || null;
}

/** Тухайн ангиллын хамгийн бага ачаалалтай идэвхтэй ажилтан */
async function pickStaff(q, cx, cat) {
  const { rows } = await q(
    `select a.id, a.name, count(r.id)::int as busy from accounts a
     left join requests r on r.assignee_id = a.id and r.status between 1 and 3
     where a.cx_id = $1 and a.role = 'staff' and a.status = 'active' and $2 = any(a.cats)
     group by a.id order by busy, a.created_at limit 1`,
    [cx, cat],
  );
  return rows[0] || null;
}

/** Хийсэн ажлыг тухайн сарын тайланд бүртгэнэ */
async function logWork(q, cx, { cat, title, location, by, source = 'staff', request_id = null }) {
  const L = local();
  const code = 'WK-' + (await next(q, cx, 'work', 201));
  await q(
    `insert into works (cx_id, code, month, date, cat, title, location, by_name, source, request_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [cx, code, L.month, L.date, cat, title, location || '', by || '', source, request_id],
  );
  return code;
}

/* ---------- файл ---------- */
const MAX_FILE = 4 * 1024 * 1024;
function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}
/** Зураг хадгална (PNG / JPEG / WebP, ≤ 4MB) → { id, url } */
async function saveFile(q, cx, buf, by, isPublic) {
  if (!buf || !buf.length) throw bad('Зураг хоосон байна');
  if (buf.length > MAX_FILE) throw bad('Зураг 4MB-аас бага байна');
  const mime = sniff(buf);
  if (!mime) throw bad('Зөвхөн PNG, JPEG, WebP зураг');
  const id = rid(16);
  await q(
    'insert into files (id, cx_id, mime, size, data, public, created_by) values ($1, $2, $3, $4, $5, $6, $7)',
    [id, cx, mime, buf.length, buf, !!isPublic, by || ''],
  );
  return { id, url: 'api/files/' + id, mime, size: buf.length };
}

const unitLabel = (b, n) => b + '-р байр ' + n + ' тоот';

module.exports = {
  DEFAULTS,
  merge,
  settingsOf,
  getComplex,
  layoutOf,
  touch,
  syncLayout,
  audit,
  unitByBN,
  pickStaff,
  logWork,
  saveFile,
  MAX_FILE,
  unitLabel,
  pad,
};
