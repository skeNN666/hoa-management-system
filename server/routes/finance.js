/*
 * 10. Санхүү ба ил тод тайлан (хотхоны бүх гишүүн харна, админ өөрчилнө)
 *   GET  /api/finance/fund?month=        сангийн байдал
 *   GET  /api/finance/ledger?month=      зарлага · POST (админ) { cat, title, amount, vendor }
 *   GET  /api/finance/obligations        төлөвлөсөн зардал · POST (админ) { cat, title, amount, due }
 *   POST /api/finance/obligations/:id/pay   (админ) сангийн үлдэгдэл хүрэлцвэл
 *   GET  /api/works?month=               хийсэн ажил · POST (админ) { cat, title, location }
 *   GET  /api/reports                    нийтэлсэн тайлангууд · POST /api/reports/:month/publish (админ)
 *   GET  /api/finance/months             өгөгдөлтэй саруудын жагсаалт
 */
const db = require('../db');
const C = require('../lib/core');
const { notify } = require('../lib/notify');
const { bad, conflict, notFound, clean, int, amount, local, month, isMonth, monthLabel, money, next } = require('../lib/util');
const { summary } = require('./billing');

const EXP_CATS = ['Цалин', 'Цахилгаан', 'Ус', 'Засвар', 'Лифт', 'Харуул', 'Цэвэрлэгээ', 'Бусад'];
const WORK_CATS = ['Засвар', 'Лифт', 'Сантехник', 'Цахилгаан', 'Дулаан', 'Тохижилт', 'Бусад'];

/** Сангийн тооцоо (тухайн сар) */
async function fund(q, cxRow, mon) {
  const cx = cxRow.id;
  const s = C.settingsOf(cxRow).fund;
  const since = s.since || '0000-00';
  const prior = await q(
    `select
       (select coalesce(sum(amount), 0) from payments where cx_id = $1 and status = 'paid' and month >= $2 and month < $3)::float8 as inflow,
       (select coalesce(sum(amount), 0) from ledger where cx_id = $1 and month >= $2 and month < $3)::float8 as outflow`,
    [cx, since, mon],
  );
  const opening = Number(s.opening || 0) + prior.rows[0].inflow - prior.rows[0].outflow;
  const b = await summary(q, cx, mon);
  const spent = (await q('select coalesce(sum(amount), 0)::float8 as s from ledger where cx_id = $1 and month = $2', [cx, mon])).rows[0].s;
  const due = (await q('select coalesce(sum(amount), 0)::float8 as s from obligations where cx_id = $1 and paid_at is null', [cx])).rows[0].s;
  const balance = opening + b.collected - spent;
  return {
    month: mon,
    opening,
    collected: b.collected,
    billed: b.billed,
    rate: b.rate,
    spent,
    due,
    balance,
    short: Math.max(0, due - balance),
    cover: due ? Math.min(1, Math.max(0, balance / due)) : 1,
    debt: b.debt,
    debtors: b.debtors,
  };
}
const monOf = (c) => {
  const m = c.query.month || month();
  if (!isMonth(m)) throw bad('Сар буруу (YYYY-MM)');
  return m;
};

