/*
 * Демо өгөгдөл: кодонд байгаа хотхонууд (narny, altan …) + айл, нэхэмжлэл, төлбөр, хүсэлт, санхүү.
 *   npm run seed                 (DATABASE_URL байвал тэр DB-д — production-д бүү ажиллуул!)
 * Демо нэвтрэлт (хотхон бүрт):
 *   СӨХ:          admin / admin2026
 *   Ажилтан:      EMP-001 … EMP-012 / staff2026   (EMP-009 = Т. Ариунаа, EMP-001 = Ж. Нарантуяа)
 *   Оршин суугч:  9911 2233 / bat2026  (Бат, 5-р байр 34 тоот)
 */
const db = require('./db');
const A = require('./lib/auth');
const C = require('./lib/core');
const Y = require('./lib/layout');
const { month, addMonths, local } = require('./lib/util');

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const SUR = ['Бат', 'Болд', 'Сараа', 'Анужин', 'Тэмүүлэн', 'Номин', 'Ганбат', 'Уянга', 'Эрдэнэ', 'Мөнхзул', 'Тэлмэн', 'Энхжин', 'Батсайхан', 'Хулан', 'Дорж', 'Оюун'];
const INI = ['Б', 'Д', 'Г', 'Ж', 'Л', 'М', 'Н', 'О', 'С', 'Т', 'Э', 'Ц', 'Х'];
const LET = ['УБА', 'УНА', 'УНБ', 'УБЕ', 'УАМ', 'УКО'];
const STAFF = [
  ['Ж. Нарантуяа', 'Лифт техникч', ['Лифт', 'Засвар']],
  ['Б. Ганзориг', 'Засварчин', ['Засвар', 'Бусад']],
  ['С. Мөнхзул', 'Сантехникч', ['Сантехник', 'Дулаан']],
  ['Ц. Эрдэнэ', 'Сантехникч', ['Сантехник']],
  ['Н. Тунгалаг', 'Цахилгаанчин', ['Цахилгаан']],
  ['О. Сайнбаяр', 'Сантехникч', ['Сантехник']],
  ['Д. Бямба', 'Харуул', ['Харуул']],
  ['Г. Солонго', 'Цэвэрлэгээ', ['Цэвэрлэгээ']],
  ['Т. Ариунаа', 'Нягтлан', ['Санхүү']],
  ['Л. Мөнх-Эрдэнэ', 'Лифт техникч', ['Лифт']],
  ['Э. Батжаргал', 'Цахилгаанчин', ['Цахилгаан']],
  ['П. Хишигээ', 'Харуул', ['Харуул']],
];
const REQUESTS = [
  ['Дээд давхраас ус гоожиж байна', 'Сантехник', 'HIGH', 3, 88, 0, 48, 'Угаалгын өрөөний таазаас ус дусч байна.'],
  ['Лифт 3 давхарт гацсан', 'Лифт', 'HIGH', 5, 34, 2, 135, '5-р байрны лифт 3 давхарт гацсан.', 0],
  ['Орцны гэрэл асахгүй байна', 'Цахилгаан', 'MED', 2, 12, 1, 70, '2-р орцны 1 давхрын гэрэл.', 4],
  ['Радиатор халахгүй байна', 'Дулаан', 'MED', 4, 41, 0, 25, 'Унтлагын өрөөний радиатор хүйтэн.'],
  ['Хогийн савны таг эвдэрсэн', 'Засвар', 'LOW', 1, 5, 3, 300, 'Гадна талын хогийн сав.', 1],
  ['Угаалтуурын ус урсахгүй', 'Сантехник', 'MED', 6, 140, 0, 12, 'Гал тогооны угаалтуур бөглөрсөн.'],
];
const LEDGER = [
  ['Бусад', 'Гэрлийн чийдэн, будаг, жижиг материал', 800000, 'Номин супермаркет'],
  ['Лифт', 'Лифтний сарын үйлчилгээ · 12 лифт', 2900000, 'Лифт Сервис ХХК'],
  ['Засвар', '2-р байрны дулааны хаалтын засвар', 3350000, 'Дулаан Тех ХХК'],
  ['Цэвэрлэгээ', 'Цэвэрлэгээ, хог тээвэр', 3600000, 'Цэвэр Орчин ХХК'],
  ['Харуул', 'Харуул хамгаалалт · 6 пост', 4100000, 'Хамгаалалт ХХК'],
  ['Ус', 'Дундын эзэмшлийн ус', 4900000, 'УСУГ'],
  ['Цалин', 'Ажилчдын цалин · 1-р хагас сар', 21400000, 'Цалингийн сан'],
];
const WORKS = [
  ['Тохижилт', 'Орцны камерын бичлэгийн системийг шинэчилсэн', 'Бүх байр', 'Удирдлага'],
  ['Дулаан', 'Дулааны хаалтыг засварлаж, шугамыг угаасан', '2-р байр', 'С. Мөнхзул'],
  ['Лифт', 'Лифтний хаалганы мотор солив', '4-р байр', 'Ж. Нарантуяа'],
  ['Цахилгаан', 'Гадна гэрэлтүүлгийн 6 чийдэн солив', 'Гол зам', 'Н. Тунгалаг'],
];
const OBLIGATIONS = [
  ['Цалин', 'Ажилчдын цалин · 2-р хагас сар', 21400000, 25],
  ['Лифт', '1-р байрны Лифт #02 их засвар', 24000000, 28],
  ['Засвар', 'Дулааны шугамын засвар · өвлийн бэлтгэл', 18500000, 30],
];

