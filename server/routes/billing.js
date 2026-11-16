/*
 * 5. Төлбөр ба нэхэмжлэл
 *   POST /api/invoices/run                (админ) { month? } нэхэмжлэл одоо илгээх
 *   GET  /api/invoices?month=&unit=       админ: бүгд · оршин суугч: өөрийн айлынх
 *   GET  /api/billing/summary?month=      (админ) нэхэмжилсэн, хураасан, хувь, өр
 *   GET  /api/me/bill                     (оршин суугч) төлөх дүн, нэхэмжлэл, түрээс
 *   POST /api/payments                    (оршин суугч) { channel } → QPay нэхэмжлэх (QR, банкны холбоос)
 *   GET  /api/payments?limit=             админ: орж ирсэн төлбөр · оршин суугч: өөрийнх
 *   GET  /api/payments/:id                төлөв (pending бол provider-оос шалгана)
 *   GET|POST /api/pay/qpay/callback?pid=  QPay callback (нээлттэй; QPay API-аар дахин шалгана)
 *   POST /api/payments/:id/mock-confirm   хөгжүүлэлтэд л
 *   POST /api/payments/manual             (админ) { unit | unit_id, amount, channel, payer } бэлэн/шилжүүлэг
 *   POST /api/reminders                   (админ) { unit_id } | { all: true }
 */
const db = require('../db');
const C = require('../lib/core');
const B = require('../lib/billing');
const Pay = require('../lib/pay');
const { flush } = require('../lib/notify');
const { bad, forbid, notFound, HttpError, clean, int, amount, unitKey, month, isMonth, monthLabel, money } = require('../lib/util');

const CHANNELS = ['QPay', 'SocialPay', 'Хаан банк', 'Голомт банк', 'ХасБанк'];
const MANUAL = ['Бэлэн', 'Дансны шилжүүлэг', 'Хаан банк', 'Голомт банк', 'ХасБанк', 'Төрийн банк', 'Бусад'];

async function summary(q, cx, mon) {
  const { rows } = await q(
    `select
       coalesce(sum(amount) filter (where month = $2 and status <> 'void'), 0)::float8 as billed,
       coalesce(sum(least(paid, amount)) filter (where month = $2 and status <> 'void'), 0)::float8 as billed_paid,
       coalesce(sum(amount - paid) filter (where status = 'unpaid' and month <= $2), 0)::float8 as debt,
       count(distinct unit_id) filter (where status = 'unpaid' and month <= $2 and amount > paid)::int as debtors,
       count(*) filter (where month = $2)::int as invoices
     from invoices where cx_id = $1`,
    [cx, mon],
  );
  const col = await q(
    "select coalesce(sum(amount), 0)::float8 as s, count(*)::int as n from payments where cx_id = $1 and status = 'paid' and month = $2",
    [cx, mon],
  );
  const r = rows[0];
  return { month: mon, ...r, rate: r.billed ? r.billed_paid / r.billed : 1, collected: col.rows[0].s, payments: col.rows[0].n };
}

/** Төлбөрийг харах эрх: админ → хотхоных; оршин суугч → өөрийн айлынх */
async function loadPayment(c, me) {
  const { rows } = await db.query('select * from payments where id = $1 and cx_id = $2', [int(c.params.id, 1) || 0, me.cx_id]);
  const p = rows[0];
  if (!p || (me.role === 'resident' && p.unit_id !== me.unit_id) || me.role === 'staff') throw notFound('Төлбөр олдсонгүй');
  return p;
}
const view = (p) => ({ ...p, qr: p.provider_data && p.provider_data.qr_text ? p.provider_data : undefined });

/** pending төлбөрийг provider-оос шалгаад төлөгдсөн бол баталгаажуулна */
async function refresh(p) {
  if (p.status !== 'pending' || p.provider !== 'qpay') return p;
  const r = await Pay.check(p);
  return r.paid ? (await B.settle(p.id, r.data)) || p : p;
}

