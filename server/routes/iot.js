/*
 * 7. Ус алдалт · 8. Гадна гэрэлтүүлэг · IoT төхөөрөмж
 *
 * Төхөөрөмж (админ):
 *   GET    /api/devices          · POST /api/devices { kind: leak|valve|slot|light, ref }  → { device, key } (key нэг л удаа)
 *   DELETE /api/devices/:id
 * Төхөөрөмжөөс (толгой: X-Device-Id, X-Device-Key):
 *   POST /api/iot/leak       { room? }                 ус алдалт илрэв (ref = 'b-n')
 *   POST /api/iot/slot       { occupied, plate?, battery? }
 *   POST /api/iot/light      { on }
 *   POST /api/iot/heartbeat  { battery? }
 *   GET  /api/iot/commands                             хавхлагын команд татах
 *   POST /api/iot/commands/:id/ack { ok }
 * Ус алдалт:
 *   GET  /api/leaks?all=1    · POST /api/leaks { b, n, room } (гараар мэдэгдэх)
 *   POST /api/leaks/:id/close      хавхлага хаах (valve байвал команд, үгүй бол гараар хаасныг бүртгэнэ)
 *   POST /api/leaks/:id/assign     { staff_id? } сантехникч дуудах → хүсэлт үүснэ
 * Гэрэл:
 *   GET  /api/lights  · POST /api/lights/:id/report (эвдэрсэн)  · POST /api/lights/:id/fix (админ → цахилгаанчинд даалгавар)
 */
const db = require('../db');
const C = require('../lib/core');
const R = require('../lib/requests');
const P = require('../lib/parking');
const { notify, flush } = require('../lib/notify');
const { HttpError, bad, notFound, forbid, clean, int, rid, sha256, safeEq, next, pad, unitKey } = require('../lib/util');

const ROOMS = ['Угаалгын өрөө', 'Гал тогоо', 'Бойлер', 'Бусад'];
const KINDS = ['leak', 'valve', 'slot', 'light'];

/** Төхөөрөмжийн нэвтрэлт */
async function device(c) {
  const id = String(c.req.headers['x-device-id'] || ''),
    key = String(c.req.headers['x-device-key'] || '');
  const { rows } = id ? await db.query('select * from devices where id = $1', [id]) : { rows: [] };
  const d = rows[0];
  if (!d || !safeEq(d.secret_hash, sha256(key))) throw new HttpError(401, 'Төхөөрөмж танигдсангүй');
  return d;
}
async function seen(d, x) {
  const bat = Number.isFinite(Number(x && x.battery)) ? Math.round(x.battery) : null;
  await db.query('update devices set last_seen = now(), battery = coalesce($2, battery) where id = $1', [d.id, bat]);
}

const times = (l) => [l.detected_at, l.notified_at, l.closed_at, l.assigned_at, l.fixed_at];

/** Ус алдалт нээх (давхардуулахгүй) + мэдэгдэл + хавхлага автоматаар хаах команд */
async function openLeak(q, cxRow, { b, n, room, deviceId, by }) {
  const cx = cxRow.id;
  const unit = await C.unitByBN(q, cx, b, n);
  if (!unit) throw bad('Ийм айл алга');
  const ex = await q("select * from leaks where cx_id = $1 and unit_id = $2 and status <> 'fixed' order by id desc limit 1", [cx, unit.id]);
  if (ex.rows[0]) return { leak: ex.rows[0], dup: true };
  const code = 'LK-' + pad(await next(q, cx, 'leak', 431), 4);
  const rm = ROOMS.includes(room) ? room : room ? clean(room, 40) : 'Тодорхойгүй';
  const { rows } = await q(
    `insert into leaks (cx_id, code, unit_id, b, n, room, device_id, notified_at)
     values ($1, $2, $3, $4, $5, $6, $7, now()) returning *`,
    [cx, code, unit.id, b, n, rm, deviceId || null],
  );
  const l = rows[0];
  const where = C.unitLabel(b, n);
  await notify(q, cx, { role: 'admin' }, { kind: 'bad', title: 'Ус алдаж байна · ' + where, body: rm + (deviceId ? ' · чип илрүүлэв' : by ? ' · ' + by.name : ''), link: 'leak' }, { sms: true });
  await notify(q, cx, { role: 'staff', cat: 'Сантехник' }, { kind: 'bad', title: 'Ус алдалт · ' + where, body: rm });
  await notify(q, cx, { unit: unit.id }, { kind: 'bad', title: 'Танай ' + rm.toLowerCase() + 'нд ус алдаж байна!', body: 'Хавхлага автоматаар хаагдана' }, { sms: true });
  let cmd = null;
  if (C.settingsOf(cxRow).leak.autoClose) cmd = await closeCmd(q, cx, l);
  await C.touch(q, cx);
  return { leak: l, command: cmd };
}
/** Тухайн айлын хавхлагад хаах команд (аль хэдийн хүлээгдэж байвал дахин нэмэхгүй) */
async function closeCmd(q, cx, l) {
  const v = await q("select id from devices where cx_id = $1 and kind = 'valve' and ref = $2 limit 1", [cx, l.b + '-' + l.n]);
  if (!v.rows[0]) return null;
  const ex = await q("select id from device_commands where device_id = $1 and cmd = 'close' and status in ('queued', 'sent')", [v.rows[0].id]);
  if (ex.rows[0]) return ex.rows[0].id;
  const { rows } = await q(
    "insert into device_commands (cx_id, device_id, cmd, payload) values ($1, $2, 'close', $3::jsonb) returning id",
    [cx, v.rows[0].id, JSON.stringify({ leak: l.id })],
  );
  return rows[0].id;
}
async function markClosed(q, cx, leakId, how) {
  const { rows } = await q(
    "update leaks set status = 'closed', closed_at = now() where id = $1 and cx_id = $2 and status = 'active' returning *",
    [leakId, cx],
  );
  const l = rows[0];
  if (!l) return null;
  await notify(q, cx, { role: 'admin' }, { kind: 'ok', title: 'Хавхлага хаагдлаа', body: C.unitLabel(l.b, l.n) + ' · ' + how });
  if (l.unit_id) await notify(q, cx, { unit: l.unit_id }, { kind: 'ok', title: 'Хавхлага хаагдлаа', body: 'Ус зогслоо · сантехникч дуудагдана' });
  await C.touch(q, cx);
  return l;
}

