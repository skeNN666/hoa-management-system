/*
 * GET /api/boot — нэвтэрсэн хэрэглэгчийн хуудсанд хэрэгтэй бүх өгөгдөл, frontend-ийн js/store.js-ийн
 * төлвийн хэлбэрээр (reqs, leaks, lights, slots, payments, notifs, ledger, works …). Эрхээр шүүгдэнэ:
 *   админ     — бүгд (айл бүрийн өр, дугаар, түрээслэгч, ажилтнууд, нэхэмжлэлийн тохиргоо)
 *   ажилтан   — өөрийн ангиллын шинэ хүсэлт + өөрийн даалгавар, айлын төлбөр харахгүй
 *   оршин суугч — өөрийн айлын хүсэлт, төлбөр, захиалга; бусдын төлбөрийг зөвхөн байраар нэгтгэж
 */
const db = require('../db');
const C = require('../lib/core');
const P = require('../lib/parking');
const R = require('../lib/requests');
const A = require('../lib/auth');
const { local, month, addMonths, monthLabel } = require('../lib/util');
const { unitRows } = require('./complexes');
const { fund } = require('./finance');
const Pay = require('../lib/pay');

const ms = (t) => (t ? new Date(t).getTime() : null);
const hm = (t) => (t ? local(new Date(t)).hm : '');
const md = (s) => (s ? s.slice(5, 7) + '/' + s.slice(8, 10) : '');
const mdOf = (t) => (t ? local(new Date(t)).date.slice(5).replace('-', '/') : '');

const mapReq = (r) => ({
  id: r.code,
  rid: r.id,
  title: r.title,
  cat: r.cat,
  p: r.priority,
  b: r.b,
  u: r.n,
  st: r.status,
  createdAt: ms(r.created_at),
  stAt: ms(r.status_at),
  desc: r.descr,
  photos: r.photos || 0,
  from: r.source === 'system' ? 'sensor' : r.source,
  by: r.assignee_name || undefined,
  ref: r.ref,
});
const mapLeak = (l) => ({
  id: l.code,
  lid: l.id,
  b: l.b,
  u: l.n,
  room: l.room,
  st: l.status,
  t0: 0,
  times: [l.detected_at, l.notified_at, l.closed_at, l.assigned_at, l.fixed_at].map(hm),
  by: l.assignee_name || undefined,
});
const mapNotif = (n) => ({ id: n.id, k: n.kind, t: n.title, s: n.body, time: hm(n.created_at), unread: n.unread, link: n.link });

