/*
 * Хуучин JSON файлуудыг (server/data/layouts.json, accounts.json) өгөгдлийн сан руу шилжүүлнэ.
 *   node server/import-json.js [хавтас]       (default: server/data)
 * Нууц үгийн хуучин hash хэвээр орно — хэрэглэгч анх нэвтрэхэд scrypt болж шинэчлэгдэнэ.
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const A = require('./lib/auth');
const C = require('./lib/core');
const Y = require('./lib/layout');

const DIR = process.argv[2] || path.join(__dirname, 'data');
const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  } catch (e) {
    return [];
  }
};

async function main() {
  await db.ready();
  const layouts = read('layouts.json');
  const accounts = read('accounts.json');
  const byId = new Map(layouts.map((L) => [L.id, L]));
  const ids = new Set([...layouts.map((L) => L.id), ...accounts.map((a) => a.cx)]);
  let nc = 0,
    na = 0;
  await db.tx(async (q) => {
    for (const id of ids) {
      const L = byId.get(id) || Y.original(id);
      if (!L) {
        console.warn('Map олдсонгүй, алгаслаа:', id);
        continue;
      }
      const ex = await q('select 1 from complexes where id = $1', [id]);
      if (!ex.rows.length) {
        await q(
          'insert into complexes (id, name, sokh, district, color, layout) values ($1, $2, $3, $4, $5, $6::jsonb)',
          [id, L.n || id, L.sokh || '', L.d || '', L.c || '#0A72B8', byId.has(id) ? JSON.stringify(L) : null],
        );
        nc++;
      } else if (byId.has(id)) await q('update complexes set layout = $2::jsonb where id = $1', [id, JSON.stringify(L)]);
      await C.syncLayout(q, id, L, C.DEFAULTS.invoice.fee);
    }
    for (const a of accounts) {
      if (!ids.has(a.cx)) continue;
      const unit = a.role === 'resident' && a.status === 'active' ? await C.unitByBN(q, a.cx, a.b, a.u) : null;
      const r = await q(
        `insert into accounts (id, cx_id, role, login, login_key, name, phone, pw, status, unit_id, b, u, fam, pos,
           note, created_at, created_by, decided_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, to_timestamp($16 / 1000.0), $17, $17)
         on conflict do nothing`,
        [a.id, a.cx, a.role, a.login, A.loginKey(a.role, a.login), a.name, a.phone || '', a.pw, a.status || 'active',
          unit ? unit.id : null, a.b || null, a.u || null, a.fam || null, a.pos || '', a.note || '', a.at || Date.now(), a.by || ''],
      );
      na += r.affectedRows != null ? r.affectedRows : r.rowCount;
    }
  });
  console.log('Хотхон: ' + nc + ', бүртгэл: ' + na + ' шилжлээ');
  await db.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
