/*
 * 1. Нэвтрэлт ба бүртгэл
 *   POST /api/auth/login  (= /api/accounts/login)   { role, cx, login, pw } → cookie + { acc }
 *   POST /api/auth/logout
 *   GET  /api/auth/me                                → { acc, rights, complex, unit }
 *   POST /api/auth/password                          { old, pw, pw2 }
 *   POST /api/auth/otp/request                       { role, cx, login } → SMS код
 *   POST /api/auth/otp/reset                         { role, cx, login, code, pw, pw2 }
 *   POST /api/accounts/register   СӨХ бүртгүүлэх (хотхон + map + админ нэг гүйлгээнд) /
 *                                 оршин суугчийн хүсэлт
 *   GET  /api/accounts            (админ) тухайн хотхоны бүртгэлүүд
 *   POST /api/accounts/staff      (админ) ажилтан → EMP-###
 *   POST /api/accounts/resident   (админ) оршин суугч → шууд идэвхтэй
 *   PATCH /api/accounts/:id       (админ) { status, note } батлах/татгалзах/идэвхгүй, мэдээлэл засах
 */
const crypto = require('crypto');
const db = require('../db');
const A = require('../lib/auth');
const C = require('../lib/core');
const Y = require('../lib/layout');
const { notify, sms, flush } = require('../lib/notify');
const U = require('../lib/util');
const { bad, notFound, clean, digits, int } = U;

const STATUS_MSG = {
  pending: 'Таны бүртгэлийн хүсэлтийг СӨХ хянаж байна. Баталгаажсаны дараа нэвтэрнэ.',
  disabled: 'Бүртгэл идэвхгүй байна. СӨХ-д хандана уу.',
};
const COLORS = ['#0A72B8', '#B5651E', '#0F766E', '#6D3FD6', '#2E8B57', '#C2410C', '#BE185D'];
/** Албан тушаалаас ажлын ангилал (cats өгөөгүй үед) */
const CAT_WORDS = [
  ['Лифт', 'Лифт'],
  ['Сантех', 'Сантехник'],
  ['Цахилгаан', 'Цахилгаан'],
  ['Дулаан', 'Дулаан'],
  ['Засвар', 'Засвар'],
  ['Харуул', 'Харуул'],
  ['Цэвэрлэ', 'Цэвэрлэгээ'],
  ['Нягтлан', 'Санхүү'],
  ['Тохиж', 'Тохижилт'],
];
function catsOf(x) {
  if (Array.isArray(x.cats) && x.cats.length)
    return [...new Set(x.cats.map((s) => clean(s, 40)).filter(Boolean))].slice(0, 10);
  const pos = String(x.pos || '');
  return CAT_WORDS.filter(([w]) => pos.includes(w)).map(([, c]) => c);
}

async function findAcc(q, cx, role, login) {
  const { rows } = await q('select * from accounts where cx_id = $1 and role = $2 and login_key = $3', [
    cx,
    role,
    A.loginKey(role, login),
  ]);
  return rows[0] || null;
}
const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

