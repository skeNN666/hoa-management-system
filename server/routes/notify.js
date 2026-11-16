/*
 * 11. Мэдэгдэл · realtime · cron
 *   GET  /api/notifications?after=&limit=   хэрэглэгчийн өөрийн мэдэгдэл + уншаагүй тоо
 *   POST /api/notifications/read             { ids? } (ids өгөхгүй бол бүгдийг)
 *   GET  /api/sync?since=<notif id>          { ver, notifs, unread } — client 5–8 сек тутам
 *   GET  /api/stream?since=                  SSE: ~25 сек ажиллаад хаагдана, EventSource дахин холбогдоно
 *   GET  /api/cron/daily                     Cloudflare Cron Trigger (Authorization: Bearer CRON_SECRET):
 *                                            нэхэмжлэл, сануулга, SLA, зогсоол, SMS, цэвэрлэгээ
 */
const db = require('../db');
const C = require('../lib/core');
const B = require('../lib/billing');
const R = require('../lib/requests');
const P = require('../lib/parking');
const { flush, isProd } = require('../lib/notify');
const { HttpError, int, safeEq } = require('../lib/util');

/** Хотхон бүрт 15 сек тутам нэг удаа: SLA, зогсоолын хугацаа (instance дотор) */
const last = new Map();
async function housekeep(cx) {
  const t = last.get(cx) || 0;
  if (Date.now() - t < 15000) return;
  last.set(cx, Date.now());
  const row = await C.getComplex(db.query, cx);
  await R.checkSla(db.query, row);
  await db.tx((q) => P.expire(q, row));
}

async function snapshot(me, since) {
  const [v, n, u] = await Promise.all([
    db.query('select ver from complexes where id = $1', [me.cx_id]),
    db.query(
      'select id, kind, title, body, link, unread, created_at from notifications where account_id = $1 and id > $2 order by id desc limit 50',
      [me.id, since],
    ),
    db.query('select count(*)::int as n from notifications where account_id = $1 and unread', [me.id]),
  ]);
  return { ver: v.rows[0] ? v.rows[0].ver : 0, notifs: n.rows, unread: u.rows[0].n };
}

module.exports = (on) => {
  on('GET', '/api/notifications', async (c) => {
    const me = await c.need();
    const after = int(c.query.after, 0) || 0;
    const { rows } = await db.query(
      `select id, kind, title, body, link, unread, created_at from notifications
       where account_id = $1 and ($2 = 0 or id < $2) order by id desc limit $3`,
      [me.id, after, int(c.query.limit, 1, 100) || 30],
    );
    const u = await db.query('select count(*)::int as n from notifications where account_id = $1 and unread', [me.id]);
    return { list: rows, unread: u.rows[0].n };
  });
  on('POST', '/api/notifications/read', async (c) => {
    const me = await c.need();
    const x = await c.json();
    const ids = Array.isArray(x.ids) ? x.ids.map(Number).filter(Number.isInteger) : null;
    await db.query(
      `update notifications set unread = false where account_id = $1 and unread ${ids ? 'and id = any($2)' : ''}`,
      ids ? [me.id, ids] : [me.id],
    );
    return { ok: true };
  });

  on('GET', '/api/sync', async (c) => {
    const me = await c.need();
    await housekeep(me.cx_id);
    return snapshot(me, int(c.query.since, 0) || 0);
  });

  on('GET', '/api/stream', async (c) => {
    const me = await c.need();
    const res = c.res;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    let since = int(c.query.since || c.req.headers['last-event-id'], 0) || 0;
    let ver = -1,
      open = true;
    c.req.on('close', () => (open = false));
    const end = Date.now() + (Number(process.env.SSE_SECONDS) || 25) * 1000;
    while (open && Date.now() < end) {
      await housekeep(me.cx_id).catch(() => {});
      const s = await snapshot(me, since);
      if (s.ver !== ver || s.notifs.length) {
        if (s.notifs.length) since = s.notifs[0].id;
        ver = s.ver;
        res.write('id: ' + since + '\nevent: sync\ndata: ' + JSON.stringify(s) + '\n\n');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    res.end();
  });

  on('GET', '/api/cron/daily', async (c) => {
    const secret = process.env.CRON_SECRET;
    const h = String(c.req.headers.authorization || '');
    if (secret ? !safeEq(h, 'Bearer ' + secret) : isProd()) throw new HttpError(401, 'Unauthorized');
    const out = {};
    const { rows } = await db.query('select * from complexes order by id');
    for (const cx of rows) {
      try {
        const r = await B.daily(cx);
        const sla = await R.checkSla(db.query, cx);
        const park = await db.tx((q) => P.expire(q, cx));
        out[cx.id] = { invoices: r.invoices, before: r.before, after: r.after, sla, park };
      } catch (e) {
        console.error('cron', cx.id, e);
        out[cx.id] = { error: String(e.message || e) };
      }
    }
    const sms = await flush({ limit: 500 });
    await db.query('delete from sessions where expires_at < now()');
    await db.query('delete from rate_limits where reset_at < now()');
    await db.query("delete from otps where expires_at < now() - interval '1 day'");
    await db.query("delete from notifications where not unread and created_at < now() - interval '180 days'");
    return { ok: true, sms, complexes: out };
  });
};
