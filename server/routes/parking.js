/*
 * 9. Зогсоол
 *   GET    /api/slots                 бүх слот (админ: дугаар, түрээслэгч; бусад: зөвхөн төлөв)
 *   GET    /api/parking/me            (оршин суугч) захиалга, дараалал, түрээс
 *   POST   /api/parking/reserve       { slot_id }  N минут барина
 *   POST   /api/parking/cancel · /arrive · /leave
 *   POST   /api/parking/queue         дараалалд орох · DELETE /api/parking/queue
 *   POST   /api/slots/:id/rental      (админ) { unit: '5-34' | unit_id, fee } сарын түрээс
 *   DELETE /api/slots/:id/rental      (админ)
 *   GET    /api/parking/rentals       (админ) түрээсийн жагсаалт + сарын орлого
 */
const db = require('../db');
const C = require('../lib/core');
const P = require('../lib/parking');
const { notify } = require('../lib/notify');
const { bad, conflict, notFound, clean, int, amount, unitKey, money } = require('../lib/util');

/** Дараалал дахь байр (1-ээс) */
async function position(q, me) {
  const { rows } = await q(
    `select w.*, (select count(*)::int from park_queue x where x.cx_id = w.cx_id and x.status = 'waiting'
       and (x.created_at, x.id) <= (w.created_at, w.id)) as pos
     from park_queue w where w.account_id = $1 and w.status in ('waiting', 'offered')`,
    [me.id],
  );
  return rows[0] || null;
}

