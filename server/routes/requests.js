/*
 * 6. Засварын хүсэлт · ажилтан
 *   POST /api/requests                 { title, cat, priority, descr, b?, n? } (оршин суугч → өөрийн айл)
 *   GET  /api/requests?scope=&status=  оршин суугч: өөрийнх · ажилтан: pool (ангиллын шинэ) | mine · админ: бүгд
 *   GET  /api/requests/:id             дэлгэрэнгүй + түүх + зураг
 *   POST /api/requests/:id/take        (ажилтан) хүлээж авах
 *   POST /api/requests/:id/assign      (админ) { staff_id }
 *   POST /api/requests/:id/status      { status, note }
 *   POST /api/requests/:id/photos?kind=before|after   body = зураг
 *   GET  /api/staff                    (админ, ажилтан) ажилтнууд + ачаалал, хийсэн ажил
 */
const db = require('../db');
const C = require('../lib/core');
const R = require('../lib/requests');
const { bad, notFound, forbid, clean, int } = require('../lib/util');

const CATS = ['Лифт', 'Сантехник', 'Цахилгаан', 'Дулаан', 'Засвар', 'Ариун цэвэр', 'Харуул', 'Цэвэрлэгээ', 'Тохижилт', 'Бусад'];
const PRI = ['LOW', 'MED', 'HIGH'];

/** Хүсэлтийг харах эрх */
function canSee(me, r) {
  if (me.role === 'admin') return true;
  if (me.role === 'resident') return r.unit_id && r.unit_id === me.unit_id;
  return r.assignee_id === me.id || (r.status === 0 && (!me.cats.length || me.cats.includes(r.cat)));
}
async function load(q, me, id, lock) {
  const { rows } = await q('select * from requests where id = $1 and cx_id = $2' + (lock ? ' for update' : ''), [
    int(id, 1) || 0,
    me.cx_id,
  ]);
  if (!rows[0] || !canSee(me, rows[0])) throw notFound('Хүсэлт олдсонгүй');
  return rows[0];
}
const LIST = `select r.*, (select count(*)::int from request_photos p where p.request_id = r.id) as photos,
  extract(epoch from (now() - r.created_at))::int as age from requests r`;

