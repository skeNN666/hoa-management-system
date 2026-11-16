/*
 * Засварын хүсэлтийн гол логик (оршин суугч, гэрэл, ус алдалт — бүгд үүгээр дамжина).
 * Төлөв: 0 Шинэ → 1 Хүлээн авсан → 2 Хийгдэж буй ⇄ 3 Хүлээгдэж буй → 4 Шийдэгдсэн
 * Шийдэгдсэн болгоход «дараах» зураг заавал. Шийдэгдвэл хийсэн ажлын тайланд бүртгэгдэнэ.
 */
const C = require('./core');
const { notify } = require('./notify');
const { next, bad, conflict } = require('./util');

const STATUS = ['Шинэ', 'Хүлээн авсан', 'Хийгдэж буй', 'Хүлээгдэж буй', 'Шийдэгдсэн'];
// staff (хариуцагч) хийж болох шилжилт; админ 0-оос бусад руу чөлөөтэй
const FLOW = { 1: [2, 3], 2: [3, 4], 3: [2, 4] };

const event = (q, id, status, by, note) =>
  q('insert into request_events (request_id, status, note, by_id, by_name) values ($1, $2, $3, $4, $5)', [
    id,
    status,
    note || '',
    by ? by.id : null,
    by ? by.name : 'Систем',
  ]);

/** Шинэ хүсэлт → мөр. x: { title, cat, priority, descr, unit, source, ref, by, assignee } */
async function create(q, cx, x) {
  const code = 'REQ-' + (await next(q, cx, 'req', 1052));
  const a = x.assignee || null;
  const { rows } = await q(
    `insert into requests (cx_id, code, unit_id, b, n, title, cat, priority, descr, source, ref,
       created_by, status, assignee_id, assignee_name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning *`,
    [
      cx,
      code,
      x.unit ? x.unit.id : null,
      x.unit ? x.unit.b : x.b || null,
      x.unit ? x.unit.n : x.n || null,
      x.title,
      x.cat,
      x.priority || 'MED',
      x.descr || '',
      x.source || 'resident',
      x.ref || '',
      x.by ? x.by.id : null,
      a ? 1 : 0,
      a ? a.id : null,
      a ? a.name : '',
    ],
  );
  const r = rows[0];
  await event(q, r.id, 0, x.by, 'Үүсгэв');
  if (a) await event(q, r.id, 1, null, 'Автоматаар оноов · ' + a.name);
  const where = r.b ? C.unitLabel(r.b, r.n) : x.where || '';
  await notify(q, cx, { role: 'admin' }, { kind: 'acc', title: 'Шинэ хүсэлт · ' + r.cat, body: code + ' · ' + r.title, link: 'requests' });
  if (a)
    await notify(q, cx, { account: a.id }, { kind: 'acc', title: 'Танд даалгавар оноогдлоо', body: code + ' · ' + r.title + (where ? ' · ' + where : ''), link: 'tasks' });
  else
    await notify(q, cx, { role: 'staff', cat: r.cat }, {
      kind: 'acc',
      title: 'Шинэ хүсэлт ирлээ · ' + r.cat,
      body: code + ' · ' + r.title + (where ? ' · ' + where : ''),
      link: 'pool',
    });
  await C.touch(q, cx);
  return r;
}

/** Ажилтан хүлээж авах / админ оноох (зэрэг дарвал зөвхөн нэг нь авна) */
async function assign(q, req, staff, by) {
  const { rows } = await q(
    `update requests set status = 1, assignee_id = $2, assignee_name = $3, status_at = now()
     where id = $1 and (status = 0 or $4) and status < 4 returning *`,
    [req.id, staff.id, staff.name, by.role === 'admin'],
  );
  if (!rows[0]) throw conflict('Энэ хүсэлтийг өөр ажилтан аль хэдийн хүлээж авсан');
  const r = rows[0];
  await event(q, r.id, 1, by, by.id === staff.id ? 'Хүлээн авав' : 'Оноов · ' + staff.name);
  if (r.unit_id)
    await notify(q, r.cx_id, { unit: r.unit_id }, { kind: 'acc', title: 'Хүсэлтийг хүлээн авлаа', body: r.code + ' · ' + staff.name });
  if (by.id !== staff.id)
    await notify(q, r.cx_id, { account: staff.id }, { kind: 'acc', title: 'Танд даалгавар оноогдлоо', body: r.code + ' · ' + r.title, link: 'tasks' });
  await C.touch(q, r.cx_id);
  return r;
}

