/*
 * 2. Хотхон · 3. Map · 4. Байр, айл · 12. Файл, audit
 *   GET   /api/complexes                 нийтэд: хотхоны жагсаалт (login хуудас)
 *   PATCH /api/complexes/:id             (админ) нэр, СӨХ, дүүрэг, өнгө
 *   GET   /api/settings  · PUT /api/settings      (админ) нэхэмжлэл, SLA, сан, ус алдалт, зогсоол
 *   GET   /api/layouts                   засварласан бүх map (нийтэд — login, 3D харагдац)
 *   PUT   /api/layouts/:id               (тухайн хотхоны админ) map хадгалах → айл/зогсоол/гэрэл шинэчлэгдэнэ
 *   DELETE /api/layouts/:id              анхны map руу буцаах
 *   POST  /api/files?public=1            зураг upload (body = зураг) → { id, url }
 *   GET   /api/files/:id
 *   GET   /api/units?b=&q=&debt=1        (админ, ажилтан) айлууд + өр, төлөв
 *   GET   /api/units/:id                 (админ) айлын дэлгэрэнгүй
 *   PATCH /api/units/:id                 (админ) эзэн, түрээслэгч, утас, дугаар, хураамж
 *   GET   /api/audit                     (админ)
 */
const db = require('../db');
const C = require('../lib/core');
const Y = require('../lib/layout');
const { bad, forbid, notFound, clean, digits, int, month, isMonth } = require('../lib/util');

/** Айлуудыг өр, төлөвтэй нь: st 0 төлсөн · 1 өмнөх өртэй · 2 энэ сарын төлбөр төлөөгүй */
async function unitRows(q, cx, where = '', params = []) {
  const cur = month();
  const { rows } = await q(
    `select u.*,
       coalesce(sum(i.amount - i.paid) filter (where i.status = 'unpaid' and i.month < $2), 0)::int as prev,
       coalesce(sum(i.amount - i.paid) filter (where i.status = 'unpaid' and i.month = $2), 0)::int as cur,
       (select string_agg(a.name, ', ') from accounts a
         where a.unit_id = u.id and a.status = 'active') as residents
     from units u left join invoices i on i.unit_id = u.id
     where u.cx_id = $1 and u.active ${where}
     group by u.id order by u.b, u.n`,
    [cx, cur].concat(params),
  );
  return rows.map((u) => ({ ...u, debt: u.prev + u.cur, st: u.prev > 0 ? 1 : u.cur > 0 ? 2 : 0 }));
}

