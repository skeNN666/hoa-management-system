/*
 * Backend API-ийн тест (PGlite санах ойд, демо өгөгдөлтэй):  node tests/server.test.js
 * Нэвтрэлт, эрх, хотхоны тусгаарлалт, бүртгэл, map, хүсэлт, гэрэл, ус алдалт (IoT), төлбөр,
 * зогсоол, санхүү, мэдэгдэл, cron, CSRF, статик файлын хамгаалалт.
 */
const assert = require('assert');
const path = require('path');

process.env.PGLITE_DIR = 'memory';
process.env.QUIET = '1';
process.env.CRON_SECRET = 'test-cron';
const server = require(path.join(__dirname, '..', 'server', 'server.js'));
const db = require(path.join(__dirname, '..', 'server', 'db.js'));
const { seed } = require(path.join(__dirname, '..', 'server', 'seed.js'));
const Legacy = require(path.join(__dirname, '..', 'js', 'accounts.js'));

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.alloc(64)]);
let base = '';
let passed = 0,
  failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n    ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n    '));
  }
}

/** Cookie хадгалдаг жижиг client */
class Client {
  constructor() {
    this.cookie = '';
  }
  async req(method, url, body, headers = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    let b;
    if (Buffer.isBuffer(body)) {
      b = body;
      h['content-type'] = h['content-type'] || 'image/png';
    } else if (body !== undefined) {
      b = JSON.stringify(body);
      h['content-type'] = h['content-type'] || 'application/json';
    }
    const r = await fetch(base + url, { method, headers: h, body: b });
    for (const c of r.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (k === 'sokh_sid') this.cookie = v ? 'sokh_sid=' + v : '';
    }
    const text = await r.text();
    let j = null;
    try {
      j = JSON.parse(text);
    } catch (e) {
      j = text;
    }
    return { status: r.status, j, headers: r.headers };
  }
  get(u, h) {
    return this.req('GET', u, undefined, h);
  }
  post(u, b = {}, h) {
    return this.req('POST', u, b, h);
  }
  async login(role, cx, login, pw) {
    const r = await this.post('/api/auth/login', { role, cx, login, pw });
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    return this;
  }
}
const as = (role, cx = 'narny') =>
  new Client().login(role, cx, ...{ admin: ['admin', 'admin2026'], staff: ['EMP-001', 'staff2026'], resident: ['9911 2233', 'bat2026'] }[role]);
const one = async (sql, p) => (await db.query(sql, p)).rows[0];
const ok = (r) => assert.ok(r.status === 200, r.status + ' ' + JSON.stringify(r.j));

