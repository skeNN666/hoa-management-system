/*
 * Нэхэмжлэл, төлбөр тооцоо, сануулга.
 *   generate(q, cx, month)      айл бүрт сарын нэхэмжлэл (хураамж + зогсоолын түрээс), давхардуулахгүй
 *   settle(paymentId, data)     төлбөрийг баталж, хуучин нэхэмжлэлээс эхлэн хаана (idempotent)
 *   remind(q, cx, units, kind)  сануулга (апп + SMS)
 */
const db = require('../db');
const C = require('./core');
const Pay = require('./pay');
const { notify, sms } = require('./notify');
const { local, month, addDays, monthLabel, money, next } = require('./util');

/** → үүссэн нэхэмжлэлийн тоо */
async function generate(q, cxRow, mon) {
  const cx = cxRow.id;
  const s = C.settingsOf(cxRow).invoice;
  const due = mon + '-' + String(s.due).padStart(2, '0');
  const { rows: units } = await q(
    `select u.id, u.b, u.n, u.fee, r.fee as rent, r.slot_id from units u
     left join slot_rentals r on r.unit_id = u.id and r.end_at is null
     where u.cx_id = $1 and u.active
       and not exists (select 1 from invoices i where i.unit_id = u.id and i.month = $2)`,
    [cx, mon],
  );
  let n = 0;
  for (const u of units) {
    const items = [];
    if (u.fee > 0) items.push({ t: 'СӨХ-ийн хураамж', amt: u.fee });
    if (u.rent > 0) items.push({ t: 'Зогсоолын түрээс ' + u.slot_id, amt: u.rent });
    const amount = items.reduce((a, x) => a + x.amt, 0);
    if (!amount) continue;
    const code = 'INV-' + mon.slice(0, 4) + '-' + (await next(q, cx, 'inv-' + mon.slice(0, 4), 1001));
    const r = await q(
      `insert into invoices (cx_id, unit_id, code, month, amount, items, due_date)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7) on conflict (unit_id, month) do nothing returning id`,
      [cx, u.id, code, mon, amount, JSON.stringify(items), due],
    );
    if (!r.rows.length) continue;
    n++;
    await notify(q, cx, { unit: u.id }, {
      kind: 'acc',
      title: 'Шинэ нэхэмжлэл · ' + monthLabel(mon),
      body: money(amount) + ' · ' + due.slice(5).replace('-', '/') + ' хүртэл',
      link: 'pay',
    });
  }
  if (n) {
    await notify(q, cx, { role: 'admin' }, {
      kind: 'ok',
      title: 'Нэхэмжлэл илгээгдлээ',
      body: monthLabel(mon) + ' · ' + n + ' айл',
      link: 'invoices',
    });
    await C.touch(q, cx);
  }
  return n;
}

/** Айлын төлөх дүн (төлөгдөөгүй бүх нэхэмжлэл) */
async function dueOf(q, unitId) {
  const { rows } = await q(
    `select coalesce(sum(amount - paid), 0)::int as due, array_agg(id order by month) as ids
     from invoices where unit_id = $1 and status = 'unpaid'`,
    [unitId],
  );
  return { due: rows[0].due, ids: rows[0].ids || [] };
}

/** Төлбөрийг баталгаажуулна → шинэчлэгдсэн payment | null (аль хэдийн баталсан) */
async function settle(id, data) {
  const out = await db.tx(async (q) => {
    const { rows } = await q(
      `update payments set status = 'paid', paid_at = now(), month = $2,
         provider_data = provider_data || $3::jsonb
       where id = $1 and status = 'pending' returning *`,
      [id, month(), JSON.stringify(data || {})],
    );
    const p = rows[0];
    if (!p) return null;
    let left = p.amount;
    if (p.unit_id) {
      const inv = await q(
        "select id, amount, paid from invoices where unit_id = $1 and status = 'unpaid' order by month for update",
        [p.unit_id],
      );
      for (const i of inv.rows) {
        if (left <= 0) break;
        const x = Math.min(left, i.amount - i.paid);
        left -= x;
        await q(
          `update invoices set paid = paid + $2,
             status = case when paid + $2 >= amount then 'paid' else status end,
             paid_at = case when paid + $2 >= amount then now() else paid_at end
           where id = $1`,
          [i.id, x],
        );
      }
    }
    if (left > 0)
      await q(`update payments set provider_data = provider_data || $2::jsonb where id = $1`, [
        p.id,
        JSON.stringify({ credit: left }),
      ]);
    const unit = p.unit_id ? (await q('select * from units where id = $1', [p.unit_id])).rows[0] : null;
    const where = unit ? C.unitLabel(unit.b, unit.n) : '';
    if (unit)
      await notify(q, p.cx_id, { unit: unit.id }, {
        kind: 'ok',
        title: 'Төлбөр амжилттай',
        body: money(p.amount) + ' · ' + p.channel,
        link: 'pay',
      });
    await notify(q, p.cx_id, { role: 'admin' }, {
      kind: 'ok',
      title: 'Төлбөр орлоо',
      body: (where ? where + ' · ' : '') + money(p.amount),
      link: 'payments',
    });
    await C.touch(q, p.cx_id);
    return { p, unit };
  });
  if (!out) return null;
  const eb = await Pay.ebarimt(out.p, out.unit);
  if (eb) await db.query('update payments set ebarimt = $2::jsonb where id = $1', [out.p.id, JSON.stringify(eb)]);
  return { ...out.p, ebarimt: eb };
}

