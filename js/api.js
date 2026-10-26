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
 */
(function () {
  const BASE = window.SOKH_API || 'api';
  const LAYOUTS = 'sokh-layouts',
    SESSION = 'sokh-session',
    CUR = 'sokh-cx';
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
        : { ok: false, msg: j.error || 'Серверийн алдаа ' + r.status };
    } catch (e) {
      return { ok: false, msg: 'Сервертэй холбогдож чадсангүй' };
    }
  }
  function can(right) {
    const s = session();
    if (!s) return true; // нэвтрээгүй demo горим (хуудсыг шууд нээсэн)
    return (RIGHTS[s.role] || []).includes(right);
  }

  window.Api = {
    online: () => online,
    session,
    can,
    login(role, cx, id) {
      localStorage.setItem(SESSION, JSON.stringify({ role, cx, id, t: Date.now() }));
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
