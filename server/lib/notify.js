/*
 * Мэдэгдэл (хэрэглэгч бүрт тусдаа) + SMS/push outbox.
 *
 *   notify(q, cx, to, { kind, title, body, link }, { sms })
 *     to: { account } | { role } | { role: 'staff', cat } | { unit } | { role: 'resident' }
 *     cat: тухайн ангиллын ажилтнууд; тийм ажилтан байхгүй бол бүх ажилтан
 *   sms(q, cx, phones, text)  — outbox-д нэмнэ
 *   flush({ ids })            — outbox-ыг илгээнэ (SMS_WEBHOOK_URL / PUSH_WEBHOOK_URL)
 */
const db = require('../db');

const isProd = () => process.env.NODE_ENV === 'production';

function target(to, params) {
  const w = ["a.cx_id = $1", "a.status = 'active'"];
  const p = (v) => (params.push(v), '$' + params.length);
  if (to.account) w.push('a.id = ' + p(to.account));
  if (to.accounts) w.push('a.id = any(' + p(to.accounts) + ')');
  if (to.role) w.push('a.role = ' + p(to.role));
  if (to.unit) w.push('a.unit_id = ' + p(to.unit));
  if (to.cat) {
    const k = p(to.cat);
    w.push(
      `(a.role <> 'staff' or ${k} = any(a.cats) or not exists (
         select 1 from accounts s where s.cx_id = $1 and s.role = 'staff' and s.status = 'active'
         and ${k} = any(s.cats)))`,
    );
  }
  return w.join(' and ');
}

/** → мэдэгдэл хүлээн авсан хэрэглэгчийн тоо */
async function notify(q, cx, to, n, opt = {}) {
  const params = [cx];
  const where = target(to, params);
  const base = params.length;
  const r = await q(
    `insert into notifications (cx_id, account_id, kind, title, body, link)
     select $1, a.id, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}
     from accounts a where ${where}`,
    params.concat([n.kind || 'acc', n.title, n.body || '', n.link || '']),
  );
  if (opt.sms) {
    const txt = opt.sms === true ? n.title + (n.body ? ': ' + n.body : '') : opt.sms;
    await q(
      `insert into outbox (cx_id, channel, to_addr, body)
       select distinct $1, 'sms', a.phone, $${base + 1} from accounts a
       where ${where} and a.phone <> ''`,
      params.concat([txt]),
    );
  }
  return r.affectedRows != null ? r.affectedRows : r.rowCount || 0;
}

/** Утасны дугааруудад SMS (outbox) → үүссэн id-ууд */
async function sms(q, cx, phones, text) {
  const list = [...new Set(phones.filter((x) => /^\d{8}$/.test(x)))];
  if (!list.length) return [];
  const { rows } = await q(
    `insert into outbox (cx_id, channel, to_addr, body)
     select $1, 'sms', x, $3 from unnest($2::text[]) x returning id`,
    [cx, list, text],
  );
  return rows.map((r) => r.id);
}

/**
 * Outbox-ыг илгээнэ. Provider нь энгийн webhook: POST { to, text, id } (Authorization: Bearer …).
 * Webhook тохируулаагүй бол мессеж queued хэвээр үлдэнэ (хөгжүүлэлтэд console-д хэвлэнэ).
 */
async function flush({ ids, limit = 50 } = {}) {
  const url = { sms: process.env.SMS_WEBHOOK_URL, push: process.env.PUSH_WEBHOOK_URL };
  const tok = { sms: process.env.SMS_WEBHOOK_TOKEN, push: process.env.PUSH_WEBHOOK_TOKEN };
  const { rows } = await db.query(
    `select * from outbox where status = 'queued' and tries < 5
     ${ids ? 'and id = any($2)' : ''} order by id limit $1`,
    ids ? [limit, ids] : [limit],
  );
  let sent = 0;
  for (const m of rows) {
    if (!url[m.channel]) {
      if (!isProd() && !process.env.QUIET)
        console.log('[' + m.channel + ' → ' + m.to_addr + '] ' + m.body);
      continue;
    }
    try {
      const r = await fetch(url[m.channel], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tok[m.channel] ? { Authorization: 'Bearer ' + tok[m.channel] } : {}),
        },
        body: JSON.stringify({ to: m.to_addr, text: m.body, id: m.id }),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await db.query("update outbox set status = 'sent', sent_at = now() where id = $1", [m.id]);
      sent++;
    } catch (e) {
      await db.query(
        `update outbox set tries = tries + 1, error = $2,
         status = case when tries + 1 >= 5 then 'failed' else 'queued' end where id = $1`,
        [m.id, String(e.message || e).slice(0, 200)],
      );
    }
  }
  return sent;
}

module.exports = { notify, sms, flush, isProd };