/**
 * Сануулга: units = [{ id, b, n, phone, debt }]; kind manual|before|after.
 * Автомат сануулга (before/after) айл бүрт сард нэг л удаа. → { n, smsIds }
 */
async function remind(q, cxRow, units, kind, by) {
  const cx = cxRow.id;
  const s = C.settingsOf(cxRow).invoice;
  const mon = month();
  let n = 0;
  const smsIds = [];
  for (const u of units) {
    const r = await q(
      `insert into reminders (cx_id, unit_id, kind, month, channel, created_by) values ($1, $2, $3, $4, $5, $6)
       on conflict do nothing returning id`,
      [cx, u.id, kind, mon, s.remSms ? 'sms' : 'app', by || ''],
    );
    if (!r.rows.length) continue;
    n++;
    const title =
      kind === 'after' ? 'Төлбөрийн хугацаа хэтэрлээ' : kind === 'before' ? 'Төлбөрийн хугацаа дуусах гэж байна' : 'Төлбөрийн сануулга';
    const body = C.unitLabel(u.b, u.n) + ' · ' + money(u.debt);
    await notify(q, cx, { unit: u.id }, { kind: kind === 'after' ? 'bad' : 'warn', title, body, link: 'pay' });
    if (s.remSms) {
      // айлд холбогдсон бүртгэлийн утас + айлын бүртгэлийн утас
      const { rows } = await q(
        "select phone from accounts where unit_id = $1 and status = 'active' and phone <> ''",
        [u.id],
      );
      const phones = rows.map((x) => x.phone).concat(u.phone ? [u.phone] : []);
      smsIds.push(...(await sms(q, cx, phones, 'СӨХ: ' + title + '. ' + body + '. Апп-аар төлнө үү.')));
    }
  }
  if (n) await C.touch(q, cx);
  return { n, smsIds };
}

/** Өртэй айлууд (debt > 0); dueBefore өгвөл тухайн өдрөөс өмнө хугацаатай нэхэмжлэлтэй */
async function debtors(q, cx, { unitId, dueOn, overdue } = {}) {
  const p = [cx];
  let w = '';
  if (unitId) w += ' and u.id = $' + p.push(unitId);
  if (dueOn) w += ' and i.due_date = $' + p.push(dueOn);
  if (overdue) w += ' and i.due_date < $' + p.push(overdue);
  const { rows } = await q(
    `select u.id, u.b, u.n, u.phone, sum(i.amount - i.paid)::int as debt
     from units u join invoices i on i.unit_id = u.id and i.status = 'unpaid'
     where u.cx_id = $1 and u.active ${w} group by u.id having sum(i.amount - i.paid) > 0`,
    p,
  );
  return rows;
}

/** Cron: тохиргооны өдөр, цагт хүрсэн бол энэ сарын нэхэмжлэл + автомат сануулга */
async function daily(cxRow, now = new Date()) {
  const L = local(now);
  const s = C.settingsOf(cxRow).invoice;
  const res = { invoices: 0, before: 0, after: 0, smsIds: [] };
  await db.tx(async (q) => {
    if (s.auto && (L.d > s.day || (L.d === s.day && L.hm >= s.time)))
      res.invoices = await generate(q, cxRow, L.month);
    if (s.remBefore) {
      const r = await remind(q, cxRow, await debtors(q, cxRow.id, { dueOn: addDays(L.date, 3) }), 'before');
      res.before = r.n;
      res.smsIds.push(...r.smsIds);
    }
    if (s.remAfter) {
      const r = await remind(q, cxRow, await debtors(q, cxRow.id, { overdue: L.date }), 'after');
      res.after = r.n;
      res.smsIds.push(...r.smsIds);
    }
  });
  return res;
}

module.exports = { generate, dueOf, settle, remind, debtors, daily };