server.listen(0, async () => {
  base = 'http://127.0.0.1:' + server.address().port;
  await db.ready();
  await seed();
  const admin = await as('admin');
  const resident = await as('resident');
  const lift = await as('staff'); // Ж. Нарантуяа · Лифт, Засвар

  console.log('Статик файл, CSRF');
  await test('index.html өгнө, server/ node_modules/ .git нууцлагдана', async () => {
    const c = new Client();
    assert.strictEqual((await c.get('/')).status, 200);
    for (const u of ['/server/server.js', '/node_modules/pg/package.json', '/.git/config', '/package.json'])
      assert.strictEqual((await c.get(u)).status, 403, u);
  });
  await test('form төрлийн POST-ыг хүлээж авахгүй (CSRF)', async () => {
    const r = await admin.req('POST', '/api/auth/logout', '{}', { 'content-type': 'text/plain' });
    assert.strictEqual(r.status, 415);
  });

  console.log('1. Нэвтрэлт');
  await test('нууц үг буруу → 400, cookie-гүй', async () => {
    const c = new Client();
    const r = await c.post('/api/auth/login', { role: 'admin', cx: 'narny', login: 'admin', pw: 'xxxxxx' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(c.cookie, '');
  });
  await test('X-Sokh-Role header-ээр админ болж чадахгүй', async () => {
    const r = await new Client().get('/api/accounts', { 'X-Sokh-Role': 'admin', 'X-Sokh-Cx': 'narny' });
    assert.strictEqual(r.status, 401);
  });
  await test('оршин суугч админы endpoint руу орж чадахгүй', async () => {
    assert.strictEqual((await resident.get('/api/accounts')).status, 403);
  });
  await test('/me: оршин суугч өөрийн айлтай', async () => {
    const r = await resident.get('/api/auth/me');
    ok(r);
    assert.strictEqual(r.j.acc.name, 'Бат');
    assert.deepStrictEqual([r.j.unit.b, r.j.unit.n], [5, 34]);
    assert.strictEqual(r.j.acc.pw, undefined);
  });
  await test('8 удаа буруу оролдвол 429', async () => {
    const c = new Client();
    let r;
    for (let i = 0; i < 9; i++) r = await c.post('/api/auth/login', { role: 'staff', cx: 'od', login: 'EMP-002', pw: 'bad' + i });
    assert.strictEqual(r.status, 429);
  });
  await test('хуучин (cyrb53) hash-тай бүртгэл нэвтрэхэд scrypt болно', async () => {
    await db.query(
      "insert into accounts (id, cx_id, role, login, login_key, name, pw) values ('old1', 'narny', 'admin', 'old', 'old', 'Хуучин', $1)",
      [Legacy.hash('oldpass1', 'old1')],
    );
    await new Client().login('admin', 'narny', 'old', 'oldpass1');
    assert.ok((await one("select pw from accounts where id = 'old1'")).pw.startsWith('s1$'));
  });
  await test('нууц үг солих → бусад session хаагдана', async () => {
    const a = await new Client().login('staff', 'narny', 'EMP-012', 'staff2026');
    const b = await new Client().login('staff', 'narny', 'EMP-012', 'staff2026');
    ok(await a.post('/api/auth/password', { old: 'staff2026', pw: 'newpass1', pw2: 'newpass1' }));
    assert.strictEqual((await b.get('/api/auth/me')).status, 401);
    ok(await a.get('/api/auth/me'));
  });
  await test('SMS OTP-оор нууц үг сэргээх', async () => {
    const c = new Client();
    ok(await c.post('/api/auth/otp/request', { role: 'staff', cx: 'narny', login: 'EMP-007' }));
    const m = await one("select body from outbox where body like '%сэргээх код%' order by id desc limit 1");
    const code = /(\d{6})/.exec(m.body)[1];
    const bad = await c.post('/api/auth/otp/reset', { role: 'staff', cx: 'narny', login: 'EMP-007', code: '000000', pw: 'reset123', pw2: 'reset123' });
    assert.strictEqual(bad.status, 400);
    ok(await c.post('/api/auth/otp/reset', { role: 'staff', cx: 'narny', login: 'EMP-007', code, pw: 'reset123', pw2: 'reset123' }));
    await c.login('staff', 'narny', 'EMP-007', 'reset123');
    // байхгүй хэрэглэгчид ч ижил хариу
    ok(await new Client().post('/api/auth/otp/request', { role: 'staff', cx: 'narny', login: 'EMP-999' }));
  });
  await test('гарах → session устна', async () => {
    const c = await as('resident');
    ok(await c.post('/api/auth/logout'));
    assert.strictEqual((await c.get('/api/auth/me')).status, 401);
  });

  console.log('Бүртгэл');
  let regId;
  await test('оршин суугчийн хүсэлт → pending → админ батална → нэвтэрнэ', async () => {
    const c = new Client();
    const r = await c.post('/api/accounts/register', { role: 'resident', cx: 'narny', name: 'Д. Цэцэг', phone: '99001122', pw: 'tsetseg1', pw2: 'tsetseg1', b: 1, u: 7 });
    ok(r);
    regId = r.j.acc.id;
    const l = await c.post('/api/auth/login', { role: 'resident', cx: 'narny', login: '99001122', pw: 'tsetseg1' });
    assert.strictEqual(l.j.status, 'pending');
    const n = await admin.get('/api/notifications');
    assert.ok(n.j.list.some((x) => x.title === 'Шинэ бүртгэлийн хүсэлт'));
    ok(await admin.req('PATCH', '/api/accounts/' + regId, { status: 'active' }));
    await c.login('resident', 'narny', '99001122', 'tsetseg1');
    const me = await c.get('/api/auth/me');
    assert.deepStrictEqual([me.j.unit.b, me.j.unit.n], [1, 7]);
  });
  await test('байхгүй тоотоор бүртгүүлэхгүй', async () => {
    const r = await new Client().post('/api/accounts/register', { role: 'resident', cx: 'narny', name: 'Х. Тест', phone: '99001133', pw: 'abcdef', pw2: 'abcdef', b: 1, u: 9999 });
    assert.strictEqual(r.status, 400);
  });
  await test('өөр хотхоны админ бүртгэлийг өөрчилж чадахгүй', async () => {
    const other = await as('admin', 'altan');
    assert.strictEqual((await other.req('PATCH', '/api/accounts/' + regId, { status: 'disabled' })).status, 404);
  });
  await test('идэвхгүй болговол session нь хаагдана', async () => {
    const c = await new Client().login('resident', 'narny', '99001122', 'tsetseg1');
    ok(await admin.req('PATCH', '/api/accounts/' + regId, { status: 'disabled' }));
    assert.strictEqual((await c.get('/api/auth/me')).status, 401);
  });
  await test('ажилтан үүсгэх → EMP-101, ангилал албан тушаалаас', async () => {
    const r = await admin.post('/api/accounts/staff', { name: 'Б. Шинэ', pos: 'Сантехникч', phone: '88112233', pw: 'staff123' });
    ok(r);
    assert.strictEqual(r.j.acc.login, 'EMP-101');
    assert.deepStrictEqual(r.j.acc.cats, ['Сантехник']);
  });

  console.log('2–3. Хотхон, map');
  let sokh;
  await test('шинэ СӨХ: хотхон + map + айл + админ нэг гүйлгээнд', async () => {
    sokh = new Client();
    const r = await sokh.post('/api/accounts/register', { role: 'admin', sokh: 'Шинэ СӨХ', n: 'Шинэ хотхон', d: 'Баянгол', nb: 2, fl: 9, login: 'shine', name: 'Г. Бат', phone: '99887766', pw: 'shine123', pw2: 'shine123' });
    ok(r);
    const cx = r.j.acc.cx;
    const u = await one('select count(*)::int n from units where cx_id = $1', [cx]);
    assert.strictEqual(u.n, r.j.layout.buildings.reduce((a, b) => a + b.units, 0));
    ok(await sokh.get('/api/auth/me'));
    const L = r.j.layout;
    L.buildings = L.buildings.slice(0, 1);
    ok(await sokh.req('PUT', '/api/layouts/' + cx, L));
    assert.strictEqual((await one('select count(*)::int n from units where cx_id = $1 and active', [cx])).n, L.buildings[0].units);
    assert.strictEqual((await admin.req('PUT', '/api/layouts/' + cx, L)).status, 403);
    const list = await new Client().get('/api/layouts');
    assert.ok(list.j.some((x) => x.id === cx));
  });
  await test('ижил нэртэй хотхон давхар бүртгэгдэхгүй', async () => {
    const r = await new Client().post('/api/accounts/register', { role: 'admin', sokh: 'X', n: 'Нарны хотхон', nb: 1, fl: 5, login: 'dup', name: 'Д. Д', phone: '99887755', pw: 'abcdef', pw2: 'abcdef' });
    assert.strictEqual(r.status, 400);
  });
  await test('хотхоны нийтийн жагсаалт, тохиргоо', async () => {
    const r = await new Client().get('/api/complexes');
    assert.ok(r.j.find((x) => x.id === 'narny').units > 1000);
    const s = await admin.req('PUT', '/api/settings', { sla: 45, invoice: { day: 5 } });
    ok(s);
    assert.strictEqual(s.j.sla, 45);
    assert.strictEqual(s.j.invoice.day, 5);
    assert.strictEqual((await admin.req('PUT', '/api/settings', { invoice: { day: 40 } })).status, 400);
  });
  await test('зураг upload: зөвхөн зураг, нийтийн/хувийн', async () => {
    const up = await admin.post('/api/files?public=1', PNG);
    ok(up);
    assert.strictEqual((await new Client().get('/' + up.j.url)).status, 200);
    assert.strictEqual((await admin.post('/api/files', Buffer.from('not an image'), { 'content-type': 'image/png' })).status, 400);
    const priv = await resident.post('/api/files', PNG);
    assert.strictEqual((await new Client().get('/' + priv.j.url)).status, 401);
    assert.strictEqual((await (await as('admin', 'altan')).get('/' + priv.j.url)).status, 404);
  });

  console.log('4. Айл');
  await test('айлын жагсаалт өр, төлөвтэй; хайлт; засах', async () => {
    const r = await admin.get('/api/units?q=5-34');
    ok(r);
    assert.strictEqual(r.j.length, 1);
    assert.strictEqual(r.j[0].owner, 'Бат');
    assert.strictEqual(r.j[0].st, 2); // энэ сарын төлбөр төлөөгүй
    ok(await admin.req('PATCH', '/api/units/' + r.j[0].id, { tenant: 'Т. Түрээс', fee: 97000 }));
    const s = await lift.get('/api/units?q=5-34');
    assert.strictEqual(s.j[0].fee, undefined); // ажилтан төлбөр харахгүй
  });

  console.log('6. Засварын хүсэлт');
  let req;
  await test('оршин суугч хүсэлт → ангиллын ажилтанд очно', async () => {
    const r = await resident.post('/api/requests', { title: 'Лифтний товч ажиллахгүй', cat: 'Лифт', priority: 'HIGH', descr: '7 давхар' });
    ok(r);
    req = r.j;
    assert.ok(/^REQ-\d+$/.test(req.code));
    const pool = await lift.get('/api/requests?scope=pool');
    assert.ok(pool.j.some((x) => x.id === req.id));
    const plumber = await new Client().login('staff', 'narny', 'EMP-003', 'staff2026');
    assert.ok(!(await plumber.get('/api/requests?scope=pool')).j.some((x) => x.id === req.id));
    assert.strictEqual((await plumber.get('/api/requests/' + req.id)).status, 404);
  });
  await test('хүлээж авах → зэрэг дарвал хоёр дахь нь авахгүй', async () => {
    ok(await lift.post('/api/requests/' + req.id + '/take'));
    const other = await new Client().login('staff', 'narny', 'EMP-010', 'staff2026');
    assert.ok([400, 404, 409].includes((await other.post('/api/requests/' + req.id + '/take')).status));
    const n = await resident.get('/api/notifications');
    assert.ok(n.j.list.some((x) => x.title === 'Хүсэлтийг хүлээн авлаа'));
  });
  await test('зураггүй шийдэгдсэн болгохгүй; зурагтай бол тайланд бүртгэгдэнэ', async () => {
    ok(await lift.post('/api/requests/' + req.id + '/status', { status: 2 }));
    assert.strictEqual((await lift.post('/api/requests/' + req.id + '/status', { status: 4 })).status, 400);
    assert.strictEqual((await resident.post('/api/requests/' + req.id + '/photos?kind=after', PNG)).status, 403);
    ok(await lift.post('/api/requests/' + req.id + '/photos?kind=after', PNG));
    ok(await lift.post('/api/requests/' + req.id + '/status', { status: 4 }));
    const w = await one('select * from works where request_id = $1', [req.id]);
    assert.ok(w && w.by_name === 'Ж. Нарантуяа');
    const d = await resident.get('/api/requests/' + req.id);
    assert.strictEqual(d.j.photos.length, 1);
    assert.deepStrictEqual(d.j.events.map((e) => e.status), [0, 1, 2, 4]);
  });
  await test('буруу шилжилт (0 → 4) болон бусдын хүсэлтийг өөрчлөхгүй', async () => {
    const r = await resident.post('/api/requests', { title: 'Цонх хагарсан', cat: 'Засвар' });
    assert.strictEqual((await lift.post('/api/requests/' + r.j.id + '/status', { status: 4 })).status, 400);
  });
  await test('SLA хэтэрвэл админд нэг удаа мэдэгдэнэ', async () => {
    const r = await resident.post('/api/requests', { title: 'Хаалга түгжигдэхгүй', cat: 'Засвар' });
    await db.query("update requests set created_at = now() - interval '2 hours' where id = $1", [r.j.id]);
    await admin.get('/api/requests');
    await admin.get('/api/requests');
    const n = await db.query(
      "select count(*)::int n from notifications where account_id = 'narny-admin' and title = 'SLA хэтэрсэн хүсэлт' and body like $1",
      [r.j.code + '%'],
    );
    assert.strictEqual(n.rows[0].n, 1);
  });

  console.log('8. Гэрэл');
  await test('эвдэрсэн гэрэл → цахилгаанчинд даалгавар → засахад асна + тайлан', async () => {
    const f = await admin.post('/api/lights/L07/fix');
    ok(f);
    assert.ok(/Н\. Тунгалаг|Э\. Батжаргал/.test(f.j.msg));
    const r = await one("select * from requests where ref = 'light:L07' and cx_id = 'narny'");
    const el = await new Client().login('staff', 'narny', r.assignee_id.split('-').slice(1).join('-'), 'staff2026');
    ok(await el.post('/api/requests/' + r.id + '/status', { status: 2 }));
    ok(await el.post('/api/requests/' + r.id + '/photos?kind=after', PNG));
    ok(await el.post('/api/requests/' + r.id + '/status', { status: 4 }));
    assert.strictEqual((await one("select status from lights where cx_id = 'narny' and id = 'L07'")).status, 'on');
    assert.ok(await one("select 1 from works where title like 'Гадна гэрэл L07%'"));
  });

  console.log('7. Ус алдалт (IoT)');
  await test('мэдрэгч → алдалт + хавхлага хаах команд → ack → хаагдсан → сантехникч → засагдсан', async () => {
    const leak = await admin.post('/api/devices', { kind: 'leak', ref: '3-10' });
    const valve = await admin.post('/api/devices', { kind: 'valve', ref: '3-10' });
    ok(leak);
    const dev = (d) => ({ 'x-device-id': d.j.device.id, 'x-device-key': d.j.key });
    const c = new Client();
    assert.strictEqual((await c.post('/api/iot/leak', {}, { 'x-device-id': leak.j.device.id, 'x-device-key': 'wrong' })).status, 401);
    const r = await c.post('/api/iot/leak', { room: 'Гал тогоо', battery: 80 }, dev(leak));
    ok(r);
    assert.ok(r.j.command);
    const dup = await c.post('/api/iot/leak', { room: 'Гал тогоо' }, dev(leak));
    assert.strictEqual(dup.j.dup, true);
    const cmds = await c.get('/api/iot/commands', dev(valve));
    assert.strictEqual(cmds.j[0].cmd, 'close');
    ok(await c.post('/api/iot/commands/' + cmds.j[0].id + '/ack', { ok: true }, dev(valve)));
    const L = (await admin.get('/api/leaks')).j.find((x) => x.code === r.j.leak);
    assert.strictEqual(L.status, 'closed');
    const a = await admin.post('/api/leaks/' + L.id + '/assign');
    ok(a);
    const rq = await one("select * from requests where ref = $1", ['leak:' + L.id]);
    const pl = await new Client().login('staff', 'narny', rq.assignee_id.split('-').slice(1).join('-'), 'staff2026');
    ok(await pl.post('/api/requests/' + rq.id + '/status', { status: 2 }));
    ok(await pl.post('/api/requests/' + rq.id + '/photos?kind=after', PNG));
    ok(await pl.post('/api/requests/' + rq.id + '/status', { status: 4 }));
    const done = (await admin.get('/api/leaks')).j.find((x) => x.id === L.id);
    assert.strictEqual(done.status, 'fixed');
    assert.ok(done.times.every(Boolean));
    assert.ok(await one("select 1 from outbox where body like 'Ус алдаж байна%'"));
  });

  console.log('5. Төлбөр');
  await test('нэхэмжлэл давхардахгүй; оршин суугч QPay(mock)-аар төлнө; өр 0 болно', async () => {
    const next = new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 7);
    const g = await admin.post('/api/invoices/run', { month: next });
    ok(g);
    assert.ok(g.j.n > 1000);
    assert.strictEqual((await admin.post('/api/invoices/run', { month: next })).j.n, 0);
    const bill = await resident.get('/api/me/bill');
    assert.ok(bill.j.due > 0);
    const p = await resident.post('/api/payments', { channel: 'Хаан банк' });
    ok(p);
    assert.strictEqual(p.j.status, 'pending');
    assert.strictEqual(p.j.amount, bill.j.due);
    const again = await resident.post('/api/payments', { channel: 'Хаан банк' });
    assert.strictEqual(again.j.id, p.j.id); // давхар нэхэмжлэх үүсгэхгүй
    const conf = await resident.post('/api/payments/' + p.j.id + '/mock-confirm');
    assert.strictEqual(conf.j.status, 'paid');
    assert.strictEqual((await resident.post('/api/payments/' + p.j.id + '/mock-confirm')).j.status, 'paid');
    assert.strictEqual((await resident.get('/api/me/bill')).j.due, 0);
    assert.ok((await admin.get('/api/payments')).j.some((x) => x.id === p.j.id));
    assert.strictEqual((await (await as('resident', 'altan')).get('/api/payments/' + p.j.id)).status, 404);
  });
  await test('бэлэн төлбөр бүртгэх, сануулга (апп + SMS)', async () => {
    ok(await admin.post('/api/payments/manual', { unit: '1-1', amount: '50,000', channel: 'Бэлэн' }));
    const r = await admin.post('/api/reminders', { all: true });
    ok(r);
    assert.ok(r.j.n > 10);
    assert.ok(await one("select 1 from outbox where body like 'СӨХ: Төлбөрийн сануулга%'"));
    const s = await admin.get('/api/billing/summary');
    assert.ok(s.j.billed > 0 && s.j.rate > 0.5 && s.j.rate <= 1);
  });

  console.log('9. Зогсоол');
  await test('захиалах → давхар захиалахгүй → цуцлах; бусдын түрээсийн зогсоол', async () => {
    const slots = (await resident.get('/api/slots')).j;
    assert.strictEqual(slots[0].plate, undefined); // оршин суугч дугаар харахгүй
    const free = slots.find((s) => s.zone === 'p' && s.st === 0 && !s.rented);
    const r = await resident.post('/api/parking/reserve', { slot_id: free.id });
    ok(r);
    const other = slots.find((s) => s.zone === 'p' && s.st === 0 && !s.rented && s.id !== free.id);
    const twice = await resident.post('/api/parking/reserve', { slot_id: other.id });
    assert.strictEqual(twice.status, 400, JSON.stringify(twice.j));
    assert.strictEqual((await resident.get('/api/slots')).j.find((s) => s.id === free.id).st, 3);
    ok(await resident.post('/api/parking/cancel'));
    const rented = (await admin.get('/api/slots')).j.find((s) => s.own && s.own !== '5-34');
    assert.strictEqual((await resident.post('/api/parking/reserve', { slot_id: rented.id })).status, 400);
  });
  await test('хугацаа дуусвал захиалга өөрөө цуцлагдана', async () => {
    const free = (await resident.get('/api/slots')).j.find((s) => s.zone === 'p' && s.st === 0 && !s.rented);
    ok(await resident.post('/api/parking/reserve', { slot_id: free.id }));
    await db.query("update slot_reservations set expires_at = now() - interval '1 minute' where status = 'held'");
    assert.strictEqual((await resident.get('/api/slots')).j.find((s) => s.id === free.id).st, 0);
    assert.strictEqual((await resident.get('/api/parking/me')).j.reservation, null);
  });
  await test('мэдрэгч: захиалсан машин ирэхэд бүртгэнэ, гарахад дараалалд санал болгоно', async () => {
    const free = (await resident.get('/api/slots')).j.find((s) => s.zone === 'p' && s.st === 0 && !s.rented);
    const d = await admin.post('/api/devices', { kind: 'slot', ref: free.id });
    const h = { 'x-device-id': d.j.device.id, 'x-device-key': d.j.key };
    ok(await resident.post('/api/parking/reserve', { slot_id: free.id }));
    const s1 = await new Client().post('/api/iot/slot', { occupied: true, plate: '1234 УБА', battery: 15 }, h);
    assert.strictEqual(s1.j.state, 1);
    assert.strictEqual((await resident.get('/api/parking/me')).j.reservation.status, 'parked');
    // өөр оршин суугч дараалалд
    const r2 = await new Client().post('/api/accounts/register', { role: 'resident', cx: 'narny', name: 'Э. Дараа', phone: '99004455', pw: 'daraa123', pw2: 'daraa123', b: 2, u: 3 });
    ok(await admin.req('PATCH', '/api/accounts/' + r2.j.acc.id, { status: 'active' }));
    const c2 = await new Client().login('resident', 'narny', '99004455', 'daraa123');
    // бүх сул зогсоолыг дүүргэнэ → дараалалд зогсоно
    await db.query("update slots set state = 1 where cx_id = 'narny' and state = 0");
    ok(await c2.post('/api/parking/queue'));
    assert.strictEqual((await c2.get('/api/parking/me')).j.queue.status, 'waiting');
    ok(await new Client().post('/api/iot/slot', { occupied: false }, h));
    const q = (await c2.get('/api/parking/me')).j.queue;
    assert.strictEqual(q.status, 'offered');
    assert.strictEqual(q.slot_id, free.id);
    assert.strictEqual((await (await as('admin')).get('/api/slots')).j.find((s) => s.id === free.id).sens, 'low');
    ok(await c2.post('/api/parking/reserve', { slot_id: free.id }));
  });
  await test('сарын түрээс: нэг айлд нэг л зогсоол, нэг зогсоол нэг айлд', async () => {
    const slots = (await admin.get('/api/slots')).j;
    const s = slots.find((x) => x.zone === 'p' && !x.own);
    assert.strictEqual((await admin.post('/api/slots/' + s.id + '/rental', { unit: '5-34', fee: 60000 })).status, 409);
    ok(await admin.post('/api/slots/' + s.id + '/rental', { unit: '1-2', fee: '70,000' }));
    assert.strictEqual((await admin.post('/api/slots/' + s.id + '/rental', { unit: '1-3', fee: 1 })).status, 409);
    const sum = (await admin.get('/api/parking/rentals')).j;
    assert.ok(sum.n >= 7 && sum.sum >= 6 * 60000 + 70000);
    ok(await admin.req('DELETE', '/api/slots/' + s.id + '/rental'));
  });

  console.log('10. Санхүү');
  await test('сан, зарлага нийтлэх → оршин суугчид мэдэгдэл', async () => {
    const f0 = (await resident.get('/api/finance/fund')).j;
    ok(await admin.post('/api/finance/ledger', { cat: 'Засвар', title: 'Шатны бариул', amount: 450000, vendor: 'Төмөр ХХК' }));
    const f1 = (await resident.get('/api/finance/fund')).j;
    assert.strictEqual(f1.spent - f0.spent, 450000);
    assert.ok((await resident.get('/api/notifications')).j.list.some((n) => n.title === 'СӨХ шинэ зарлага нийтэллээ'));
    assert.strictEqual((await resident.post('/api/finance/ledger', { title: 'x', amount: 1 })).status, 403);
  });
  await test('төлөвлөсөн зардал: үлдэгдэл хүрэлцэхгүй бол 409', async () => {
    const o = await admin.post('/api/finance/obligations', { cat: 'Засвар', title: 'Дээвэр солих', amount: 1900000000 });
    ok(o);
    assert.strictEqual((await admin.post('/api/finance/obligations/' + o.j.item.id + '/pay')).status, 409);
    const small = await admin.post('/api/finance/obligations', { cat: 'Бусад', title: 'Цэцэг', amount: 10000 });
    ok(await admin.post('/api/finance/obligations/' + small.j.item.id + '/pay'));
    assert.strictEqual((await admin.post('/api/finance/obligations/' + small.j.item.id + '/pay')).status, 400);
  });
  await test('хийсэн ажил, сарын тайлан нийтлэх', async () => {
    ok(await admin.post('/api/works', { cat: 'Тохижилт', title: 'Тоглоомын талбай будав', location: 'Төв талбай' }));
    const mon = new Date().toISOString().slice(0, 7);
    const p = await admin.post('/api/reports/' + mon + '/publish');
    ok(p);
    assert.ok(p.j.summary.works >= 1);
    assert.ok((await resident.get('/api/reports')).j.some((r) => r.month === mon));
    assert.ok((await resident.get('/api/finance/months')).j.length >= 1);
  });

  console.log('11. Мэдэгдэл, sync, cron, audit');
  await test('мэдэгдэл хэрэглэгч бүрт тусдаа; бүгдийг уншсан болгох', async () => {
    const a = (await resident.get('/api/notifications')).j;
    assert.ok(a.unread > 0);
    const other = (await (await as('resident', 'altan')).get('/api/notifications')).j;
    assert.ok(!other.list.some((n) => a.list.find((m) => m.id === n.id)));
    ok(await resident.post('/api/notifications/read'));
    assert.strictEqual((await resident.get('/api/notifications')).j.unread, 0);
  });
  await test('sync: ver өөрчлөлтөөр нэмэгдэнэ', async () => {
    const v0 = (await resident.get('/api/sync')).j.ver;
    ok(await admin.post('/api/works', { cat: 'Бусад', title: 'Шал угаав' }));
    const s = (await resident.get('/api/sync?since=0')).j;
    assert.ok(s.ver > v0);
    assert.ok(s.notifs.length > 0);
  });
  await test('cron: нууц түлхүүргүй 401, түлхүүртэй бол бүх хотхонд ажиллана', async () => {
    assert.strictEqual((await new Client().get('/api/cron/daily')).status, 401);
    const r = await new Client().get('/api/cron/daily', { authorization: 'Bearer test-cron' });
    ok(r);
    assert.ok(r.j.complexes.narny);
  });
  await test('audit log: админы үйлдлүүд бүртгэгдэнэ', async () => {
    const r = await admin.get('/api/audit');
    const acts = r.j.map((x) => x.action);
    for (const a of ['account.update', 'ledger.add', 'slot.rent', 'light.fix', 'payment.manual']) assert.ok(acts.includes(a), a);
  });
  await test('хотхоны тусгаарлалт: өөр хотхоны хүсэлт, айлыг харахгүй', async () => {
    const other = await as('admin', 'altan');
    assert.strictEqual((await other.get('/api/requests/' + req.id)).status, 404);
    const u = await one("select id from units where cx_id = 'narny' limit 1");
    assert.strictEqual((await other.get('/api/units/' + u.id)).status, 404);
  });

  console.log('\n' + passed + ' амжилттай, ' + failed + ' алдаатай');
  process.exitCode = failed ? 1 : 0;
  server.closeAllConnections();
  server.close();
  await db.close();
});
