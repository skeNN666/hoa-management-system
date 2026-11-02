/*
 * СӨХ Platform — backend адаптер + нэвтрэлтийн session (layout.js-ээс өмнө ачаална).
 *
 * • Server байвал (node server/server.js):  хотхоны map-ууд серверт хадгалагдаж, бүх
 *   компьютер, browser дээр ижил харагдана. Хуудас ачаалахад серверийн map-уудыг
 *   localStorage руу татна (layout.js синхрон уншдаг тул).
 * • Server байхгүй бол (index.html-ийг шууд нээсэн, python http.server г.м.):
 *   өмнөх шигээ зөвхөн browser-ийн localStorage-д ажиллана.
 *
 *   Api.online()            → server холбогдсон эсэх
 *   Api.saveLayout(L)        → Promise<{ ok, msg }>
 *   Api.resetLayout(id)      → Promise<{ ok, msg }>
 *   Api.session() / login(role, cx, id) / logout()
 *   Api.guard('admin')       → өөр эрхтэй хэрэглэгчийг өөрийнх нь хуудас руу шилжүүлнэ
 *   Api.can('editLayout')    → эрх шалгах
 *   Api.accounts.register(x) / signIn(role, cx, login, pw) / list() / createStaff(x) / createResident(x) /
 *                decide(id, status, note) / watch(cb)  — бүгд Promise<{ ok, msg, acc }>
 *                (дүрэм js/accounts.js-д; server байвал серверт, үгүй бол localStorage-д)
 */
(function () {
  const BASE = window.SOKH_API || 'api';
  const LAYOUTS = 'sokh-layouts',
    SESSION = 'sokh-session',
    CUR = 'sokh-cx',
    ACCS = 'sokh-accounts';
  const PAGES = { admin: 'admin.html', staff: 'staff.html', resident: 'resident.html' };
  // эрх бүрийн зөвшөөрөл (backend ч ижил дүрмээр шалгана)
  const RIGHTS = {
    admin: ['editLayout', 'assignSlot', 'finance', 'viewAll'],
    staff: ['viewAll'],
    resident: [],
  };
  let online = false;

  const read = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch (e) {
      return null;
    }
  };
  const session = () => read(SESSION);

  // Server-ээс map-уудыг синхрон татна (layout.js шууд ашиглахын тулд). file://-д алгасна.
  if (/^https?:$/.test(location.protocol))
    try {
      const x = new XMLHttpRequest();
      x.open('GET', BASE + '/layouts', false);
      x.send();
      if (x.status === 200 && /json/.test(x.getResponseHeader('Content-Type') || '')) {
        localStorage.setItem(LAYOUTS, JSON.stringify(JSON.parse(x.responseText)));
        online = true;
      }
    } catch (e) {}

  const headers = () => {
    const s = session() || {};
    return {
      'Content-Type': 'application/json',
      'X-Sokh-Role': s.role || '',
      'X-Sokh-Cx': s.cx || '',
      'X-Sokh-User': encodeURIComponent(s.id || ''),
    };
  };
  async function call(method, url, body) {
    try {
      const r = await fetch(BASE + url, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      return r.ok
        ? { ok: true, ...j }
        : { ok: false, msg: j.error || 'Серверийн алдаа ' + r.status, status: j.status };
    } catch (e) {
      return { ok: false, msg: 'Сервертэй холбогдож чадсангүй' };
    }
  }
  function can(right) {
    const s = session();
    if (!s) return true; // нэвтрээгүй demo горим (хуудсыг шууд нээсэн)
    return (RIGHTS[s.role] || []).includes(right);
  }

  /* ---------- хэрэглэгчийн бүртгэл ---------- */
  // offline: js/accounts.js-ийн дүрмээр localStorage-д (server-тэй ижил үр дүн)
  const local = (fn, write) => {
    const list = read(ACCS) || [];
    const r = fn(list);
    if (r.ok && write) localStorage.setItem(ACCS, JSON.stringify(list));
    if (r.acc) r.acc = Accounts.pub(r.acc);
    return Promise.resolve(r);
  };
  const isAdmin = () => {
    const s = session();
    return s && s.role === 'admin' ? s : null;
  };
  const DENY = Promise.resolve({ ok: false, msg: 'Зөвхөн СӨХ-ийн админ' });
  const accounts = {
    register(x) {
      if (online) return call('POST', '/accounts/register', x);
      return local((l) => Accounts.register(l, x), true);
    },
    signIn(role, cx, login, pw) {
      if (online) return call('POST', '/accounts/login', { role, cx, login, pw });
      return local((l) => Accounts.check(l, role, cx, login, pw));
    },
    /** тухайн хотхоны бүх бүртгэл (нууц үггүй) → Promise<{ ok, list }> */
    list() {
      const s = isAdmin();
      if (!s) return DENY;
      if (online)
        return fetch(BASE + '/accounts', { headers: headers() })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((list) => ({ ok: true, list }))
          .catch(() => ({ ok: false, msg: 'Сервертэй холбогдож чадсангүй', list: [] }));
      const list = (read(ACCS) || []).filter((a) => a.cx === s.cx).map(Accounts.pub);
      return Promise.resolve({ ok: true, list });
    },
    createStaff(x) {
      const s = isAdmin();
      if (!s) return DENY;
      if (online) return call('POST', '/accounts/staff', x);
      return local((l) => Accounts.createStaff(l, s.cx, x, s.id), true);
    },
    createResident(x) {
      const s = isAdmin();
      if (!s) return DENY;
      if (online) return call('POST', '/accounts/resident', x);
      return local((l) => Accounts.createResident(l, s.cx, x, s.id), true);
    },
    decide(id, status, note) {
      const s = isAdmin();
      if (!s) return DENY;
      if (online) return call('PATCH', '/accounts/' + encodeURIComponent(id), { status, note });
      return local((l) => Accounts.decide(l, s.cx, id, status, note, s.id), true);
    },
    /** шинэ хүсэлт ирэхэд cb() — offline: өөр таб (storage event), online: 8 сек тутам */
    watch(cb) {
      addEventListener('storage', (e) => e.key === ACCS && cb());
      if (online) setInterval(cb, 8000);
    },
  };

  window.Api = {
    online: () => online,
    session,
    can,
    accounts,
    login(role, cx, id, name) {
      localStorage.setItem(SESSION, JSON.stringify({ role, cx, id, name, t: Date.now() }));
      localStorage.setItem(CUR, cx);
    },
    logout() {
      localStorage.removeItem(SESSION);
    },
    /** Энэ хуудсанд өөр эрхтэй хэрэглэгч орвол өөрийнх нь хуудас руу */
    guard(role) {
      const s = session();
      if (s && s.role !== role && PAGES[s.role]) {
        location.replace(PAGES[s.role]);
        return false;
      }
      return true;
    },
    saveLayout(L) {
      if (!can('editLayout'))
        return Promise.resolve({ ok: false, msg: 'Map засах эрх зөвхөн админд байна' });
      if (!online) return Promise.resolve({ ok: true });
      return call('PUT', '/layouts/' + encodeURIComponent(L.id), L);
    },
    resetLayout(id) {
      if (!can('editLayout'))
        return Promise.resolve({ ok: false, msg: 'Map засах эрх зөвхөн админд байна' });
      if (!online) return Promise.resolve({ ok: true });
      return call('DELETE', '/layouts/' + encodeURIComponent(id));
    },
  };
})();