module.exports = (on) => {
  on('POST', '/api/invoices/run', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const mon = x.month || month();
    if (!isMonth(mon)) throw bad('Сар буруу (YYYY-MM)');
    const n = await db.tx(async (q) => B.generate(q, await C.getComplex(q, me.cx_id, true), mon));
    await C.audit(db.query, c, 'invoice.run', 'invoice', mon, { n });
    return { ok: true, n, msg: n ? monthLabel(mon) + ' · ' + n + ' айлд нэхэмжлэл илгээгдлээ' : 'Шинэ нэхэмжлэл үүссэнгүй (аль хэдийн илгээсэн)' };
  });

  on('GET', '/api/invoices', async (c) => {
    const me = await c.need('admin', 'resident');
    const p = [me.cx_id];
    let w = '';
    if (me.role === 'resident') {
      if (!me.unit_id) return [];
      w += ' and i.unit_id = $' + p.push(me.unit_id);
    } else if (c.query.unit) w += ' and i.unit_id = $' + p.push(int(c.query.unit, 1) || 0);
    if (c.query.month) {
      if (!isMonth(c.query.month)) throw bad('Сар буруу');
      w += ' and i.month = $' + p.push(c.query.month);
    }
    if (c.query.status) w += ' and i.status = $' + p.push(clean(c.query.status, 10));
    const { rows } = await db.query(
      `select i.*, u.b, u.n from invoices i join units u on u.id = i.unit_id
       where i.cx_id = $1 ${w} order by i.month desc, u.b, u.n limit $${p.push(int(c.query.limit, 1, 5000) || 2000)}`,
      p,
    );
    return rows;
  });

  on('GET', '/api/billing/summary', async (c) => {
    const me = await c.need('admin');
    const mon = c.query.month || month();
    if (!isMonth(mon)) throw bad('Сар буруу');
    return summary(db.query, me.cx_id, mon);
  });

  on('GET', '/api/me/bill', async (c) => {
    const me = await c.need('resident');
    if (!me.unit_id) throw bad('Таны бүртгэл айлтай холбогдоогүй байна');
    const [d, inv, rent] = await Promise.all([
      B.dueOf(db.query, me.unit_id),
      db.query('select * from invoices where unit_id = $1 order by month desc limit 12', [me.unit_id]),
      db.query('select slot_id, fee from slot_rentals where unit_id = $1 and end_at is null', [me.unit_id]),
    ]);
    return { due: d.due, invoices: inv.rows, rental: rent.rows[0] || null, provider: Pay.provider() };
  });

  /* ---------- төлөх ---------- */
  on('POST', '/api/payments', async (c) => {
    const me = await c.need('resident');
    if (!me.unit_id) throw bad('Таны бүртгэл айлтай холбогдоогүй байна');
    const x = await c.json();
    const channel = CHANNELS.includes(x.channel) ? x.channel : 'QPay';
    if (!Pay.provider()) throw new HttpError(503, 'Төлбөрийн систем түр ажиллахгүй байна');
    const { due } = await B.dueOf(db.query, me.unit_id);
    if (!due) throw bad('Төлөх төлбөр байхгүй байна');
    // 30 минутын дотор ижил дүнтэй хүлээгдэж буй нэхэмжлэх байвал түүнийг буцаана
    const old = await db.query(
      `select * from payments where unit_id = $1 and status = 'pending' and amount = $2
       and created_at > now() - interval '30 minutes' order by id desc limit 1`,
      [me.unit_id, due],
    );
    if (old.rows[0]) return view(old.rows[0]);
    const { rows } = await db.query(
      `insert into payments (cx_id, unit_id, amount, channel, provider, payer, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [me.cx_id, me.unit_id, due, channel, Pay.provider(), me.name, me.id],
    );
    const p = rows[0];
    const unit = (await db.query('select * from units where id = $1', [me.unit_id])).rows[0];
    try {
      const r = await Pay.create(p, {
        description: 'СӨХ-ийн төлбөр · ' + C.unitLabel(unit.b, unit.n),
        receiver: unit.b + '-' + unit.n,
        callbackUrl: c.base() + '/api/pay/qpay/callback?pid=' + p.id,
      });
      const u = await db.query(
        'update payments set provider = $2, provider_ref = $3, provider_data = $4::jsonb where id = $1 returning *',
        [p.id, r.kind, r.ref, JSON.stringify(r.data)],
      );
      return view(u.rows[0]);
    } catch (e) {
      await db.query("update payments set status = 'failed', provider_data = $2::jsonb where id = $1", [
        p.id,
        JSON.stringify({ error: String(e.message || e) }),
      ]);
      throw new HttpError(502, 'Төлбөрийн системтэй холбогдож чадсангүй. Дахин оролдоно уу.');
    }
  });

  on('GET', '/api/payments', async (c) => {
    const me = await c.need('admin', 'resident');
    const p = [me.cx_id];
    let w = '';
    if (me.role === 'resident') {
      if (!me.unit_id) return [];
      w = ' and p.unit_id = $' + p.push(me.unit_id);
    } else w = " and p.status = 'paid'";
    const { rows } = await db.query(
      `select p.id, p.amount, p.channel, p.status, p.payer, p.month, p.created_at, p.paid_at, p.ebarimt,
         u.b, u.n, i.code as inv
       from payments p left join units u on u.id = p.unit_id
       left join lateral (select code from invoices where unit_id = p.unit_id order by month desc limit 1) i on true
       where p.cx_id = $1 ${w} order by coalesce(p.paid_at, p.created_at) desc limit $${p.push(int(c.query.limit, 1, 500) || 50)}`,
      p,
    );
    return rows;
  });

  on('GET', '/api/payments/:id', async (c) => {
    const me = await c.need('admin', 'resident');
    return view(await refresh(await loadPayment(c, me)));
  });

  const callback = async (c) => {
    const { rows } = await db.query("select * from payments where id = $1 and provider = 'qpay'", [int(c.query.pid, 1) || 0]);
    if (rows[0]) await refresh(rows[0]);
    return { ok: true };
  };
  on('GET', '/api/pay/qpay/callback', callback);
  on('POST', '/api/pay/qpay/callback', callback, { open: true });

  on('POST', '/api/payments/:id/mock-confirm', async (c) => {
    const me = await c.need('admin', 'resident');
    if (Pay.provider() !== 'mock') throw forbid('Зөвхөн туршилтын горимд');
    const p = await loadPayment(c, me);
    if (p.provider !== 'mock') throw bad('Туршилтын төлбөр биш');
    return view((await B.settle(p.id, { mock: true })) || p);
  });

  on('POST', '/api/payments/manual', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const amt = amount(x.amount);
    if (!(amt > 0)) throw bad('Дүнгээ оруулна уу');
    const k = x.unit_id ? null : unitKey(x.unit);
    const { rows } = await db.query(
      k ? 'select * from units where cx_id = $1 and b = $2 and n = $3' : 'select * from units where cx_id = $1 and id = $2',
      k ? [me.cx_id, k.b, k.n] : [me.cx_id, int(x.unit_id, 1) || 0],
    );
    const unit = rows[0];
    if (!unit) throw bad('Ийм айл алга (жишээ: 5-34)');
    const channel = MANUAL.includes(x.channel) ? x.channel : 'Бэлэн';
    const ins = await db.query(
      `insert into payments (cx_id, unit_id, amount, channel, provider, payer, created_by)
       values ($1, $2, $3, $4, 'manual', $5, $6) returning id`,
      [me.cx_id, unit.id, amt, channel, clean(x.payer, 80) || unit.owner, me.id],
    );
    const p = await B.settle(ins.rows[0].id, { by: me.login, note: clean(x.note, 200) });
    await C.audit(db.query, c, 'payment.manual', 'payment', p.id, { unit: unit.b + '-' + unit.n, amount: amt });
    return { ok: true, msg: C.unitLabel(unit.b, unit.n) + ' · ' + money(amt) + ' бүртгэгдлээ', payment: p };
  });

  /* ---------- сануулга ---------- */
  on('POST', '/api/reminders', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    if (!x.all && !x.unit_id) throw bad('Айл сонгоно уу');
    const r = await db.tx(async (q) => {
      const cx = await C.getComplex(q, me.cx_id);
      const list = await B.debtors(q, me.cx_id, x.all ? {} : { unitId: int(x.unit_id, 1) || 0 });
      if (!x.all && !list.length) throw bad('Энэ айл өргүй байна');
      return B.remind(q, cx, list, 'manual', me.login);
    });
    await flush({ ids: r.smsIds });
    await C.audit(db.query, c, 'reminder', 'unit', x.all ? 'all' : x.unit_id, { n: r.n });
    return { ok: true, n: r.n, msg: r.n + ' айлд сануулга илгээгдлээ' };
  });
};

module.exports.summary = summary;