module.exports = (on) => {
  /* ---------- төхөөрөмж ---------- */
  on('GET', '/api/devices', async (c) => {
    const me = await c.need('admin');
    const { rows } = await db.query('select id, kind, ref, battery, last_seen, created_at from devices where cx_id = $1 order by kind, ref', [me.cx_id]);
    return rows;
  });
  on('POST', '/api/devices', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    if (!KINDS.includes(x.kind)) throw bad('Төрөл: leak | valve | slot | light');
    const ref = clean(x.ref, 20);
    if (x.kind === 'leak' || x.kind === 'valve') {
      const k = unitKey(ref);
      if (!k || !(await C.unitByBN(db.query, me.cx_id, k.b, k.n))) throw bad('Айл буруу (жишээ: 5-34)');
    } else {
      const t = x.kind === 'slot' ? 'slots' : 'lights';
      const { rows } = await db.query(`select 1 from ${t} where cx_id = $1 and id = $2`, [me.cx_id, ref]);
      if (!rows.length) throw bad(x.kind === 'slot' ? 'Зогсоол олдсонгүй' : 'Гэрэл олдсонгүй');
    }
    const id = 'dev-' + rid(8),
      key = rid(24);
    await db.query('insert into devices (id, cx_id, kind, ref, secret_hash) values ($1, $2, $3, $4, $5)', [id, me.cx_id, x.kind, ref, sha256(key)]);
    await C.audit(db.query, c, 'device.create', 'device', id, { kind: x.kind, ref });
    return { ok: true, device: { id, kind: x.kind, ref }, key, msg: 'Түлхүүрийг хадгалаарай — дахин харагдахгүй' };
  });
  on('DELETE', '/api/devices/:id', async (c) => {
    const me = await c.need('admin');
    const r = await db.query('delete from devices where id = $1 and cx_id = $2', [c.params.id, me.cx_id]);
    if (!(r.affectedRows || r.rowCount)) throw notFound();
    await C.audit(db.query, c, 'device.delete', 'device', c.params.id);
    return { ok: true };
  });

  /* ---------- төхөөрөмжөөс ирэх дохио ---------- */
  on('POST', '/api/iot/heartbeat', async (c) => {
    const d = await device(c);
    await seen(d, await c.json());
    return { ok: true };
  });
  on('POST', '/api/iot/leak', async (c) => {
    const d = await device(c);
    if (d.kind !== 'leak') throw forbid('Ус алдалтын мэдрэгч биш');
    const x = await c.json();
    await seen(d, x);
    const k = unitKey(d.ref);
    const r = await db.tx(async (q) => openLeak(q, await C.getComplex(q, d.cx_id), { b: k.b, n: k.n, room: x.room, deviceId: d.id }));
    await flush();
    return { ok: true, leak: r.leak.code, dup: !!r.dup, command: r.command || null };
  });
  on('POST', '/api/iot/slot', async (c) => {
    const d = await device(c);
    if (d.kind !== 'slot') throw forbid('Зогсоолын мэдрэгч биш');
    const x = await c.json();
    await seen(d, x);
    return db.tx(async (q) => P.sensor(q, await C.getComplex(q, d.cx_id), d.ref, { occupied: !!x.occupied, plate: x.plate, battery: x.battery }));
  });
  on('POST', '/api/iot/light', async (c) => {
    const d = await device(c);
    if (d.kind !== 'light') throw forbid('Гэрлийн мэдрэгч биш');
    const x = await c.json();
    await seen(d, x);
    return db.tx(async (q) => {
      const { rows } = await q('select * from lights where cx_id = $1 and id = $2 for update', [d.cx_id, d.ref]);
      const l = rows[0];
      if (!l) throw notFound();
      if (!x.on && l.status === 'on') {
        await q("update lights set status = 'off', updated_at = now() where cx_id = $1 and id = $2", [d.cx_id, d.ref]);
        await notify(q, d.cx_id, { role: 'admin' }, { kind: 'warn', title: 'Гэрэл асахгүй байна · ' + l.id, body: l.loc + ' · мэдрэгч илрүүлэв', link: 'map' });
        await C.touch(q, d.cx_id);
      }
      return { ok: true };
    });
  });
  on('GET', '/api/iot/commands', async (c) => {
    const d = await device(c);
    await seen(d);
    const { rows } = await db.query(
      "update device_commands set status = 'sent', sent_at = now() where device_id = $1 and status = 'queued' returning id, cmd, payload",
      [d.id],
    );
    return rows;
  });
  on('POST', '/api/iot/commands/:id/ack', async (c) => {
    const d = await device(c);
    const x = await c.json();
    return db.tx(async (q) => {
      const { rows } = await q(
        "update device_commands set status = $3, done_at = now() where id = $1 and device_id = $2 and status in ('queued', 'sent') returning *",
        [int(c.params.id, 1) || 0, d.id, x.ok === false ? 'failed' : 'done'],
      );
      const cmd = rows[0];
      if (!cmd) throw notFound('Команд олдсонгүй');
      if (cmd.cmd === 'close' && x.ok !== false && cmd.payload.leak) await markClosed(q, d.cx_id, cmd.payload.leak, 'автоматаар');
      if (cmd.cmd === 'close' && x.ok === false)
        await notify(q, d.cx_id, { role: 'admin' }, { kind: 'bad', title: 'Хавхлага хаагдсангүй!', body: d.ref + ' · гараар хаана уу', link: 'leak' });
      return { ok: true };
    });
  });

  /* ---------- ус алдалт ---------- */
  on('GET', '/api/leaks', async (c) => {
    const me = await c.need();
    const p = [me.cx_id];
    let w = c.query.all === '1' ? '' : " and (l.status <> 'fixed' or l.fixed_at > now() - interval '1 day')";
    if (me.role === 'resident') {
      if (!me.unit_id) return [];
      w += ' and l.unit_id = $' + p.push(me.unit_id);
    }
    const { rows } = await db.query(
      `select l.* from leaks l where l.cx_id = $1 ${w} order by l.detected_at desc limit $${p.push(int(c.query.limit, 1, 500) || 100)}`,
      p,
    );
    return rows.map((l) => ({ ...l, times: times(l) }));
  });
  on('POST', '/api/leaks', async (c) => {
    const me = await c.need();
    const x = await c.json();
    let b = int(x.b, 1),
      n = int(x.n, 1);
    if (me.role === 'resident') {
      if (!me.unit_id) throw bad('Таны бүртгэл айлтай холбогдоогүй байна');
      const u = (await db.query('select b, n from units where id = $1', [me.unit_id])).rows[0];
      b = u.b;
      n = u.n;
    }
    if (!b || !n) throw bad('Байр, тоот оруулна уу');
    const r = await db.tx(async (q) => openLeak(q, await C.getComplex(q, me.cx_id), { b, n, room: x.room, by: me }));
    await flush();
    await C.audit(db.query, c, 'leak.report', 'leak', r.leak.id);
    return { ok: true, dup: !!r.dup, leak: { ...r.leak, times: times(r.leak) } };
  });
  on('POST', '/api/leaks/:id/close', async (c) => {
    const me = await c.need('admin', 'staff');
    return db.tx(async (q) => {
      const { rows } = await q('select * from leaks where id = $1 and cx_id = $2 for update', [int(c.params.id, 1) || 0, me.cx_id]);
      const l = rows[0];
      if (!l) throw notFound();
      if (l.status !== 'active') throw bad('Хавхлага аль хэдийн хаагдсан');
      const cmd = await closeCmd(q, me.cx_id, l);
      if (cmd) return { ok: true, queued: true, msg: 'Хавхлага хаах команд илгээгдлээ' };
      await markClosed(q, me.cx_id, l.id, me.name);
      return { ok: true, msg: 'Хавхлага хаагдсаныг бүртгэлээ' };
    });
  });
  on('POST', '/api/leaks/:id/assign', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    return db.tx(async (q) => {
      const { rows } = await q('select * from leaks where id = $1 and cx_id = $2 for update', [int(c.params.id, 1) || 0, me.cx_id]);
      const l = rows[0];
      if (!l) throw notFound();
      if (l.status === 'fixed' || l.request_id) throw bad('Сантехникч аль хэдийн дуудагдсан');
      let st = null;
      if (x.staff_id)
        st = (await q("select id, name from accounts where id = $1 and cx_id = $2 and role = 'staff' and status = 'active'", [x.staff_id, me.cx_id])).rows[0];
      else st = await C.pickStaff(q, me.cx_id, 'Сантехник');
      if (!st) throw bad('Сантехникч олдсонгүй');
      const unit = l.unit_id ? (await q('select * from units where id = $1', [l.unit_id])).rows[0] : null;
      const r = await R.create(q, me.cx_id, {
        title: 'Ус алдалт · ' + l.room,
        cat: 'Сантехник',
        priority: 'HIGH',
        descr: l.code + ' · ' + C.unitLabel(l.b, l.n),
        unit,
        source: 'system',
        ref: 'leak:' + l.id,
        by: me,
        assignee: st,
      });
      await q(
        `update leaks set status = 'fixing', assigned_at = now(), assignee_id = $2, assignee_name = $3, request_id = $4
         where id = $1`,
        [l.id, st.id, st.name, r.id],
      );
      await C.audit(q, c, 'leak.assign', 'leak', l.id, { staff: st.name });
      return { ok: true, request: r.code, msg: st.name + ' дуудагдлаа' };
    });
  });

  /* ---------- гэрэл ---------- */
  on('GET', '/api/lights', async (c) => {
    const me = await c.need();
    const { rows } = await db.query('select id, loc, x, z, status, request_id, updated_at from lights where cx_id = $1 order by id', [me.cx_id]);
    return rows;
  });
  on('POST', '/api/lights/:id/report', async (c) => {
    const me = await c.need();
    return db.tx(async (q) => {
      const { rows } = await q("update lights set status = 'off', updated_at = now() where cx_id = $1 and id = $2 and status = 'on' returning *", [me.cx_id, c.params.id]);
      if (!rows[0]) {
        const ex = await q('select 1 from lights where cx_id = $1 and id = $2', [me.cx_id, c.params.id]);
        if (!ex.rows.length) throw notFound('Гэрэл олдсонгүй');
        return { ok: true, msg: 'Аль хэдийн бүртгэгдсэн' };
      }
      await notify(q, me.cx_id, { role: 'admin' }, { kind: 'warn', title: 'Гэрэл асахгүй байна · ' + rows[0].id, body: rows[0].loc + ' · ' + me.name, link: 'map' });
      await C.touch(q, me.cx_id);
      return { ok: true, msg: 'Мэдэгдэл илгээгдлээ' };
    });
  });
  on('POST', '/api/lights/:id/fix', async (c) => {
    const me = await c.need('admin');
    return db.tx(async (q) => {
      const { rows } = await q('select * from lights where cx_id = $1 and id = $2 for update', [me.cx_id, c.params.id]);
      const l = rows[0];
      if (!l) throw notFound('Гэрэл олдсонгүй');
      if (l.status === 'fixing') throw bad('Засварын хүсэлт аль хэдийн үүссэн');
      if (l.status === 'on') throw bad('Гэрэл хэвийн ажиллаж байна');
      const st = await C.pickStaff(q, me.cx_id, 'Цахилгаан');
      const r = await R.create(q, me.cx_id, {
        title: 'Гадна гэрэл ' + l.id + ' асахгүй',
        cat: 'Цахилгаан',
        priority: 'MED',
        descr: l.loc,
        source: 'system',
        ref: 'light:' + l.id,
        by: me,
        assignee: st,
        where: l.loc,
      });
      await q("update lights set status = 'fixing', request_id = $3, updated_at = now() where cx_id = $1 and id = $2", [me.cx_id, l.id, r.id]);
      await C.audit(q, c, 'light.fix', 'light', l.id, { request: r.code });
      return { ok: true, request: r.code, msg: 'Засварын хүсэлт үүслээ' + (st ? ' · ' + st.name + '-д оноогдлоо' : '') };
    });
  });
};