async function seedComplex(q, L, pw, idx) {
  const cx = L.id;
  const cur = month(),
    prev = addMonths(cur, -1);
  const r = rng(77 + idx);
  const pick = (a) => a[Math.floor(r() * a.length)];
  await q(
    'insert into complexes (id, name, sokh, district, color, settings) values ($1, $2, $3, $4, $5, $6::jsonb)',
    [cx, L.n, L.sokh, L.d || '', L.c || '#0A72B8', JSON.stringify({ fund: { opening: 4800000, since: prev } })],
  );
  await C.syncLayout(q, cx, L, 85000);
  // айлын мэдээлэл
  const units = [];
  for (const B of L.buildings)
    for (let n = 1; n <= B.units; n++)
      units.push({
        b: B.n,
        n,
        owner: pick(INI) + '. ' + pick(SUR),
        tenant: r() < 0.15 ? pick(INI) + '. ' + pick(SUR) : '',
        phone: '99' + Math.floor(100000 + r() * 899999),
        plate: r() < 0.55 ? 1000 + Math.floor(r() * 8999) + ' ' + pick(LET) : '',
        fee: 82000 + Math.floor(r() * 6) * 5000,
      });
  const meB = Math.min(5, L.buildings.length);
  const meN = Math.min(34, L.buildings.find((B) => B.n === meB).units);
  Object.assign(units.find((u) => u.b === meB && u.n === meN), { owner: 'Бат', tenant: '', phone: '99112233', plate: '1234 УБА', fee: 97000 });
  await q(
    `update units u set owner = x->>'owner', tenant = x->>'tenant', phone = x->>'phone', plate = x->>'plate', fee = (x->>'fee')::int
     from jsonb_array_elements($2::jsonb) x where u.cx_id = $1 and u.b = (x->>'b')::int and u.n = (x->>'n')::int`,
    [cx, JSON.stringify(units)],
  );
  const me = (await q('select id from units where cx_id = $1 and b = $2 and n = $3', [cx, meB, meN])).rows[0].id;

  // бүртгэлүүд
  const acc = (id, role, login, name, phone, hash, extra = {}) =>
    q(
      `insert into accounts (id, cx_id, role, login, login_key, name, phone, pw, status, unit_id, b, u, pos, cats)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12, $13)`,
      [id, cx, role, login, A.loginKey(role, login), name, phone, hash, extra.unit || null, extra.b || null, extra.u || null, extra.pos || '', extra.cats || []],
    );
  await acc(cx + '-admin', 'admin', 'admin', 'Д. Энхбаяр', '99001100', pw.admin);
  for (let i = 0; i < STAFF.length; i++) {
    const [name, pos, cats] = STAFF[i];
    const login = 'EMP-' + String(i + 1).padStart(3, '0');
    await acc(cx + '-' + login, 'staff', login, name, '88' + String(100000 + i * 7919).slice(0, 6), pw.staff, { pos, cats });
  }
  await acc(cx + '-bat', 'resident', '99112233', 'Бат', '99112233', pw.resident, { unit: me, b: meB, u: meN });

  // нэхэмжлэл: өмнөх сар (95% төлсөн), энэ сар (86% төлсөн; Батынх төлөөгүй)
  for (const [mon, rate] of [[prev, 95], [cur, 86]]) {
    await q(
      `insert into invoices (cx_id, unit_id, code, month, amount, items, due_date, paid, status, paid_at)
       select u.cx_id, u.id, 'INV-' || $3 || '-' || (1000 + row_number() over (order by u.id)), $2, u.fee,
         jsonb_build_array(jsonb_build_object('t', 'СӨХ-ийн хураамж', 'amt', u.fee)), $2 || '-10',
         case when ok then u.fee else 0 end, case when ok then 'paid' else 'unpaid' end,
         case when ok then now() - (abs(hashtext(u.id::text || $2)) % 20) * interval '1 day' else null end
       from (select *, (abs(hashtext(id::text || 'p' || $2)) % 100 < $4 and id <> $5) as ok from units
             where cx_id = $1 and active) u`,
      [cx, mon, mon.slice(0, 4) + mon.slice(5), rate, mon === cur ? me : -1],
    );
    await q(
      `insert into payments (cx_id, unit_id, amount, channel, status, provider, payer, month, created_at, paid_at)
       select i.cx_id, i.unit_id, i.amount,
         (array['QPay', 'SocialPay', 'Хаан банк', 'Голомт банк', 'ХасБанк'])[1 + i.unit_id % 5],
         'paid', 'seed', u.owner, $2, i.paid_at, i.paid_at
       from invoices i join units u on u.id = i.unit_id where i.cx_id = $1 and i.month = $2 and i.status = 'paid'`,
      [cx, mon],
    );
  }
  await q("insert into counters (cx_id, name, n) values ($1, 'inv-' || $2, 9000)", [cx, cur.slice(0, 4)]);

  // засварын хүсэлт
  const staffId = (name) => cx + '-EMP-' + String(STAFF.findIndex((s) => s[0] === name) + 1).padStart(3, '0');
  const byCat = { Лифт: 'Ж. Нарантуяа', Цахилгаан: 'Н. Тунгалаг', Засвар: 'Б. Ганзориг', Сантехник: 'С. Мөнхзул', Дулаан: 'С. Мөнхзул' };
  let k = 1040;
  for (const [title, cat, p, b0, n0, st, ago, descr] of REQUESTS) {
    const b = Math.min(b0, L.buildings.length);
    const n = Math.min(n0, L.buildings.find((B) => B.n === b).units);
    const u = (await q('select id from units where cx_id = $1 and b = $2 and n = $3', [cx, b, n])).rows[0];
    const who = st ? byCat[cat] : null;
    const { rows } = await q(
      `insert into requests (cx_id, code, unit_id, b, n, title, cat, priority, descr, status, assignee_id, assignee_name,
         source, created_at, status_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'resident', now() - $13 * interval '1 minute', now() - $14 * interval '1 minute')
       returning id`,
      [cx, 'REQ-' + k++, u.id, b, n, title, cat, p, descr, st, who ? staffId(who) : null, who || '', ago, Math.round(ago / 3)],
    );
    await q("insert into request_events (request_id, status, by_name, note, at) values ($1, 0, 'Оршин суугч', 'Үүсгэв', now() - $2 * interval '1 minute')", [rows[0].id, ago]);
  }
  await q("insert into counters (cx_id, name, n) values ($1, 'req', $2)", [cx, 1051]);

  // санхүү, хийсэн ажил
  const L0 = local();
  for (let i = 0; i < LEDGER.length; i++) {
    const [cat, title, amt, vendor] = LEDGER[i];
    const d = cur + '-' + String(Math.max(1, Math.min(L0.d, 16) - i * 2)).padStart(2, '0');
    await q(
      "insert into ledger (cx_id, code, month, date, cat, title, amount, vendor, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8, 'seed')",
      [cx, 'EX-' + (301 + i), cur, d, cat, title, amt, vendor],
    );
  }
  await q(
    "insert into ledger (cx_id, code, month, date, cat, title, amount, vendor, created_by) values ($1, 'EX-300', $2, $2 || '-15', 'Цалин', 'Ажилчдын цалин', 42800000, 'Цалингийн сан', 'seed')",
    [cx, prev],
  );
  await q("insert into counters (cx_id, name, n) values ($1, 'exp', $2)", [cx, 300 + LEDGER.length]);
  for (let i = 0; i < WORKS.length; i++) {
    const [cat, title, loc, by] = WORKS[i];
    await q(
      "insert into works (cx_id, code, month, date, cat, title, location, by_name, source) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [cx, 'WK-' + (201 + i), cur, cur + '-' + String(Math.max(1, L0.d - i)).padStart(2, '0'), cat, title, loc, by, by === 'Удирдлага' ? 'admin' : 'staff'],
    );
  }
  await q("insert into counters (cx_id, name, n) values ($1, 'work', $2)", [cx, 200 + WORKS.length]);
  for (const [cat, title, amt, day] of OBLIGATIONS)
    await q("insert into obligations (cx_id, cat, title, amount, due_date, created_by) values ($1, $2, $3, $4, $5, 'seed')", [cx, cat, title, amt, cur + '-' + day]);
  await q(
    `insert into reports (cx_id, month, summary, published_by) values ($1, $2, $3::jsonb, 'admin')`,
    [cx, prev, JSON.stringify({ spent: 42800000, works: 0 })],
  );

  // гэрэл, зогсоол, ус алдалт
  await q("update lights set status = 'off' where cx_id = $1 and id in ('L07', 'L19')", [cx]);
  await q(
    `update slots set state = case when abs(hashtext(id || cx_id)) % 100 < 62 then 1 when abs(hashtext(id || cx_id)) % 100 < 88 then 0 else 2 end,
       battery = 20 + abs(hashtext(cx_id || id)) % 80
     where cx_id = $1`,
    [cx],
  );
  await q(
    `update slots set plate = (1000 + abs(hashtext(id)) % 8999)::text || ' ' || (array['УБА','УНА','УНБ','УБЕ','УАМ','УКО'])[1 + abs(hashtext(id)) % 6]
     where cx_id = $1 and state > 0`,
    [cx],
  );
  const P = (await q("select id from slots where cx_id = $1 and zone = 'p' order by id", [cx])).rows.map((x) => x.id);
  const all = (await q('select id from units where cx_id = $1 and id <> $2 order by id', [cx, me])).rows;
  for (let j = 0; j < 6; j++) {
    const s = P[[6, 13, 20, 27, 34, 41][j]];
    if (!s) continue;
    const unit = j === 0 ? me : all[(11 + j * 23) % all.length].id;
    await q('insert into slot_rentals (cx_id, slot_id, unit_id, fee, created_by) values ($1, $2, $3, 60000, $4)', [cx, s, unit, 'seed']);
    if (j === 0) await q("update slots set state = 0, plate = '' where cx_id = $1 and id = $2", [cx, s]);
  }
  const lk = async (b0, n0, room, status, minAgo, by) => {
    const b = Math.min(b0, L.buildings.length);
    const n = Math.min(n0, L.buildings.find((B) => B.n === b).units);
    const u = (await q('select id from units where cx_id = $1 and b = $2 and n = $3', [cx, b, n])).rows[0];
    await q(
      `insert into leaks (cx_id, code, unit_id, b, n, room, status, detected_at, notified_at, closed_at, assigned_at, fixed_at, assignee_name)
       values ($1, $2, $3, $4, $5, $6, $7, now() - $8 * interval '1 minute', now() - $8 * interval '1 minute',
         now() - ($8 - 1) * interval '1 minute', now() - ($8 - 10) * interval '1 minute',
         case when $7 = 'fixed' then now() - ($8 - 50) * interval '1 minute' end, $9)`,
      [cx, status === 'fixed' ? 'LK-0429' : 'LK-0430', u.id, b, n, room, status, minAgo, by],
    );
  };
  await lk(6, 140, 'Угаалгын өрөө', 'fixed', 400, 'Ц. Эрдэнэ');
  await lk(2, 57, 'Гал тогоо', 'fixing', 12, 'С. Мөнхзул');
  await q("insert into counters (cx_id, name, n) values ($1, 'leak', 430)", [cx]);
}

async function seed({ only } = {}) {
  await db.ready();
  const pw = {
    admin: await A.hashPw('admin2026'),
    staff: await A.hashPw('staff2026'),
    resident: await A.hashPw('bat2026'),
  };
  const list = Y.builtins().filter((L) => !only || only.includes(L.id));
  const done = [];
  for (let i = 0; i < list.length; i++) {
    const L = list[i];
    const ex = await db.query('select 1 from complexes where id = $1', [L.id]);
    if (ex.rows.length) continue;
    await db.tx((q) => seedComplex(q, L, pw, i));
    done.push(L.id);
  }
  return done;
}

module.exports = { seed };

if (require.main === module)
  seed()
    .then((d) => {
      console.log(d.length ? 'Үүслээ: ' + d.join(', ') : 'Бүх демо хотхон аль хэдийн байна');
      return db.close();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
