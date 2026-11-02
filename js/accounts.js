/*
 * СӨХ Platform — хэрэглэгчийн бүртгэлийн дүрэм (browser + server/server.js хоёуланд ашиглана).
 * Энд зөвхөн жагсаалт дээр ажиллах цэвэр функцууд байна; хаана хадгалах нь js/api.js / server-ийн ажил.
 *
 *   СӨХ (admin)    — өөрөө бүртгүүлнэ → шинэ хотхон үүсч шууд идэвхтэй
 *   Оршин суугч    — мэдээллээ бөглөж хүсэлт илгээнэ → 'pending' → тухайн хотхоны админ батална
 *   Оршин суугч    — эсвэл админ өөрөө бүртгэнэ → шууд идэвхтэй
 *   Ажилтан        — зөвхөн админ үүсгэнэ (EMP-### ID автоматаар)
 *
 * Account: { id, role, cx, login, name, phone, pw, status, b, u, fam, pos, at, by, note }
 * Анхаар: нууц үгийн hash нь demo түвшний; бодит системд серверт bcrypt / scrypt ашиглана.
 */
(function (root) {
  const ROLES = ['admin', 'staff', 'resident'];
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const clean = (s) => String(s || '').trim();
  /** Нэвтрэх нэрийг харьцуулах хэлбэр: утас → зөвхөн цифр, бусад → жижиг үсэг */
  const key = (role, login) =>
    role === 'resident' ? digits(login) : clean(login).toLowerCase().replace(/\s+/g, '');
  /** cyrb53 — давс + нууц үгийн тогтмол hash (demo түвшин) */
  function hash(pw, salt) {
    const str = String(salt) + ':' + String(pw);
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const find = (list, role, cx, login) =>
    list.find((a) => a.role === role && a.cx === cx && key(role, a.login) === key(role, login));
  /** Нууц үг, дотоод талбаргүй хуулбар (жагсаалтад харуулах, серверээс буцаах) */
  const pub = (a) => {
    const o = Object.assign({}, a);
    delete o.pw;
    return o;
  };

  function checkPw(pw, pw2) {
    if (String(pw || '').length < 6) return 'Нууц үг дор хаяж 6 тэмдэгт байна';
    if (pw2 !== undefined && pw !== pw2) return 'Нууц үг таарахгүй байна';
    return null;
  }
  function checkPhone(p) {
    return /^\d{8}$/.test(digits(p)) ? null : 'Утасны дугаар 8 оронтой байна';
  }

  /**
   * Оршин суугчийн хүсэлт эсвэл СӨХ-ийн бүртгэл. → { ok, msg, acc }
   * in: { role, cx, name, phone, pw, pw2, login (admin), b, u, fam (resident) }
   */
  function register(list, x) {
    const role = x.role;
    if (role !== 'admin' && role !== 'resident')
      return { ok: false, msg: 'Ажилтны эрхийг зөвхөн СӨХ-ийн админ үүсгэнэ' };
    const name = clean(x.name);
    if (name.length < 2) return { ok: false, msg: 'Овог нэрээ бичнэ үү' };
    if (!clean(x.cx)) return { ok: false, msg: 'Хотхон сонгоно уу' };
    const bad = checkPhone(x.phone) || checkPw(x.pw, x.pw2);
    if (bad) return { ok: false, msg: bad };
    const acc = {
      id: uid(),
      role,
      cx: clean(x.cx),
      name,
      phone: digits(x.phone),
      at: Date.now(),
    };
    if (role === 'resident') {
      const b = Number(x.b),
        u = Number(x.u);
      if (!(b > 0)) return { ok: false, msg: 'Байраа сонгоно уу' };
      if (!(u > 0)) return { ok: false, msg: 'Тоотоо бичнэ үү' };
      const old = find(list, 'resident', acc.cx, acc.phone);
      if (old && old.status !== 'rejected')
        return {
          ok: false,
          msg:
            old.status === 'pending'
              ? 'Энэ дугаараар хүсэлт илгээгдсэн, СӨХ-ийн баталгаажуулалтыг хүлээнэ үү'
              : 'Энэ дугаар бүртгэлтэй байна — нэвтэрнэ үү',
        };
      Object.assign(acc, {
        login: acc.phone,
        b,
        u,
        fam: Math.max(1, Number(x.fam) || 1),
        status: 'pending',
      });
      if (old) list.splice(list.indexOf(old), 1); // татгалзсан хүсэлтийг шинээр солино
    } else {
      const login = clean(x.login);
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(login))
        return { ok: false, msg: 'Нэвтрэх нэр 3–32 латин үсэг, тоо байна' };
      if (find(list, 'admin', acc.cx, login))
        return { ok: false, msg: 'Энэ нэвтрэх нэр бүртгэлтэй байна' };
      Object.assign(acc, { login, status: 'active' });
    }
    acc.pw = hash(x.pw, acc.id);
    list.push(acc);
    return {
      ok: true,
      acc,
      msg:
        role === 'resident'
          ? 'Хүсэлт илгээгдлээ. СӨХ батлахад нэвтрэх боломжтой болно.'
          : 'СӨХ бүртгэгдлээ',
    };
  }

  /** Админ оршин суугчийг өөрөө бүртгэнэ → шууд идэвхтэй { ok, msg, acc } */
  function createResident(list, cx, x, by) {
    const old = find(list, 'resident', cx, x.phone);
    if (old && old.status === 'pending')
      return { ok: false, msg: 'Энэ дугаараар хүсэлт ирсэн байна — «Хүсэлт» хэсэгт батална уу' };
    const r = register(list, Object.assign({}, x, { role: 'resident', cx, pw2: x.pw }));
    if (!r.ok) return r;
    Object.assign(r.acc, { status: 'active', by: by || '', dAt: Date.now() });
    return { ok: true, acc: r.acc, msg: 'Оршин суугч бүртгэгдлээ' };
  }

  /** Админ ажилтан үүсгэнэ → { ok, msg, acc } (acc.login = EMP-###) */
  function createStaff(list, cx, x, by) {
    const name = clean(x.name);
    if (name.length < 2) return { ok: false, msg: 'Ажилтны нэрийг бичнэ үү' };
    if (!clean(x.pos)) return { ok: false, msg: 'Албан тушаал бичнэ үү' };
    const bad = checkPhone(x.phone) || checkPw(x.pw);
    if (bad) return { ok: false, msg: bad };
    // demo ажилтнууд EMP-001…EMP-0xx-ийг ашигладаг тул 101-ээс эхэлнэ
    const used = list
      .filter((a) => a.role === 'staff' && a.cx === cx)
      .map((a) => Number(String(a.login).replace(/\D/g, '')) || 0);
    const n = Math.max(100, ...used) + 1;
    const acc = {
      id: uid(),
      role: 'staff',
      cx,
      login: 'EMP-' + String(n).padStart(3, '0'),
      name,
      phone: digits(x.phone),
      pos: clean(x.pos),
      status: 'active',
      at: Date.now(),
      by: by || '',
    };
    acc.pw = hash(x.pw, acc.id);
    list.push(acc);
    return { ok: true, acc, msg: acc.login + ' үүслээ' };
  }

  /** Админ хүсэлтийг батлах / татгалзах, ажилтныг идэвхгүй болгох. status: active|rejected|disabled */
  function decide(list, cx, id, status, note, by) {
    const a = list.find((x) => x.id === id && x.cx === cx);
    if (!a) return { ok: false, msg: 'Бүртгэл олдсонгүй' };
    if (a.role === 'admin') return { ok: false, msg: 'СӨХ-ийн админы бүртгэлийг өөрчлөхгүй' };
    if (!['active', 'rejected', 'disabled'].includes(status))
      return { ok: false, msg: 'Буруу төлөв' };
    Object.assign(a, { status, note: clean(note), by: by || '', dAt: Date.now() });
    const M = { active: 'Баталгаажлаа', rejected: 'Татгалзлаа', disabled: 'Идэвхгүй болголоо' };
    return { ok: true, acc: a, msg: M[status] };
  }

  /** Нэвтрэх шалгалт → { ok, acc } | { ok:false, msg, status } */
  function check(list, role, cx, login, pw) {
    if (!ROLES.includes(role)) return { ok: false, msg: 'Эрх буруу' };
    const a = find(list, role, cx, login);
    if (!a || a.pw !== hash(pw, a.id))
      return { ok: false, msg: 'Нэвтрэх нэр эсвэл нууц үг буруу байна' };
    if (a.status === 'pending')
      return {
        ok: false,
        status: 'pending',
        msg: 'Таны бүртгэлийн хүсэлтийг СӨХ хянаж байна. Баталгаажсаны дараа нэвтэрнэ.',
      };
    if (a.status === 'rejected')
      return {
        ok: false,
        status: 'rejected',
        msg: 'Бүртгэлийн хүсэлт татгалзагдсан' + (a.note ? ': ' + a.note : '') + '.',
      };
    if (a.status === 'disabled')
      return { ok: false, status: 'disabled', msg: 'Бүртгэл идэвхгүй байна. СӨХ-д хандана уу.' };
    return { ok: true, acc: a };
  }

  const Accounts = { register, createResident, createStaff, decide, check, pub, hash, key, digits };
  if (typeof module === 'object' && module.exports) module.exports = Accounts;
  else root.Accounts = Accounts;
})(typeof window !== 'undefined' ? window : this);