module.exports = (on) => {
  on('GET', '/api/boot', async (c) => {
    const me = await c.need();
    const cx = me.cx_id;
    const cxRow = await C.getComplex(db.query, cx);
    await R.checkSla(db.query, cxRow);
    await db.tx((q) => P.expire(q, cxRow));
    const cur = month();
    const from = addMonths(cur, -5);
    const q = db.query;
    const isAdmin = me.role === 'admin',
      isRes = me.role === 'resident';

    // ---- хүсэлт ----
    const rp = [cx];
    let rw = '';
    if (isRes) rw = ' and r.unit_id = $' + rp.push(me.unit_id || 0);
    if (me.role === 'staff')
      rw = ` and (r.assignee_id = $${rp.push(me.id)} or (r.status = 0 ${me.cats.length ? 'and r.cat = any($' + rp.push(me.cats) + ')' : ''}))`;
    const reqs = q(
      `select r.*, (select count(*)::int from request_photos p where p.request_id = r.id) as photos
       from requests r where r.cx_id = $1 ${rw} and (r.status < 4 or r.resolved_at > now() - interval '30 days')
       order by r.created_at desc limit 300`,
      rp,
    );
    const leaks = q(
      `select * from leaks where cx_id = $1 ${isRes ? 'and unit_id = $2' : ''}
       and (status <> 'fixed' or fixed_at > now() - interval '7 days') order by detected_at desc limit 50`,
      isRes ? [cx, me.unit_id || 0] : [cx],
    );
    const lights = q('select id, loc, x, z, status from lights where cx_id = $1 order by id', [cx]);
    const slots = q(
      `select s.*, r.fee, r.unit_id as rent_unit, u.b as rent_b, u.n as rent_n, d.last_seen,
         (select account_id from slot_reservations x where x.cx_id = s.cx_id and x.slot_id = s.id and x.status in ('held', 'parked')) as res_acc
       from slots s left join slot_rentals r on r.cx_id = s.cx_id and r.slot_id = s.id and r.end_at is null
       left join units u on u.id = r.unit_id
       left join devices d on d.cx_id = s.cx_id and d.kind = 'slot' and d.ref = s.id
       where s.cx_id = $1 and s.active order by s.zone desc, s.id`,
      [cx],
    );
    const notifs = q('select * from notifications where account_id = $1 order by id desc limit 30', [me.id]);
    const ledger = q('select * from ledger where cx_id = $1 and month >= $2 order by date desc, id desc', [cx, from]);
    const works = q('select * from works where cx_id = $1 and month >= $2 order by date desc, id desc', [cx, from]);
    const obl = q('select * from obligations where cx_id = $1 order by paid_at nulls first, due_date, id', [cx]);
    const reps = q('select month, published_at from reports where cx_id = $1', [cx]);
    const months = q(
      `select m from (select month m from ledger where cx_id = $1 union select month from works where cx_id = $1
         union select $2) x where m >= $3 order by m desc`,
      [cx, cur, from],
    );
    const ver = q('select ver from complexes where id = $1', [cx]);
    const [Rq, Lk, Li, Sl, Nt, Lg, Wk, Ob, Rp, Mo, Vr] = await Promise.all([reqs, leaks, lights, slots, notifs, ledger, works, obl, reps, months, ver]);
    const f = await fund(q, cxRow, cur);

    // ---- айлууд ----
    let units, unitRaw;
    const { buildings } = C.layoutOf(cxRow);
    if (isAdmin) {
      unitRaw = await unitRows(q, cx);
      units = buildings.map(() => []);
      const idx = new Map(buildings.map((B, i) => [B.n, i]));
      for (const u of unitRaw) {
        const i = idx.get(u.b);
        if (i === undefined) continue;
        units[i].push({
          id: u.id,
          b: u.b,
          n: u.n,
          floor: u.floor,
          owner: u.owner,
          tenant: u.tenant,
          phone: u.phone,
          st: u.st,
          amt: u.st === 0 ? u.fee : u.cur,
          prev: u.prev,
          plate: u.plate,
        });
      }
    } else {
      // ажилтан, оршин суугч: байр бүрийн төлсөн айлын тоо л (хэн төлснийг харуулахгүй)
      const { rows } = await q(
        `select u.b, count(*)::int as n,
           count(*) filter (where not exists (select 1 from invoices i where i.unit_id = u.id and i.status = 'unpaid'))::int as paid
         from units u where u.cx_id = $1 and u.active group by u.b`,
        [cx],
      );
      const by = new Map(rows.map((r) => [r.b, r]));
      units = buildings.map((B) => {
        const r = by.get(B.n) || { n: B.units, paid: 0 };
        return Array.from({ length: r.n }, (_, k) => ({ b: B.n, n: k + 1, st: k < r.paid ? 0 : 2, amt: 0, prev: 0 }));
      });
    }

    const out = {
      ver: Vr.rows[0].ver,
      role: me.role,
      month: cur,
      months: Mo.rows.map((r) => [r.m, monthLabel(r.m)]),
      me: { id: me.id, name: me.name, login: me.login, role: me.role, cx, pos: me.pos, cats: me.cats, phone: me.phone },
      rights: A.RIGHTS[me.role],
      reqs: Rq.rows.map(mapReq),
      leaks: Lk.rows.map(mapLeak),
      lights: Li.rows.map((l) => ({ id: l.id, x: l.x, z: l.z, loc: l.loc, st: l.status })),
      slots: Sl.rows.map((s) => {
        const stale = s.last_seen && Date.now() - new Date(s.last_seen).getTime() > 3600e3;
        const base = { id: s.id, zone: s.zone, st: s.state, sens: stale ? 'off' : s.sensor, bat: s.battery == null ? 80 : s.battery };
        const mine = s.res_acc === me.id || (isRes && !!me.unit_id && s.rent_unit === me.unit_id);
        if (isAdmin) return { ...base, plate: s.plate, own: s.rent_unit ? s.rent_b + '-' + s.rent_n : undefined, fee: s.fee || undefined, mine: false };
        return {
          ...base,
          plate: mine ? s.plate : s.state ? '•••• •••' : '',
          own: s.rent_unit ? (mine && s.rent_unit === me.unit_id ? s.rent_b + '-' + s.rent_n : 'x') : undefined,
          fee: mine ? s.fee : undefined,
          mine: s.res_acc === me.id,
        };
      }),
      notifs: { admin: [], staff: [], resident: [], [me.role]: Nt.rows.map(mapNotif) },
      ledger: Lg.rows.map((x) => ({ id: x.code, month: x.month, date: md(x.date), cat: x.cat, t: x.title, amt: x.amount, vendor: x.vendor })),
      works: Wk.rows.map((x) => ({ id: x.code, month: x.month, date: md(x.date), cat: x.cat, t: x.title, where: x.location, by: x.by_name, src: x.source, req: x.request_id })),
      obligations: Ob.rows.map((o) => ({ id: o.id, cat: o.cat, t: o.title, amt: o.amount, due: md(o.due_date), paid: !!o.paid_at })),
      reportPub: Object.fromEntries(Rp.rows.map((r) => [r.month, mdOf(r.published_at) + ' ' + hm(r.published_at)])),
      fund: f,
      units,
    };

    if (isAdmin || me.role === 'staff') {
      const { rows } = await q(
        `select a.id, a.login, a.name, a.pos, a.cats, a.status,
           (select count(*)::int from requests r where r.assignee_id = a.id and r.status = 4 and r.resolved_at > date_trunc('month', now())) as done
         from accounts a where a.cx_id = $1 and a.role = 'staff' and a.status in ('active', 'disabled') order by a.login`,
        [cx],
      );
      out.staff = rows.map((s) => ({ aid: s.id, id: s.login, n: s.name, role: s.pos, cat: s.cats[0] || '', cats: s.cats, on: s.status === 'active', done: s.done, rating: 4.6 }));
    }
    if (isAdmin) {
      const [pay, rem, hist] = await Promise.all([
        q(
          `select p.*, u.b, u.n from payments p left join units u on u.id = p.unit_id
           where p.cx_id = $1 and p.status = 'paid' order by p.paid_at desc limit 20`,
          [cx],
        ),
        q("select u.b, u.n from reminders r join units u on u.id = r.unit_id where r.cx_id = $1 and r.month = $2", [cx, cur]),
        q(
          `select month, count(*)::int as n, sum(amount)::float8 as sum, min(created_at) as at,
             (sum(least(paid, amount))::float8 / nullif(sum(amount), 0)) as rate
           from invoices where cx_id = $1 group by month order by month desc limit 4`,
          [cx],
        ),
      ]);
      out.payments = pay.rows.map((p) => ({
        time: hm(p.paid_at),
        inv: 'PAY-' + p.id,
        unit: p.b ? p.b + '-р байр ' + p.n : '—',
        name: p.payer,
        ch: p.channel,
        amt: p.amount,
      }));
      out.reminded = Object.fromEntries(rem.rows.map((r) => [r.b + '-' + r.n, true]));
      out.invoice = C.settingsOf(cxRow).invoice;
      out.sla = C.settingsOf(cxRow).sla;
      out.invHist = hist.rows.map((h) => ({ month: h.month, at: mdOf(h.at) + ' · ' + hm(h.at), n: h.n, sum: h.sum, rate: h.rate || 0 }));
    }
    if (me.role === 'staff') out.payments = [];
    if (isRes) {
      const unit = me.unit_id ? (await q('select * from units where id = $1', [me.unit_id])).rows[0] : null;
      const [inv, pays, res, queue, rent] = await Promise.all([
        q("select * from invoices where unit_id = $1 order by month desc limit 6", [me.unit_id || 0]),
        q("select * from payments where unit_id = $1 and status = 'paid' order by paid_at desc limit 12", [me.unit_id || 0]),
        q("select * from slot_reservations where account_id = $1 and status in ('held', 'parked')", [me.id]),
        q(
          `select w.*, (select count(*)::int from park_queue x where x.cx_id = w.cx_id and x.status = 'waiting'
             and (x.created_at, x.id) <= (w.created_at, w.id)) as pos
           from park_queue w where w.account_id = $1 and w.status in ('waiting', 'offered')`,
          [me.id],
        ),
        q('select slot_id, fee from slot_rentals where unit_id = $1 and end_at is null', [me.unit_id || 0]),
      ]);
      const open = inv.rows.filter((i) => i.status === 'unpaid');
      const due = open.reduce((a, i) => a + i.amount - i.paid, 0);
      const last = inv.rows[0] || null;
      const items = last ? last.items.map((x) => [x.t, x.amt]) : [];
      const prevDebt = open.filter((i) => last && i.month < last.month).reduce((a, i) => a + i.amount - i.paid, 0);
      if (prevDebt) items.push(['Өмнөх өр', prevDebt]);
      const dueDate = open.length ? open[open.length - 1].due_date : last ? last.due_date : '';
      const days = dueDate ? Math.round((Date.parse(dueDate) - Date.parse(local().date)) / 864e5) : 0;
      out.bill = {
        due,
        total: last ? last.amount + prevDebt : 0,
        month: last ? last.month : cur,
        label: monthLabel(last ? last.month : cur),
        code: last ? last.code : '',
        items,
        dueDate: md(dueDate),
        days,
        history: pays.rows.map((p) => [mdOf(p.paid_at), 'СӨХ · ' + p.channel, p.amount, p.ebarimt ? 'eBarimt' : '']),
      };
      out.paid = due === 0;
      // цэцэг: хугацаа ойртох тусам хатна (0 — шинэ, 1 — бүрэн хатсан)
      out.wilt = out.paid ? 0 : Math.min(1, Math.max(0.15, 0.6 - days * 0.05));
      out.me.b = unit ? unit.b : null;
      out.me.n = unit ? unit.n : null;
      out.me.plate = unit ? unit.plate : '';
      out.me.bill = out.bill.total || due;
      out.me.fam = me.fam;
      const r = res.rows[0],
        w = queue.rows[0];
      const left = (t) => Math.max(0, Math.round((new Date(t).getTime() - Date.now()) / 1000));
      out.park = r
        ? { stage: r.status === 'held' ? 'reserved' : 'parked', slot: r.slot_id, hold: r.status === 'held' ? left(r.expires_at) : 0, pos: 0, until: ms(r.expires_at) }
        : w
          ? w.status === 'offered'
            ? { stage: 'found', slot: w.slot_id, hold: left(w.offer_expires_at), pos: 1, until: ms(w.offer_expires_at) }
            : { stage: 'waiting', slot: '', hold: 0, pos: w.pos }
          : { stage: 'idle', slot: '', hold: 0, pos: 0 };
      out.rental = rent.rows[0] || null;
      out.payProvider = Pay.provider();
    }
    return out;
  });
};