module.exports = (on) => {
  const run = (fn) => async (c) => {
    const me = await c.need('resident');
    return db.tx(async (q) => fn(q, await C.getComplex(q, me.cx_id), me, c));
  };

  on('GET', '/api/slots', async (c) => {
    const me = await c.need();
    const cxRow = await C.getComplex(db.query, me.cx_id);
    await db.tx((q) => P.expire(q, cxRow));
    const { rows } = await db.query(
      `select s.*, r.fee, r.unit_id as rent_unit, u.b as rent_b, u.n as rent_n, d.last_seen,
         (select account_id from slot_reservations x where x.cx_id = s.cx_id and x.slot_id = s.id and x.status in ('held', 'parked')) as res_acc
       from slots s
       left join slot_rentals r on r.cx_id = s.cx_id and r.slot_id = s.id and r.end_at is null
       left join units u on u.id = r.unit_id
       left join devices d on d.cx_id = s.cx_id and d.kind = 'slot' and d.ref = s.id
       where s.cx_id = $1 and s.active order by s.zone desc, s.id`,
      [me.cx_id],
    );
    const stale = (s) => s.last_seen && Date.now() - new Date(s.last_seen).getTime() > 3600e3;
    return rows.map((s) => {
      const base = { id: s.id, zone: s.zone, st: s.state, sens: stale(s) ? 'off' : s.sensor, rented: !!s.rent_unit };
      if (me.role === 'admin')
        return { ...base, plate: s.plate, bat: s.battery, own: s.rent_unit ? s.rent_b + '-' + s.rent_n : null, fee: s.fee, unit_id: s.rent_unit };
      return { ...base, mine: s.res_acc === me.id || (!!me.unit_id && s.rent_unit === me.unit_id) };
    });
  });

  on('GET', '/api/parking/me', run(async (q, cx, me) => {
    await P.expire(q, cx);
    const res = (await q("select * from slot_reservations where account_id = $1 and status in ('held', 'parked')", [me.id])).rows[0] || null;
    const rent = me.unit_id ? (await q('select slot_id, fee from slot_rentals where unit_id = $1 and end_at is null', [me.unit_id])).rows[0] || null : null;
    const free = (await q(
      `select count(*)::int as n from slots s where s.cx_id = $1 and s.active and s.zone = 'p' and s.state = 0
       and not exists (select 1 from slot_rentals r where r.cx_id = s.cx_id and r.slot_id = s.id and r.end_at is null)`,
      [me.cx_id],
    )).rows[0].n;
    return { reservation: res, queue: await position(q, me), rental: rent, free };
  }));
  on('POST', '/api/parking/reserve', run(async (q, cx, me, c) => {
    const x = await c.json();
    return P.reserve(q, cx, me, clean(x.slot_id, 10));
  }));
  on('POST', '/api/parking/cancel', run((q, cx, me) => P.cancel(q, cx, me)));
  on('POST', '/api/parking/arrive', run((q, cx, me) => P.arrive(q, cx, me)));
  on('POST', '/api/parking/leave', run((q, cx, me) => P.leave(q, cx, me)));
  on('POST', '/api/parking/queue', run(async (q, cx, me) => {
    const r = await q("select 1 from slot_reservations where account_id = $1 and status in ('held', 'parked')", [me.id]);
    if (r.rows.length) throw bad('Танд идэвхтэй захиалга байна');
    if (await position(q, me)) throw bad('Та аль хэдийн дараалалд байна');
    await q("insert into park_queue (cx_id, account_id, status) values ($1, $2, 'waiting')", [me.cx_id, me.id]);
    // одоо сул зогсоол байвал шууд санал болгоно
    const free = await q(
      `select s.id from slots s where s.cx_id = $1 and s.active and s.zone = 'p' and s.state = 0
       and not exists (select 1 from slot_rentals r where r.cx_id = s.cx_id and r.slot_id = s.id and r.end_at is null)
       and not exists (select 1 from park_queue w where w.cx_id = s.cx_id and w.slot_id = s.id and w.status = 'offered')
       order by s.id limit 1`,
      [me.cx_id],
    );
    if (free.rows[0]) await P.offer(q, cx, free.rows[0].id);
    await C.touch(q, me.cx_id);
    return { ok: true, queue: await position(q, me), msg: 'Дараалалд бүртгэгдлээ · сул зогсоол гармагц мэдэгдэнэ' };
  }));
  on('DELETE', '/api/parking/queue', run(async (q, cx, me) => {
    await q("update park_queue set status = 'cancelled' where account_id = $1 and status in ('waiting', 'offered')", [me.id]);
    await C.touch(q, me.cx_id);
    return { ok: true };
  }));

  /* ---------- сарын түрээс ---------- */
  on('POST', '/api/slots/:id/rental', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    return db.tx(async (q) => {
      const s = (await q('select * from slots where cx_id = $1 and id = $2 and active for update', [me.cx_id, c.params.id])).rows[0];
      if (!s) throw notFound('Зогсоол олдсонгүй');
      const k = x.unit_id ? null : unitKey(x.unit);
      if (!x.unit_id && !k) throw bad('Буруу тоот · жишээ нь 5-34 гэж бичнэ үү');
      const unit = k
        ? await C.unitByBN(q, me.cx_id, k.b, k.n)
        : (await q('select * from units where id = $1 and cx_id = $2 and active', [int(x.unit_id, 1) || 0, me.cx_id])).rows[0];
      if (!unit) throw bad('Ийм айл бүртгэлгүй байна');
      if (await P.rentalOf(q, me.cx_id, s.id)) throw conflict(s.id + ' аль хэдийн түрээслэгдсэн');
      const other = await q('select slot_id from slot_rentals where unit_id = $1 and end_at is null', [unit.id]);
      if (other.rows[0]) throw conflict('Энэ айл аль хэдийн ' + other.rows[0].slot_id + ' зогсоол түрээсэлсэн');
      const fee = Math.min(amount(x.fee), 10000000);
      await q('insert into slot_rentals (cx_id, slot_id, unit_id, fee, created_by) values ($1, $2, $3, $4, $5)', [me.cx_id, s.id, unit.id, fee, me.login]);
      await notify(q, me.cx_id, { unit: unit.id }, { kind: 'ok', title: s.id + ' танд хуваарилагдлаа', body: 'Сарын төлбөр ' + money(fee), link: 'parking' });
      await C.audit(q, c, 'slot.rent', 'slot', s.id, { unit: unit.b + '-' + unit.n, fee });
      await C.touch(q, me.cx_id);
      return { ok: true, msg: s.id + ' хуваарилагдлаа · ' + C.unitLabel(unit.b, unit.n) + ' · ' + money(fee) + '/сар' };
    });
  });
  on('DELETE', '/api/slots/:id/rental', async (c) => {
    const me = await c.need('admin');
    return db.tx(async (q) => {
      const { rows } = await q('update slot_rentals set end_at = now() where cx_id = $1 and slot_id = $2 and end_at is null returning unit_id', [me.cx_id, c.params.id]);
      if (!rows[0]) throw notFound('Түрээс олдсонгүй');
      await notify(q, me.cx_id, { unit: rows[0].unit_id }, { kind: 'warn', title: c.params.id + ' түрээс цуцлагдлаа', body: 'СӨХ-д хандана уу' });
      await C.audit(q, c, 'slot.unrent', 'slot', c.params.id);
      await C.touch(q, me.cx_id);
      return { ok: true, msg: c.params.id + ' чөлөөлөгдлөө' };
    });
  });
  on('GET', '/api/parking/rentals', async (c) => {
    const me = await c.need('admin');
    const { rows } = await db.query(
      `select r.slot_id, r.fee, r.start_at, u.id as unit_id, u.b, u.n, u.owner from slot_rentals r
       join units u on u.id = r.unit_id where r.cx_id = $1 and r.end_at is null order by r.slot_id`,
      [me.cx_id],
    );
    return { list: rows, n: rows.length, sum: rows.reduce((a, r) => a + r.fee, 0) };
  });
};
