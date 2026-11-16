/*
 * Зогсоолын логик: захиалга (N минут барина), ирэх/гарах, дараалал, мэдрэгч.
 * Слотын state: 0 сул · 1 эзэлсэн · 2 зочин · 3 захиалсан
 * Хугацаа дууссан захиалга, саналыг cron хүлээлгүйгээр хүсэлт бүрт (expire) шалгана.
 */
const C = require('./core');
const { notify } = require('./notify');
const { bad, conflict, notFound } = require('./util');

async function slotFor(q, cx, id) {
  const { rows } = await q('select * from slots where cx_id = $1 and id = $2 and active for update', [cx, id]);
  if (!rows[0]) throw notFound('Зогсоол олдсонгүй');
  return rows[0];
}
const rentalOf = async (q, cx, id) =>
  (await q('select * from slot_rentals where cx_id = $1 and slot_id = $2 and end_at is null', [cx, id])).rows[0] || null;

/** Сул болсон гадна зогсоолыг дараалалд эхэнд байгаа хүнд санал болгоно */
async function offer(q, cxRow, slotId) {
  const cx = cxRow.id;
  const s = (await q('select * from slots where cx_id = $1 and id = $2', [cx, slotId])).rows[0];
  if (!s || !s.active || s.state !== 0 || s.zone !== 'p') return null;
  if (await rentalOf(q, cx, slotId)) return null;
  const busy = await q("select 1 from park_queue where cx_id = $1 and slot_id = $2 and status = 'offered'", [cx, slotId]);
  if (busy.rows.length) return null;
  const { rows } = await q(
    "select * from park_queue where cx_id = $1 and status = 'waiting' order by created_at, id limit 1 for update",
    [cx],
  );
  const w = rows[0];
  if (!w) return null;
  const min = C.settingsOf(cxRow).park.offerMin;
  await q(
    `update park_queue set status = 'offered', slot_id = $2, offer_expires_at = now() + $3 * interval '1 minute' where id = $1`,
    [w.id, slotId, min],
  );
  await notify(q, cx, { account: w.account_id }, {
    kind: 'ok',
    title: slotId + ' сул боллоо!',
    body: 'Дараалалд 1-рт байсан тул танд санал болгож байна · ' + min + ' минутын дотор захиална уу',
    link: 'parking',
  });
  return w.account_id;
}

/** Хугацаа дууссан захиалга, санал → цуцална, дараагийн хүнд санал болгоно */
async function expire(q, cxRow) {
  const cx = cxRow.id;
  const held = await q(
    "update slot_reservations set status = 'expired' where cx_id = $1 and status = 'held' and expires_at < now() returning slot_id, account_id",
    [cx],
  );
  for (const r of held.rows) {
    await q('update slots set state = 0, plate = $3, updated_at = now() where cx_id = $1 and id = $2 and state = 3', [cx, r.slot_id, '']);
    await notify(q, cx, { account: r.account_id }, { kind: 'warn', title: r.slot_id + ' захиалга цуцлагдлаа', body: 'Хугацаандаа ирээгүй тул зогсоол чөлөөлөгдлөө', link: 'parking' });
  }
  const off = await q(
    "update park_queue set status = 'cancelled' where cx_id = $1 and status = 'offered' and offer_expires_at < now() returning slot_id, account_id",
    [cx],
  );
  for (const r of off.rows)
    await notify(q, cx, { account: r.account_id }, { kind: 'warn', title: 'Саналын хугацаа дууслаа', body: r.slot_id + ' өөр хүнд шилжлээ', link: 'parking' });
  for (const id of new Set(held.rows.concat(off.rows).map((r) => r.slot_id))) await offer(q, cxRow, id);
  if (held.rows.length || off.rows.length) await C.touch(q, cx);
  return held.rows.length + off.rows.length;
}

const active = async (q, accId) =>
  (await q("select * from slot_reservations where account_id = $1 and status in ('held', 'parked') for update", [accId])).rows[0] || null;