module.exports = (on) => {
  on('GET', '/api/finance/fund', async (c) => {
    const me = await c.need();
    return fund(db.query, await C.getComplex(db.query, me.cx_id), monOf(c));
  });

  on('GET', '/api/finance/ledger', async (c) => {
    const me = await c.need();
    const { rows } = await db.query('select * from ledger where cx_id = $1 and month = $2 order by date desc, id desc', [me.cx_id, monOf(c)]);
    return rows;
  });
  on('POST', '/api/finance/ledger', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const title = clean(x.title || x.t, 200),
      amt = amount(x.amount || x.amt);
    if (!title || !(amt > 0)) throw bad('Юунд зарцуулсан, дүнгээ оруулна уу');
    if (amt > 2e9) throw bad('Дүн хэт их байна');
    const cat = EXP_CATS.includes(x.cat) ? x.cat : 'Бусад';
    return db.tx(async (q) => {
      const L = local();
      const code = 'EX-' + (await next(q, me.cx_id, 'exp', 301));
      const { rows } = await q(
        `insert into ledger (cx_id, code, month, date, cat, title, amount, vendor, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
        [me.cx_id, code, L.month, L.date, cat, title, amt, clean(x.vendor, 120) || '—', me.login],
      );
      await notify(q, me.cx_id, { role: 'resident' }, { kind: 'acc', title: 'СӨХ шинэ зарлага нийтэллээ', body: title + ' · ' + money(amt), link: 'report' });
      await C.audit(q, c, 'ledger.add', 'ledger', rows[0].id, { amt, title });
      await C.touch(q, me.cx_id);
      return { ok: true, msg: 'Зарлага нийтлэгдлээ', item: rows[0] };
    });
  });

  on('GET', '/api/finance/obligations', async (c) => {
    const me = await c.need();
    const { rows } = await db.query('select * from obligations where cx_id = $1 order by paid_at nulls first, due_date, id', [me.cx_id]);
    return rows;
  });
  on('POST', '/api/finance/obligations', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const title = clean(x.title, 200),
      amt = amount(x.amount);
    if (!title || !(amt > 0)) throw bad('Нэр, дүнгээ оруулна уу');
    if (x.due && !/^\d{4}-\d{2}-\d{2}$/.test(x.due)) throw bad('Огноо буруу (YYYY-MM-DD)');
    const { rows } = await db.query(
      'insert into obligations (cx_id, cat, title, amount, due_date, created_by) values ($1, $2, $3, $4, $5, $6) returning *',
      [me.cx_id, EXP_CATS.includes(x.cat) ? x.cat : 'Бусад', title, amt, x.due || '', me.login],
    );
    await C.audit(db.query, c, 'obligation.add', 'obligation', rows[0].id, { amt });
    await C.touch(db.query, me.cx_id);
    return { ok: true, item: rows[0] };
  });
  on('POST', '/api/finance/obligations/:id/pay', async (c) => {
    const me = await c.need('admin');
    return db.tx(async (q) => {
      const cxRow = await C.getComplex(q, me.cx_id, true); // хотхоны мөрийг түгжинэ → зэрэг төлөхгүй
      const o = (await q('select * from obligations where id = $1 and cx_id = $2 for update', [int(c.params.id, 1) || 0, me.cx_id])).rows[0];
      if (!o) throw notFound();
      if (o.paid_at) throw bad('Аль хэдийн төлөгдсөн');
      const f = await fund(q, cxRow, month());
      if (f.balance < o.amount) throw conflict('Сангийн үлдэгдэл хүрэлцэхгүй · өр барагдуулж байж төлөх боломжтой');
      const L = local();
      await q('update obligations set paid_at = now() where id = $1', [o.id]);
      const code = 'EX-' + (await next(q, me.cx_id, 'exp', 301));
      await q(
        `insert into ledger (cx_id, code, month, date, cat, title, amount, vendor, obligation_id, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, 'Төлөвлөсөн зардал', $8, $9)`,
        [me.cx_id, code, L.month, L.date, o.cat, o.title, o.amount, o.id, me.login],
      );
      await notify(q, me.cx_id, { role: 'resident' }, { kind: 'acc', title: 'СӨХ шинэ зарлага нийтэллээ', body: o.title + ' · ' + money(o.amount), link: 'report' });
      await C.audit(q, c, 'obligation.pay', 'obligation', o.id, { amt: o.amount });
      await C.touch(q, me.cx_id);
      return { ok: true, msg: 'Зардал төлөгдлөө' };
    });
  });

  on('GET', '/api/works', async (c) => {
    const me = await c.need();
    const { rows } = await db.query('select * from works where cx_id = $1 and month = $2 order by date desc, id desc', [me.cx_id, monOf(c)]);
    return rows;
  });
  on('POST', '/api/works', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const title = clean(x.title || x.t, 200);
    if (!title) throw bad('Юу хийснээ бичнэ үү');
    const cat = WORK_CATS.includes(x.cat) ? x.cat : 'Бусад';
    const location = clean(x.location || x.where, 120);
    return db.tx(async (q) => {
      const code = await C.logWork(q, me.cx_id, { cat, title, location, by: 'Удирдлага', source: 'admin' });
      await notify(q, me.cx_id, { role: 'resident' }, { kind: 'ok', title: 'Хийгдсэн ажил · ' + cat, body: title + (location ? ' · ' + location : ''), link: 'report' });
      await C.audit(q, c, 'work.add', 'work', code);
      await C.touch(q, me.cx_id);
      return { ok: true, code, msg: 'Ажил тайланд нэмэгдлээ' };
    });
  });

  on('GET', '/api/reports', async (c) => {
    const me = await c.need();
    const { rows } = await db.query('select month, summary, published_at, published_by from reports where cx_id = $1 order by month desc', [me.cx_id]);
    return rows;
  });
  on('POST', '/api/reports/:month/publish', async (c) => {
    const me = await c.need('admin');
    const mon = c.params.month;
    if (!isMonth(mon)) throw bad('Сар буруу');
    return db.tx(async (q) => {
      const f = await fund(q, await C.getComplex(q, me.cx_id, true), mon);
      const works = (await q('select count(*)::int as n from works where cx_id = $1 and month = $2', [me.cx_id, mon])).rows[0].n;
      const s = { ...f, works };
      await q(
        `insert into reports (cx_id, month, summary, published_by) values ($1, $2, $3::jsonb, $4)
         on conflict (cx_id, month) do update set summary = excluded.summary, published_at = now(), published_by = excluded.published_by`,
        [me.cx_id, mon, JSON.stringify(s), me.login],
      );
      const n = await notify(q, me.cx_id, { role: 'resident' }, {
        kind: 'acc',
        title: monthLabel(mon) + 'ын тайлан нийтлэгдлээ',
        body: 'Зарлага ' + money(f.spent) + ' · хийсэн ажил ' + works,
        link: 'report',
      });
      await C.audit(q, c, 'report.publish', 'report', mon);
      await C.touch(q, me.cx_id);
      return { ok: true, msg: 'Тайлан нийтлэгдлээ · ' + n + ' оршин суугчид мэдэгдэл очлоо', summary: s };
    });
  });

  on('GET', '/api/finance/months', async (c) => {
    const me = await c.need();
    const { rows } = await db.query(
      `select m from (select month m from ledger where cx_id = $1 union select month from works where cx_id = $1
         union select month from invoices where cx_id = $1 union select $2) x order by m desc limit 24`,
      [me.cx_id, month()],
    );
    return rows.map((r) => ({ month: r.m, label: monthLabel(r.m) }));
  });
};

module.exports.fund = fund;