/** Төлөв солих (шалгалт, мэдэгдэл, шийдэгдсэн үеийн үр дагавар) */
async function setStatus(q, req, status, by, note) {
  if (!(status >= 1 && status <= 4)) throw bad('Буруу төлөв');
  if (by.role === 'staff') {
    if (req.assignee_id !== by.id) throw bad('Энэ хүсэлт танд оноогдоогүй байна');
    if (!(FLOW[req.status] || []).includes(status))
      throw bad(STATUS[req.status] + ' → ' + STATUS[status] + ' шилжих боломжгүй');
  } else if (by.role !== 'admin') throw bad('Эрх хүрэхгүй');
  if (req.status === 4) throw bad('Шийдэгдсэн хүсэлтийг өөрчлөхгүй');
  if (status === 1 && !req.assignee_id) throw bad('Эхлээд ажилтан ононо уу');
  if (status === 4) {
    const { rows } = await q("select count(*)::int as n from request_photos where request_id = $1 and kind = 'after'", [req.id]);
    if (!rows[0].n) throw bad('Шийдсэн ажлынхаа зургийг оруулсны дараа батална');
  }
  const { rows } = await q(
    `update requests set status = $2::smallint, status_at = now(),
       resolved_at = case when $2::smallint = 4 then now() else null end
     where id = $1 and status = $3::smallint returning *`,
    [req.id, status, req.status],
  );
  if (!rows[0]) throw conflict('Хүсэлтийн төлөв өөрчлөгдсөн байна — дахин ачаална уу');
  const r = rows[0];
  await event(q, r.id, status, by, note);
  const who = r.assignee_name || by.name;
  if (status === 2)
    await notify(q, r.cx_id, { role: 'admin' }, { kind: 'acc', title: 'Ажил эхэллээ · ' + r.cat, body: r.code + ' · ' + r.title + ' · ' + who });
  if (r.unit_id && status !== 4)
    await notify(q, r.cx_id, { unit: r.unit_id }, {
      kind: 'acc',
      title: status === 2 ? 'Засвар эхэллээ' : 'Хүсэлтийн төлөв: ' + STATUS[status],
      body: r.code + ' · ' + who,
    });
  if (status === 4) await resolved(q, r, who);
  await C.touch(q, r.cx_id);
  return r;
}

/** Шийдэгдсэн: тайланд бүртгэх, гэрэл/ус алдалтыг хаах, мэдэгдэх */
async function resolved(q, r, who) {
  const where = r.b ? r.b + '-р байр' : '';
  let title = r.title,
    location = where;
  const [kind, refId] = r.ref.split(':');
  if (kind === 'light') {
    const { rows } = await q("update lights set status = 'on', request_id = null, updated_at = now() where cx_id = $1 and id = $2 returning loc", [r.cx_id, refId]);
    title = 'Гадна гэрэл ' + refId + ' засав';
    location = rows[0] ? rows[0].loc : '';
  }
  if (kind === 'leak') {
    await q("update leaks set status = 'fixed', fixed_at = now() where id = $1 and cx_id = $2", [Number(refId), r.cx_id]);
    title = 'Ус алдалтыг засаж, хавхлагыг сэргээв · ' + r.n + ' тоот';
  }
  await C.logWork(q, r.cx_id, { cat: r.cat, title, location, by: who, request_id: r.id });
  await notify(q, r.cx_id, { role: 'admin' }, { kind: 'ok', title: 'Ажил дууслаа · ' + r.cat, body: r.code + ' · ' + r.title + ' · ' + who });
  if (r.unit_id)
    await notify(q, r.cx_id, { unit: r.unit_id }, { kind: 'ok', title: 'Таны хүсэлт шийдэгдлээ', body: r.code + ' · ' + who });
  else if (kind === 'light')
    await notify(q, r.cx_id, { role: 'resident' }, { kind: 'ok', title: 'Хийгдсэн ажил · ' + r.cat, body: title + (location ? ' · ' + location : '') });
}

/** SLA: хүлээн аваагүй хэвээр хугацаа хэтэрсэн хүсэлт → админд нэг удаа мэдэгдэнэ */
async function checkSla(q, cxRow) {
  const sla = C.settingsOf(cxRow).sla;
  const { rows } = await q(
    `update requests set sla_alerted = true
     where cx_id = $1 and status = 0 and not sla_alerted and created_at < now() - $2 * interval '1 minute'
     returning code, title, created_at`,
    [cxRow.id, sla],
  );
  for (const r of rows) {
    const min = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000);
    await notify(q, cxRow.id, { role: 'admin' }, { kind: 'warn', title: 'SLA хэтэрсэн хүсэлт', body: r.code + ' · ' + min + ' мин хүлээн аваагүй', link: 'requests' });
  }
  if (rows.length) await C.touch(q, cxRow.id);
  return rows.length;
}

module.exports = { STATUS, create, assign, setStatus, checkSla, event };