async function reserve(q, cxRow, me, slotId) {
  const cx = cxRow.id;
  await expire(q, cxRow);
  if (await active(q, me.id)) throw bad('Танд идэвхтэй захиалга байна');
  const s = await slotFor(q, cx, slotId);
  const rent = await rentalOf(q, cx, slotId);
  if (rent && rent.unit_id !== me.unit_id) throw bad(slotId + ' өөр айлд түрээслэгдсэн тул захиалах боломжгүй');
  if (s.state !== 0) throw conflict(slotId + ' сул биш байна');
  const off = await q("select account_id from park_queue where cx_id = $1 and slot_id = $2 and status = 'offered'", [cx, slotId]);
  if (off.rows[0] && off.rows[0].account_id !== me.id) throw bad('Энэ зогсоолыг дараалалд байгаа хүнд санал болгосон байна');
  const unit = me.unit_id ? (await q('select plate from units where id = $1', [me.unit_id])).rows[0] : null;
  const min = C.settingsOf(cxRow).park.holdMin;
  const { rows } = await q(
    `insert into slot_reservations (cx_id, slot_id, account_id, plate, status, expires_at)
     values ($1, $2, $3, $4, 'held', now() + $5 * interval '1 minute') returning *`,
    [cx, slotId, me.id, unit ? unit.plate : '', min],
  );
  await q("update slots set state = 3, plate = $3, updated_at = now() where cx_id = $1 and id = $2", [cx, slotId, rows[0].plate]);
  await q("update park_queue set status = 'done' where account_id = $1 and status in ('waiting', 'offered')", [me.id]);
  await C.touch(q, cx);
  return { ...rows[0], msg: slotId + ' захиалагдлаа · ' + min + ' минутын дотор очиж зогсоно уу' };
}

async function cancel(q, cxRow, me) {
  const r = await active(q, me.id);
  if (!r || r.status !== 'held') throw bad('Идэвхтэй захиалга алга');
  await q("update slot_reservations set status = 'cancelled' where id = $1", [r.id]);
  await q("update slots set state = 0, plate = '', updated_at = now() where cx_id = $1 and id = $2 and state = 3", [cxRow.id, r.slot_id]);
  await offer(q, cxRow, r.slot_id);
  await C.touch(q, cxRow.id);
  return { ok: true, msg: 'Захиалга цуцлагдлаа' };
}

/** Мэдрэгчгүй үед гараар: ирлээ */
async function arrive(q, cxRow, me) {
  const r = await active(q, me.id);
  if (!r || r.status !== 'held') throw bad('Идэвхтэй захиалга алга');
  if (new Date(r.expires_at) < new Date()) throw bad('Захиалгын хугацаа дууссан');
  await q("update slot_reservations set status = 'parked', arrived_at = now() where id = $1", [r.id]);
  await q('update slots set state = 1, updated_at = now() where cx_id = $1 and id = $2', [cxRow.id, r.slot_id]);
  await C.touch(q, cxRow.id);
  return { ok: true, slot: r.slot_id };
}

async function leave(q, cxRow, me) {
  const r = await active(q, me.id);
  if (!r || r.status !== 'parked') throw bad('Та зогсоолд байрлаагүй байна');
  await q("update slot_reservations set status = 'done', left_at = now() where id = $1", [r.id]);
  await q("update slots set state = 0, plate = '', updated_at = now() where cx_id = $1 and id = $2", [cxRow.id, r.slot_id]);
  await offer(q, cxRow, r.slot_id);
  await C.touch(q, cxRow.id);
  return { ok: true, msg: 'Зогсоолоос гарлаа' };
}

/** Мэдрэгчийн дохио: { occupied, plate, battery } */
async function sensor(q, cxRow, slotId, x) {
  const cx = cxRow.id;
  const s = await slotFor(q, cx, slotId);
  const battery = Number.isFinite(Number(x.battery)) ? Math.max(0, Math.min(100, Math.round(x.battery))) : s.battery;
  const sens = battery != null && battery < 20 ? 'low' : 'ok';
  const res = (await q("select * from slot_reservations where cx_id = $1 and slot_id = $2 and status in ('held', 'parked') for update", [cx, slotId])).rows[0];
  const plate = String(x.plate || '').slice(0, 20);
  let state;
  if (x.occupied) {
    if (res && res.status === 'held') {
      await q("update slot_reservations set status = 'parked', arrived_at = now() where id = $1", [res.id]);
      await notify(q, cx, { account: res.account_id }, { kind: 'ok', title: 'Мэдрэгч машиныг бүртгэлээ', body: slotId + (res.plate ? ' · ' + res.plate : '') });
      state = 1;
    } else if (res || (await rentalOf(q, cx, slotId))) state = 1;
    else {
      const known = plate && (await q('select 1 from units where cx_id = $1 and plate = $2 and active', [cx, plate])).rows.length;
      state = known ? 1 : 2;
    }
  } else {
    if (res && res.status === 'parked') await q("update slot_reservations set status = 'done', left_at = now() where id = $1", [res.id]);
    state = res && res.status === 'held' ? 3 : 0;
  }
  await q('update slots set state = $3, plate = $4, battery = $5, sensor = $6, updated_at = now() where cx_id = $1 and id = $2', [
    cx,
    slotId,
    state,
    x.occupied ? plate || (res ? res.plate : '') : state === 3 ? s.plate : '',
    battery,
    sens,
  ]);
  if (state === 0) await offer(q, cxRow, slotId);
  await C.touch(q, cx);
  return { slot: slotId, state };
}

module.exports = { offer, expire, reserve, cancel, arrive, leave, sensor, rentalOf };