module.exports = (on) => {
  /* ---------------- нэвтрэх ---------------- */
  async function login(c) {
    const x = await c.json();
    const role = x.role,
      cx = clean(x.cx, 64);
    if (!A.ROLES.includes(role)) throw bad('Эрх буруу');
    const lk = A.loginKey(role, x.login);
    const keys = ['ip:' + c.ip, 'acc:' + cx + ':' + role + ':' + lk];
    await A.limitCheck(keys, [30, 8]);
    const a = lk ? await findAcc(db.query, cx, role, x.login) : null;
    const ok = a ? await A.verifyPw(x.pw, a) : (await A.dummy(), false);
    if (!ok) {
      await A.limitHit(keys);
      throw bad('Нэвтрэх нэр эсвэл нууц үг буруу байна');
    }
    if (a.status === 'rejected')
      throw bad('Бүртгэлийн хүсэлт татгалзагдсан' + (a.note ? ': ' + a.note : '') + '.', {
        status: 'rejected',
      });
    if (a.status !== 'active') throw bad(STATUS_MSG[a.status], { status: a.status });
    if (ok === 'legacy') {
      a.pw = await A.hashPw(x.pw);
      await db.query('update accounts set pw = $2 where id = $1', [a.id, a.pw]);
    }
    await A.limitClear(keys[1]);
    await A.createSession(c, a);
    return { ok: true, acc: A.pub(a) };
  }
  on('POST', '/api/auth/login', login);
  on('POST', '/api/accounts/login', login);

  on('POST', '/api/auth/logout', async (c) => {
    await A.endSession(c);
    return { ok: true };
  });

  on('GET', '/api/auth/me', async (c) => {
    const me = await c.need();
    const cx = await C.getComplex(db.query, me.cx_id);
    let unit = null;
    if (me.unit_id) {
      const { rows } = await db.query(
        `select u.*, coalesce(sum(i.amount - i.paid) filter (where i.status = 'unpaid'), 0)::int as debt
         from units u left join invoices i on i.unit_id = u.id where u.id = $1 group by u.id`,
        [me.unit_id],
      );
      unit = rows[0] || null;
    }
    return {
      acc: A.pub(me),
      rights: A.RIGHTS[me.role],
      complex: { id: cx.id, name: cx.name, sokh: cx.sokh, district: cx.district, color: cx.color },
      unit,
    };
  });

  on('POST', '/api/auth/password', async (c) => {
    const me = await c.need();
    const x = await c.json();
    if (!(await A.verifyPw(x.old, me))) throw bad('Одоогийн нууц үг буруу байна');
    const e = A.checkPw(x.pw, x.pw2);
    if (e) throw bad(e);
    await db.query('update accounts set pw = $2 where id = $1', [me.id, await A.hashPw(x.pw)]);
    // бусад төхөөрөмж дээрх session-уудыг хаана
    await db.query('delete from sessions where account_id = $1 and token_hash <> $2', [me.id, me.sid]);
    await C.audit(db.query, c, 'password.change', 'account', me.id);
    return { ok: true, msg: 'Нууц үг солигдлоо' };
  });

  /* ---------------- SMS OTP-оор нууц үг сэргээх ---------------- */
  on('POST', '/api/auth/otp/request', async (c) => {
    const x = await c.json();
    const generic = { ok: true, msg: 'Бүртгэлтэй утас руу 6 оронтой код илгээлээ (10 минут хүчинтэй).' };
    if (!A.ROLES.includes(x.role)) throw bad('Эрх буруу');
    const keys = ['otp-ip:' + c.ip, 'otp:' + x.cx + ':' + x.role + ':' + A.loginKey(x.role, x.login)];
    await A.limitCheck(keys, [20, 3]);
    await A.limitHit(keys, 3600);
    const a = await findAcc(db.query, clean(x.cx, 64), x.role, x.login);
    if (!a || a.status !== 'active' || !/^\d{8}$/.test(a.phone)) return generic; // байгаа эсэхийг хэлэхгүй
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    const ids = await db.tx(async (q) => {
      await q('update otps set used = true where account_id = $1 and not used', [a.id]);
      await q(
        "insert into otps (account_id, code_hash, expires_at) values ($1, $2, now() + interval '10 minutes')",
        [a.id, U.sha256(a.id + ':' + code)],
      );
      return sms(q, a.cx_id, [a.phone], 'СӨХ Platform нууц үг сэргээх код: ' + code);
    });
    await flush({ ids });
    return generic;
  });

  on('POST', '/api/auth/otp/reset', async (c) => {
    const x = await c.json();
    if (!A.ROLES.includes(x.role)) throw bad('Эрх буруу');
    const e = A.checkPw(x.pw, x.pw2);
    if (e) throw bad(e);
    const a = await findAcc(db.query, clean(x.cx, 64), x.role, x.login);
    const fail = bad('Код буруу эсвэл хугацаа дууссан байна');
    if (!a || a.status !== 'active') throw fail;
    const { rows } = await db.query(
      'select * from otps where account_id = $1 and not used and expires_at > now() order by id desc limit 1',
      [a.id],
    );
    const o = rows[0];
    if (!o || o.tries >= 5) throw fail;
    if (!U.safeEq(o.code_hash, U.sha256(a.id + ':' + digits(x.code)))) {
      await db.query('update otps set tries = tries + 1 where id = $1', [o.id]);
      throw fail;
    }
    await db.tx(async (q) => {
      await q('update otps set used = true where id = $1', [o.id]);
      await q('update accounts set pw = $2 where id = $1', [a.id, await A.hashPw(x.pw)]);
      await q('delete from sessions where account_id = $1', [a.id]);
    });
    await C.audit(db.query, { me: a, ip: c.ip }, 'password.reset', 'account', a.id);
    return { ok: true, msg: 'Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.' };
  });

  /* ---------------- бүртгүүлэх ---------------- */
  on('POST', '/api/accounts/register', async (c) => {
    const x = await c.json(6 * 1024 * 1024); // admin бүртгэлд map хамт ирж болно
    await A.limitCheck(['reg-ip:' + c.ip], [20]);
    await A.limitHit(['reg-ip:' + c.ip], 3600);
    const name = clean(x.name, 80);
    if (x.role !== 'admin' && x.role !== 'resident')
      throw bad('Ажилтны эрхийг зөвхөн СӨХ-ийн админ үүсгэнэ');
    if (name.length < 2) throw bad('Овог нэрээ бичнэ үү');
    const e = A.checkPhone(x.phone) || A.checkPw(x.pw, x.pw2);
    if (e) throw bad(e);
    return x.role === 'admin' ? registerSokh(c, x, name) : registerResident(c, x, name);
  });

  /** Шинэ СӨХ: хотхон + анхны map + айл/зогсоол/гэрэл + админ — бүгд нэг гүйлгээнд */
  async function registerSokh(c, x, name) {
    const login = clean(x.login, 40);
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(login)) throw bad('Нэвтрэх нэр 3–32 латин үсэг, тоо байна');
    const cxName = clean(x.n, 80),
      sokh = clean(x.sokh, 80);
    if (!cxName || !sokh) throw bad('СӨХ болон хотхоны нэрийг бичнэ үү');
    const names = Y.builtins().map((l) => l.n.toLowerCase());
    const id = /^cx-[a-z0-9]{4,24}$/.test(String(x.cx || '')) ? x.cx : 'cx-' + newId();
    let L = x.layout;
    if (L) {
      L = Y.plain(L);
      Object.assign(L, { id, n: cxName, sokh, d: clean(x.d, 40) });
    } else {
      const nb = int(x.nb, 1, 30),
        fl = int(x.fl, 2, 30);
      if (!nb) throw bad('Байрны тоо 1–30 байна');
      if (!fl) throw bad('Давхар 2–30 байна');
      L = Object.assign(Y.generate({ buildings: nb, floors: [fl, fl], slots: nb * 8, seed: Date.now() % 997 }), {
        id,
        n: cxName,
        sokh,
        d: clean(x.d, 40),
      });
    }
    if (!L.c) L.c = COLORS[Math.floor(Math.random() * COLORS.length)];
    const err = Y.validate(L, id);
    if (err) throw bad(err);
    const acc = await db.tx(async (q) => {
      const dup = await q('select 1 from complexes where id = $1 or lower(name) = lower($2)', [id, cxName]);
      if (dup.rows.length || names.includes(cxName.toLowerCase()))
        throw bad('Ийм нэртэй хотхон бүртгэлтэй байна');
      const settings = { fund: { opening: 0, since: U.month() } };
      await q(
        `insert into complexes (id, name, sokh, district, color, layout, settings)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [id, cxName, sokh, L.d || '', L.c, JSON.stringify(L), JSON.stringify(settings)],
      );
      await C.syncLayout(q, id, L, C.DEFAULTS.invoice.fee);
      const a = {
        id: newId(),
        cx_id: id,
        role: 'admin',
        login,
        login_key: A.loginKey('admin', login),
        name,
        phone: digits(x.phone),
        pw: await A.hashPw(x.pw),
      };
      const { rows } = await q(
        `insert into accounts (id, cx_id, role, login, login_key, name, phone, pw, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'active') returning *`,
        [a.id, a.cx_id, a.role, a.login, a.login_key, a.name, a.phone, a.pw],
      );
      await C.audit(q, { me: rows[0], ip: c.ip }, 'complex.create', 'complex', id, { name: cxName });
      return rows[0];
    });
    await A.createSession(c, acc);
    return { ok: true, msg: 'СӨХ бүртгэгдлээ', acc: A.pub(acc), layout: L };
  }

  /** Оршин суугчийн хүсэлт → pending → тухайн хотхоны админ батална */
  async function registerResident(c, x, name) {
    const cx = clean(x.cx, 64);
    if (!cx) throw bad('Хотхон сонгоно уу');
    const b = int(x.b, 1),
      n = int(x.u, 1);
    if (!b) throw bad('Байраа сонгоно уу');
    if (!n) throw bad('Тоотоо бичнэ үү');
    const acc = await db.tx(async (q) => {
      await C.getComplex(q, cx);
      const unit = await C.unitByBN(q, cx, b, n);
      if (!unit) throw bad('Ийм байр, тоот бүртгэлгүй байна');
      const old = await findAcc(q, cx, 'resident', x.phone);
      if (old && old.status !== 'rejected')
        throw bad(
          old.status === 'pending'
            ? 'Энэ дугаараар хүсэлт илгээгдсэн, СӨХ-ийн баталгаажуулалтыг хүлээнэ үү'
            : 'Энэ дугаар бүртгэлтэй байна — нэвтэрнэ үү',
        );
      if (old) await q('delete from accounts where id = $1', [old.id]); // татгалзсан хүсэлтийг солино
      const phone = digits(x.phone);
      const { rows } = await q(
        `insert into accounts (id, cx_id, role, login, login_key, name, phone, pw, status, b, u, fam)
         values ($1, $2, 'resident', $3, $3, $4, $3, $5, 'pending', $6, $7, $8) returning *`,
        [newId(), cx, phone, name, await A.hashPw(x.pw), b, n, Math.max(1, int(x.fam, 1, 30) || 1)],
      );
      await notify(q, cx, { role: 'admin' }, {
        kind: 'acc',
        title: 'Шинэ бүртгэлийн хүсэлт',
        body: name + ' · ' + C.unitLabel(b, n),
        link: 'accounts',
      });
      await C.touch(q, cx);
      return rows[0];
    });
    return { ok: true, msg: 'Хүсэлт илгээгдлээ. СӨХ батлахад нэвтрэх боломжтой болно.', acc: A.pub(acc) };
  }

  /* ---------------- админ: бүртгэл удирдах ---------------- */
  on('GET', '/api/accounts', async (c) => {
    const me = await c.need('admin');
    const { rows } = await db.query(
      `select * from accounts where cx_id = $1 order by
       case status when 'pending' then 0 else 1 end, created_at desc`,
      [me.cx_id],
    );
    return rows.map(A.pub);
  });

  on('POST', '/api/accounts/staff', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const name = clean(x.name, 80),
      pos = clean(x.pos, 60);
    if (name.length < 2) throw bad('Ажилтны нэрийг бичнэ үү');
    if (!pos) throw bad('Албан тушаал бичнэ үү');
    const e = A.checkPhone(x.phone) || A.checkPw(x.pw);
    if (e) throw bad(e);
    const acc = await db.tx(async (q) => {
      const login = 'EMP-' + String(await U.next(q, me.cx_id, 'staff', 101)).padStart(3, '0');
      const { rows } = await q(
        `insert into accounts (id, cx_id, role, login, login_key, name, phone, pw, pos, cats, created_by)
         values ($1, $2, 'staff', $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
        [newId(), me.cx_id, login, A.loginKey('staff', login), name, digits(x.phone), await A.hashPw(x.pw), pos, catsOf(x), me.login],
      );
      await C.audit(q, c, 'account.staff', 'account', rows[0].id, { login });
      await C.touch(q, me.cx_id);
      return rows[0];
    });
    return { ok: true, msg: acc.login + ' үүслээ', acc: A.pub(acc) };
  });

  on('POST', '/api/accounts/resident', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const name = clean(x.name, 80);
    if (name.length < 2) throw bad('Овог нэрээ бичнэ үү');
    const e = A.checkPhone(x.phone) || A.checkPw(x.pw);
    if (e) throw bad(e);
    const b = int(x.b, 1),
      n = int(x.u, 1);
    if (!b || !n) throw bad('Байр, тоотоо бичнэ үү');
    const acc = await db.tx(async (q) => {
      const unit = await C.unitByBN(q, me.cx_id, b, n);
      if (!unit) throw bad('Ийм байр, тоот бүртгэлгүй байна');
      const old = await findAcc(q, me.cx_id, 'resident', x.phone);
      if (old && old.status === 'pending')
        throw bad('Энэ дугаараар хүсэлт ирсэн байна — «Хүсэлт» хэсэгт батална уу');
      if (old && old.status !== 'rejected') throw bad('Энэ дугаар бүртгэлтэй байна');
      if (old) await q('delete from accounts where id = $1', [old.id]);
      const phone = digits(x.phone);
      const { rows } = await q(
        `insert into accounts (id, cx_id, role, login, login_key, name, phone, pw, status, unit_id, b, u, fam,
           created_by, decided_by, decided_at)
         values ($1, $2, 'resident', $3, $3, $4, $3, $5, 'active', $6, $7, $8, $9, $10, $10, now()) returning *`,
        [newId(), me.cx_id, phone, name, await A.hashPw(x.pw), unit.id, b, n, Math.max(1, int(x.fam, 1, 30) || 1), me.login],
      );
      await C.audit(q, c, 'account.resident', 'account', rows[0].id, { b, n });
      await C.touch(q, me.cx_id);
      return rows[0];
    });
    return { ok: true, msg: 'Оршин суугч бүртгэгдлээ', acc: A.pub(acc) };
  });

  on('PATCH', '/api/accounts/:id', async (c) => {
    const me = await c.need('admin');
    const x = await c.json();
    const M = { active: 'Баталгаажлаа', rejected: 'Татгалзлаа', disabled: 'Идэвхгүй болголоо' };
    let smsIds = [];
    const acc = await db.tx(async (q) => {
      const { rows } = await q('select * from accounts where id = $1 and cx_id = $2 for update', [
        c.params.id,
        me.cx_id,
      ]);
      const a = rows[0];
      if (!a) throw notFound('Бүртгэл олдсонгүй');
      if (a.role === 'admin') throw bad('СӨХ-ийн админы бүртгэлийг өөрчлөхгүй');
      const set = {};
      if (x.name !== undefined) {
        if (clean(x.name).length < 2) throw bad('Нэр буруу');
        set.name = clean(x.name, 80);
      }
      if (x.phone !== undefined) {
        const e = A.checkPhone(x.phone);
        if (e) throw bad(e);
        set.phone = digits(x.phone);
        if (a.role === 'resident') {
          set.login = set.phone;
          set.login_key = set.phone;
        }
      }
      if (a.role === 'staff' && x.pos !== undefined) set.pos = clean(x.pos, 60);
      if (a.role === 'staff' && x.cats !== undefined) set.cats = catsOf({ cats: x.cats });
      if (a.role === 'resident' && (x.b !== undefined || x.u !== undefined)) {
        set.b = int(x.b === undefined ? a.b : x.b, 1);
        set.u = int(x.u === undefined ? a.u : x.u, 1);
        if (!set.b || !set.u) throw bad('Байр, тоот буруу');
      }
      if (x.status !== undefined) {
        if (!M[x.status]) throw bad('Буруу төлөв');
        Object.assign(set, { status: x.status, note: clean(x.note, 300), decided_by: me.login });
      }
      // идэвхтэй оршин суугчийг айлтай нь холбоно
      const status = set.status || a.status;
      if (a.role === 'resident' && status === 'active') {
        const unit = await C.unitByBN(q, me.cx_id, set.b || a.b, set.u || a.u);
        if (!unit) throw bad('Ийм байр, тоот бүртгэлгүй байна');
        set.unit_id = unit.id;
      }
      const keys = Object.keys(set);
      if (!keys.length) throw bad('Өөрчлөх зүйл алга');
      const vals = keys.map((k) => set[k]);
      const sql = keys.map((k, i) => k + ' = $' + (i + 2)).join(', ');
      const r = await q(
        `update accounts set ${sql}${set.status ? ', decided_at = now()' : ''} where id = $1 returning *`,
        [a.id].concat(vals),
      );
      if (status !== 'active') await q('delete from sessions where account_id = $1', [a.id]);
      if (set.status === 'active' && a.status === 'pending' && r.rows[0].phone)
        smsIds = await sms(q, me.cx_id, [r.rows[0].phone], 'СӨХ Platform: таны бүртгэл баталгаажлаа. Нэвтэрч орно уу.');
      if (set.status === 'rejected' && a.status === 'pending' && r.rows[0].phone)
        smsIds = await sms(q, me.cx_id, [r.rows[0].phone], 'СӨХ Platform: бүртгэлийн хүсэлт татгалзагдлаа' + (set.note ? ': ' + set.note : '') + '.');
      await C.audit(q, c, 'account.update', 'account', a.id, set);
      await C.touch(q, me.cx_id);
      return r.rows[0];
    });
    if (smsIds.length) await flush({ ids: smsIds });
    return { ok: true, msg: x.status ? M[x.status] : 'Хадгаллаа', acc: A.pub(acc) };
  });
};