module.exports = (on) => {
  on('POST', '/api/requests', async (c) => {
    const me = await c.need();
    const x = await c.json();
    const title = clean(x.title, 140);
    if (title.length < 3) throw bad('Гарчгаа бичнэ үү');
    const cat = CATS.includes(x.cat) ? x.cat : 'Бусад';
    const priority = PRI.includes(x.priority || x.p) ? x.priority || x.p : 'MED';
    return db.tx(async (q) => {
      let unit = null;
      if (me.role === 'resident') {
        if (!me.unit_id) throw bad('Таны бүртгэл айлтай холбогдоогүй байна');
        unit = (await q('select * from units where id = $1', [me.unit_id])).rows[0];
      } else if (x.b && x.n) {
        unit = await C.unitByBN(q, me.cx_id, int(x.b, 1), int(x.n, 1));
        if (!unit) throw bad('Ийм айл алга');
      }
      const r = await R.create(q, me.cx_id, {
        title,
        cat,
        priority,
        descr: clean(x.descr || x.desc, 2000),
        unit,
        source: me.role,
        by: me,
      });
      await C.audit(q, c, 'request.create', 'request', r.id, { code: r.code });
      return { ...r, photos: 0 };
    });
  });

  on('GET', '/api/requests', async (c) => {
    const me = await c.need();
    if (me.role !== 'resident') await R.checkSla(db.query, await C.getComplex(db.query, me.cx_id));
    const p = [me.cx_id];
    let w = '';
    if (me.role === 'resident') {
      if (!me.unit_id) return [];
      w += ' and r.unit_id = $' + p.push(me.unit_id);
    } else if (me.role === 'staff') {
      const mine = () => 'r.assignee_id = $' + p.push(me.id);
      const pool = () => (me.cats.length ? 'r.status = 0 and r.cat = any($' + p.push(me.cats) + ')' : 'r.status = 0');
      w += c.query.scope === 'mine' ? ' and ' + mine() : c.query.scope === 'pool' ? ' and ' + pool() : ` and (${mine()} or (${pool()}))`;
    }
    if (c.query.status !== undefined && c.query.status !== '') w += ' and r.status = $' + p.push(int(c.query.status, 0, 4) || 0);
    if (c.query.open === '1') w += ' and r.status < 4';
    const { rows } = await db.query(
      `${LIST} where r.cx_id = $1 ${w} order by (r.status = 4), r.created_at desc limit $${p.push(int(c.query.limit, 1, 500) || 200)}`,
      p,
    );
    return rows;
  });

  on('GET', '/api/requests/:id', async (c) => {
    const me = await c.need();
    const r = await load(db.query, me, c.params.id);
    const [ev, ph] = await Promise.all([
      db.query('select status, note, by_name, at from request_events where request_id = $1 order by id', [r.id]),
      db.query("select kind, at, 'api/files/' || file_id as url from request_photos where request_id = $1 order by id", [r.id]),
    ]);
    return { ...r, events: ev.rows, photos: ph.rows };
  });

  on('POST', '/api/requests/:id/take', async (c) => {
    const me = await c.need('staff');
    return db.tx(async (q) => {
      const r = await load(q, me, c.params.id, true);
      if (r.status !== 0) throw bad('Энэ хүсэлтийг аль хэдийн хүлээж авсан байна');
      return R.assign(q, r, me, me);
    });
  });

  on('POST', '/api/requests/:id/assign', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    return db.tx(async (q) => {
      const r = await load(q, me, c.params.id, true);
      const { rows } = await q("select * from accounts where id = $1 and cx_id = $2 and role = 'staff' and status = 'active'", [
        x.staff_id,
        me.cx_id,
      ]);
      if (!rows[0]) throw bad('Ажилтан олдсонгүй');
      const out = await R.assign(q, r, rows[0], me);
      await C.audit(q, c, 'request.assign', 'request', r.id, { staff: rows[0].login });
      return out;
    });
  });

  on('POST', '/api/requests/:id/status', async (c) => {
    const me = await c.need('admin', 'staff');
    const x = await c.json();
    return db.tx(async (q) => {
      const r = await load(q, me, c.params.id, true);
      const out = await R.setStatus(q, r, int(x.status, 0, 4), me, clean(x.note, 300));
      await C.audit(q, c, 'request.status', 'request', r.id, { status: out.status });
      return out;
    });
  });

  on('POST', '/api/requests/:id/photos', async (c) => {
    const me = await c.need();
    const kind = c.query.kind === 'after' ? 'after' : 'before';
    const buf = await c.raw(C.MAX_FILE + 1);
    return db.tx(async (q) => {
      const r = await load(q, me, c.params.id, true);
      if (me.role === 'resident' && kind === 'after') throw forbid('Дараах зургийг ажилтан оруулна');
      if (me.role === 'staff' && r.assignee_id !== me.id) throw forbid('Энэ хүсэлт танд оноогдоогүй байна');
      if (r.status === 4) throw bad('Шийдэгдсэн хүсэлтэд зураг нэмэхгүй');
      const f = await C.saveFile(q, me.cx_id, buf, me.login, false);
      await q('insert into request_photos (request_id, file_id, kind, by_id) values ($1, $2, $3, $4)', [r.id, f.id, kind, me.id]);
      await C.touch(q, me.cx_id);
      return { ok: true, url: f.url, kind };
    });
  });

  on('GET', '/api/staff', async (c) => {
    const me = await c.need('admin', 'staff');
    const { rows } = await db.query(
      `select a.id, a.login, a.name, a.pos, a.cats, a.phone, a.status,
         count(r.id) filter (where r.status between 1 and 3)::int as open,
         count(r.id) filter (where r.status = 4)::int as done
       from accounts a left join requests r on r.assignee_id = a.id
       where a.cx_id = $1 and a.role = 'staff' and a.status <> 'rejected'
       group by a.id order by a.login`,
      [me.cx_id],
    );
    return me.role === 'admin' ? rows : rows.map(({ phone, ...s }) => s);
  });
};