module.exports = (on) => {
  on('GET', '/api/complexes', async () => {
    const { rows } = await db.query(
      `select c.id, c.name, c.sokh, c.district, c.color,
         (select count(*)::int from units u where u.cx_id = c.id and u.active) as units
       from complexes c order by c.created_at, c.id`,
    );
    return rows;
  });

  on('PATCH', '/api/complexes/:id', async (c) => {
    const me = await c.need('admin');
    if (me.cx_id !== c.params.id) throw forbid('Зөвхөн өөрийн хотхоныг өөрчилнө');
    const x = await c.json();
    return db.tx(async (q) => {
      const cx = await C.getComplex(q, me.cx_id, true);
      const v = {
        name: x.name !== undefined ? clean(x.name, 80) : cx.name,
        sokh: x.sokh !== undefined ? clean(x.sokh, 80) : cx.sokh,
        district: x.district !== undefined ? clean(x.district, 40) : cx.district,
        color: x.color !== undefined ? String(x.color) : cx.color,
      };
      if (!v.name || !v.sokh) throw bad('Нэр хоосон байна');
      if (!/^#[0-9a-fA-F]{6}$/.test(v.color)) throw bad('Өнгө буруу (#RRGGBB)');
      const dup = await q('select 1 from complexes where lower(name) = lower($1) and id <> $2', [v.name, cx.id]);
      if (dup.rows.length) throw bad('Ийм нэртэй хотхон бүртгэлтэй байна');
      // map доторх нэр, өнгийг ч шинэчилнэ (frontend map-аас уншдаг)
      const L = Object.assign(C.layoutOf(cx) || {}, { n: v.name, sokh: v.sokh, d: v.district, c: v.color });
      await q(
        'update complexes set name = $2, sokh = $3, district = $4, color = $5, layout = $6::jsonb where id = $1',
        [cx.id, v.name, v.sokh, v.district, v.color, JSON.stringify(L)],
      );
      await C.audit(q, c, 'complex.update', 'complex', cx.id, v);
      await C.touch(q, cx.id);
      return { ok: true, msg: 'Хадгаллаа', complex: { id: cx.id, ...v } };
    });
  });

  /* ---------- тохиргоо ---------- */
  on('GET', '/api/settings', async (c) => {
    const me = await c.need('admin');
    return C.settingsOf(await C.getComplex(db.query, me.cx_id));
  });
  on('PUT', '/api/settings', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    return db.tx(async (q) => {
      const cx = await C.getComplex(q, me.cx_id, true);
      const s = C.settingsOf(cx);
      const set = {};
      if (x.invoice) {
        const i = x.invoice,
          o = { ...s.invoice };
        if (i.auto !== undefined) o.auto = !!i.auto;
        if (i.day !== undefined && !(o.day = int(i.day, 1, 28))) throw bad('Нэхэмжлэх өдөр 1–28');
        if (i.due !== undefined && !(o.due = int(i.due, 1, 28))) throw bad('Төлөх хугацаа 1–28');
        if (i.time !== undefined) {
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time)) throw bad('Цаг буруу (ЦЦ:ММ)');
          o.time = i.time;
        }
        ['remBefore', 'remAfter', 'remSms'].forEach((k) => i[k] !== undefined && (o[k] = !!i[k]));
        if (i.fee !== undefined && (o.fee = int(i.fee, 0, 10000000)) === null) throw bad('Хураамж буруу');
        set.invoice = o;
      }
      if (x.sla !== undefined && !(set.sla = int(x.sla, 5, 24 * 60))) throw bad('SLA 5–1440 минут');
      if (x.fund) {
        const o = { ...s.fund };
        if (x.fund.opening !== undefined && (o.opening = int(x.fund.opening, -1e10, 1e10)) === null)
          throw bad('Үлдэгдэл буруу');
        if (x.fund.since !== undefined) {
          if (!isMonth(x.fund.since)) throw bad('Сар буруу (YYYY-MM)');
          o.since = x.fund.since;
        }
        set.fund = o;
      }
      if (x.leak && x.leak.autoClose !== undefined) set.leak = { autoClose: !!x.leak.autoClose };
      if (x.park) {
        const o = { ...s.park };
        if (x.park.holdMin !== undefined && !(o.holdMin = int(x.park.holdMin, 1, 60))) throw bad('1–60 минут');
        if (x.park.offerMin !== undefined && !(o.offerMin = int(x.park.offerMin, 1, 60))) throw bad('1–60 минут');
        set.park = o;
      }
      const next = C.merge(cx.settings || {}, set);
      await q('update complexes set settings = $2::jsonb where id = $1', [cx.id, JSON.stringify(next)]);
      await C.audit(q, c, 'settings.update', 'complex', cx.id, set);
      await C.touch(q, cx.id);
      return C.settingsOf({ settings: next });
    });
  });

  /* ---------- map ---------- */
  on('GET', '/api/layouts', async () => {
    const { rows } = await db.query('select layout from complexes where layout is not null order by created_at');
    return rows.map((r) => r.layout);
  });
  on('PUT', '/api/layouts/:id', async (c) => {
    const me = await c.need();
    if (me.role !== 'admin') throw forbid('Map засах эрх зөвхөн админд байна');
    if (me.cx_id !== c.params.id) throw forbid('Зөвхөн өөрийн хотхоны map-ыг өөрчилнө');
    const L = await c.json(6 * 1024 * 1024);
    const err = Y.validate(L, c.params.id);
    if (err) throw bad(err);
    return db.tx(async (q) => {
      const cx = await C.getComplex(q, me.cx_id, true);
      await q('update complexes set layout = $2::jsonb where id = $1', [cx.id, JSON.stringify(L)]);
      const n = await C.syncLayout(q, cx.id, L, C.settingsOf(cx).invoice.fee);
      await C.audit(q, c, 'layout.save', 'complex', cx.id, n);
      await C.touch(q, cx.id);
      return { ok: true, msg: 'Хадгаллаа', ...n };
    });
  });
  on('DELETE', '/api/layouts/:id', async (c) => {
    const me = await c.need();
    if (me.role !== 'admin') throw forbid('Map засах эрх зөвхөн админд байна');
    if (me.cx_id !== c.params.id) throw forbid('Зөвхөн өөрийн хотхоны map-ыг өөрчилнө');
    const L = Y.original(me.cx_id);
    if (!L) throw bad('Энэ хотхонд анхны map байхгүй — map-аа засаж хадгална уу');
    return db.tx(async (q) => {
      const cx = await C.getComplex(q, me.cx_id, true);
      await q('update complexes set layout = null where id = $1', [cx.id]);
      await C.syncLayout(q, cx.id, L, C.settingsOf(cx).invoice.fee);
      await C.audit(q, c, 'layout.reset', 'complex', cx.id);
      await C.touch(q, cx.id);
      return { ok: true, msg: 'Анхны map руу буцлаа' };
    });
  });

  /* ---------- файл ---------- */
  on('POST', '/api/files', async (c) => {
    const me = await c.need();
    const pub = c.query.public === '1';
    if (pub && me.role !== 'admin') throw forbid('Нийтийн зургийг зөвхөн админ оруулна');
    const buf = await c.raw(C.MAX_FILE + 1);
    return C.saveFile(db.query, me.cx_id, buf, me.login, pub);
  });
  on('GET', '/api/files/:id', async (c) => {
    const { rows } = await db.query('select * from files where id = $1', [c.params.id]);
    const f = rows[0];
    if (!f) throw notFound();
    if (!f.public) {
      const me = await c.need();
      if (me.cx_id !== f.cx_id) throw notFound();
    }
    c.res.writeHead(200, {
      'Content-Type': f.mime,
      'Content-Length': f.size,
      'Cache-Control': (f.public ? 'public' : 'private') + ', max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    c.res.end(Buffer.from(f.data));
  });

  /* ---------- айл, оршин суугч ---------- */
  on('GET', '/api/units', async (c) => {
    const me = await c.need('admin', 'staff');
    const w = [],
      p = [];
    const add = (sql, v) => (p.push(v), w.push(sql.replace('?', '$' + (p.length + 2))));
    if (c.query.b) add('and u.b = ?', int(c.query.b, 1) || 0);
    const qs = clean(c.query.q, 60);
    if (qs) {
      const k = /^(\d+)\s*-\s*(\d+)$/.exec(qs);
      if (k) {
        add('and u.b = ?', Number(k[1]));
        add('and u.n = ?', Number(k[2]));
      } else
        add(
          `and (u.owner ilike ? or u.tenant ilike $X or u.phone like $X or u.plate ilike $X)`.replace(
            /\$X/g,
            '$' + (p.length + 3),
          ),
          '%' + qs.replace(/[%_]/g, '') + '%',
        );
    }
    let rows = await unitRows(db.query, me.cx_id, w.join(' '), p);
    if (c.query.debt === '1') rows = rows.filter((u) => u.debt > 0);
    if (me.role !== 'admin') rows = rows.map(({ fee, prev, cur, debt, st, ...u }) => u); // ажилтан төлбөр харахгүй
    return rows;
  });

  on('GET', '/api/units/:id', async (c) => {
    const me = await c.need('admin');
    const [u] = await unitRows(db.query, me.cx_id, 'and u.id = $3', [int(c.params.id, 1) || 0]);
    if (!u) throw notFound('Айл олдсонгүй');
    const [inv, pays, accs, rent, rem] = await Promise.all([
      db.query('select * from invoices where unit_id = $1 order by month desc limit 12', [u.id]),
      db.query('select * from payments where unit_id = $1 order by created_at desc limit 20', [u.id]),
      db.query("select id, name, phone, status, fam from accounts where unit_id = $1 and role = 'resident'", [u.id]),
      db.query('select * from slot_rentals where unit_id = $1 and end_at is null', [u.id]),
      db.query('select * from reminders where unit_id = $1 order by id desc limit 5', [u.id]),
    ]);
    return {
      ...u,
      invoices: inv.rows,
      payments: pays.rows,
      accounts: accs.rows,
      rental: rent.rows[0] || null,
      reminders: rem.rows,
    };
  });

  on('PATCH', '/api/units/:id', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const set = {};
    ['owner', 'tenant', 'plate'].forEach((k) => x[k] !== undefined && (set[k] = clean(x[k], 80)));
    if (x.phone !== undefined) {
      set.phone = digits(x.phone);
      if (set.phone && !/^\d{8}$/.test(set.phone)) throw bad('Утасны дугаар 8 оронтой байна');
    }
    if (x.fee !== undefined && (set.fee = int(x.fee, 0, 10000000)) === null) throw bad('Хураамж буруу');
    const keys = Object.keys(set);
    if (!keys.length) throw bad('Өөрчлөх зүйл алга');
    return db.tx(async (q) => {
      const r = await q(
        `update units set ${keys.map((k, i) => k + ' = $' + (i + 3)).join(', ')}
         where id = $1 and cx_id = $2 returning *`,
        [int(c.params.id, 1) || 0, me.cx_id].concat(keys.map((k) => set[k])),
      );
      if (!r.rows[0]) throw notFound('Айл олдсонгүй');
      await C.audit(q, c, 'unit.update', 'unit', r.rows[0].id, set);
      await C.touch(q, me.cx_id);
      return { ok: true, msg: 'Хадгаллаа', unit: r.rows[0] };
    });
  });

  on('GET', '/api/audit', async (c) => {
    const me = await c.need('admin');
    const { rows } = await db.query(
      `select l.*, a.name as who from audit_log l left join accounts a on a.id = l.account_id
       where l.cx_id = $1 order by l.id desc limit $2`,
      [me.cx_id, int(c.query.limit, 1, 500) || 100],
    );
    return rows;
  });
};

module.exports.unitRows = unitRows;
