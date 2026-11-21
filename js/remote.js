/*
 * СӨХ Platform — server-тэй үеийн store (data.js-ийн дараа, store.js-ээс өмнө ачаална).
 * Api.remote() (server + нэвтэрсэн) бол window.S-ийг энд үүсгэнэ, store.js өөрийгөө алгасна.
 *
 * • Хуудас ачаалахад GET /api/boot — нэвтэрсэн хэрэглэгчийн өгөгдлийг store.js-ийн төлвийн
 *   хэлбэрээр (reqs, slots, leaks, notifs …) авна; D.ME, D.ME_STAFF, D.CUR_MONTH-ыг бодитоор солино.
 * • Үйлдэл бүр (S.pay, S.newRequest, S.reserveSlot …) API руу явж, дараа нь boot-ыг дахин татна.
 * • /api/live (WebSocket → Cloudflare Durable Object): хотхонд өөрчлөлт гармагц шууд /api/sync.
 *   Холболт байхгүй үед (локал Node server г.м.) 5 сек тутам /api/sync — өмнөх шигээ.
 * • Симуляц (tick) байхгүй; зөвхөн захиалгын тоолуур секунд тутам шинэчлэгдэнэ.
 */
(function () {
  if (!window.Api || !Api.remote()) return;
  const PAGES = { admin: 'admin.html', staff: 'staff.html', resident: 'resident.html' };
  const page = location.pathname.split('/').pop();
  if (!Object.values(PAGES).includes(page)) return;

  /* ---------- эхний өгөгдөл (синхрон: хуудсууд D.ME-г шууд уншдаг) ---------- */
  let B = null;
  try {
    const x = new XMLHttpRequest();
    x.open('GET', 'api/boot', false);
    x.send();
    if (x.status === 401) {
      Api.logout(); // session дууссан → guard() login руу шилжүүлнэ
      return;
    }
    if (x.status === 200) B = JSON.parse(x.responseText);
  } catch (e) {}
  if (!B) return; // server алдаа → демо store

  // localStorage-ийн session серверийнхээс зөрвөл серверийнхийг үнэн гэж үзнэ
  const sess = Api.session();
  if (sess.role !== B.role || sess.cx !== B.me.cx) Api.login(B.role, B.me.cx, B.me.login, B.me.name);

  const COLORS = D.CAR_COLORS;
  const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

  function applyD(b) {
    D.CUR_MONTH = b.month;
    D.MONTHS.splice(0, D.MONTHS.length, ...b.months);
    if (b.staff) D.STAFF = b.staff;
    if (b.role === 'resident')
      Object.assign(D.ME, { name: b.me.name, b: b.me.b, n: b.me.n, plate: b.me.plate, bill: b.me.bill, phone: b.me.phone, fam: b.me.fam });
    if (b.role === 'staff') Object.assign(D.ME_STAFF, { n: b.me.name, role: b.me.pos, cats: b.me.cats });
  }
  applyD(B);

  const store = Nar.createStore({
    key: 'sokh-v1',
    version: 'remote:' + B.role + ':' + B.me.cx,
    init: () => ({ theme: null }),
    keep: ['theme'],
  });
  let st = store.state;
  if (!st.theme)
    st.theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let units = [];
  let ver = B.ver;

  /** boot-ын өгөгдлийг төлөвт буулгана */
  function apply(b) {
    st = store.state;
    const slots = b.slots.map((s) => ({ ...s, color: s.st ? COLORS[Math.abs(hash(s.id + s.plate)) % COLORS.length] : undefined }));
    Object.assign(st, {
      sec: st.sec || 0,
      reqs: b.reqs,
      leaks: b.leaks,
      lights: b.lights,
      slots,
      payments: b.payments || [],
      notifs: b.notifs,
      ledger: b.ledger,
      works: b.works,
      obligations: b.obligations,
      reportPub: b.reportPub,
      fund: b.fund,
      staff: b.staff || [],
      invoice: b.invoice || st.invoice || {},
      invHist: b.invHist || [],
      sla: b.sla || 30,
      reminded: b.reminded || {},
      paid: b.paid !== undefined ? b.paid : true,
      wilt: b.wilt || 0,
      bill: b.bill || null,
      park: b.park || { stage: 'idle', slot: '', hold: 0, pos: 0 },
      payProvider: b.payProvider || null,
    });
    units = b.units;
    ver = b.ver;
  }
  apply(B);

  let loading = null,
    again = false;
  /** boot-ыг дахин татаж бүх хуудсыг шинэчилнэ */
  function refresh() {
    if (loading) {
      again = true;
      return loading;
    }
    loading = fetch('api/boot', { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (r.status === 401) {
          Api.logout();
          location.replace('index.html');
          return;
        }
        return r.ok ? r.json() : null;
      })
      .then((b) => {
        if (!b) return;
        applyD(b);
        apply(b);
        store.emit(['all']);
      })
      .catch(() => {})
      .finally(() => {
        loading = null;
        if (again) {
          again = false;
          refresh();
        }
      });
    return loading;
  }

  const toast = (t, s, k) => Nar.toast(t, s, k);
  /** API дуудаад, амжилттай бол мэдэгдэл харуулж, өгөгдлөө шинэчилнэ */
  async function act(method, url, body, okTitle, okSub) {
    const r = await Api.call(method, url, body);
    if (!r.ok) {
      toast(r.msg || 'Алдаа гарлаа', '', 'bad');
      return r;
    }
    if (okTitle !== false) toast(okTitle || r.msg || 'Хадгаллаа', okSub || (okTitle && r.msg) || '', 'ok');
    await refresh();
    return r;
  }
  const rq = (code) => st.reqs.find((q) => q.id === code) || {};
  const unitOf = (b, n) => units.flat().find((u) => u.b === b && u.n === n);

  /** Зураг сонгуулна (хэрэглэгчийн товшилтын дотор дуудна) → Promise<File|null> */
  function pickFile() {
    return new Promise((ok) => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = 'image/png,image/jpeg,image/webp';
      i.onchange = () => ok(i.files[0] || null);
      i.click();
    });
  }
  async function upload(url, file) {
    if (!file) return { ok: false };
    if (file.size > 4 * 1024 * 1024) {
      toast('Зураг 4MB-аас бага байна', '', 'warn');
      return { ok: false };
    }
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast(j.error || 'Зураг хадгалагдсангүй', '', 'bad');
      return { ok: r.ok, ...j };
    } catch (e) {
      toast('Сервертэй холбогдож чадсангүй', '', 'bad');
      return { ok: false };
    }
  }
  let reqPhoto = null; // хүсэлт илгээхээс өмнө сонгосон зураг

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const S = {
    remote: true,
    get state() {
      return store.state;
    },
    get units() {
      return units;
    },
    on: store.on,
    emit: (t) => store.emit(t),
    store,
    refresh,
    toast,
    role: '',
    notify() {},
    readAll(r) {
      (st.notifs[r] || []).forEach((n) => (n.unread = false));
      store.emit(['notifs']);
      Api.call('POST', '/notifications/read', {});
    },
    setTheme(t) {
      st.theme = t;
      store.emit(['theme']);
    },
    toggleTheme() {
      S.setTheme(st.theme === 'dark' ? 'light' : 'dark');
    },
    reset: () => refresh(),

    /* ---------- төлбөр ---------- */
    /** Оршин суугч төлөх → Promise<boolean> (QPay: банкны апп/QR шинэ цонхонд, төлөгдтөл хүлээнэ) */
    async pay(channel) {
      const qpay = st.payProvider === 'qpay';
      const win = qpay ? window.open('', '_blank') : null; // товшилтын дотор нээнэ (popup blocker)
      const r = await Api.call('POST', '/payments', { channel: channel || 'QPay' });
      if (!r.ok) {
        if (win) win.close();
        toast(r.msg || 'Төлбөр үүсгэж чадсангүй', '', 'bad');
        return false;
      }
      if (r.provider === 'mock') {
        const c = await Api.call('POST', '/payments/' + r.id + '/mock-confirm', {});
        if (!c.ok || c.status !== 'paid') return toast(c.msg || 'Төлбөр батлагдсангүй', '', 'bad'), false;
      } else {
        const q = r.qr || {};
        const link = (q.urls || []).find((u) => (u.description || u.name || '').includes(channel)) || (q.urls || [])[0];
        if (win) win.location = (link && link.link) || q.short_url || 'about:blank';
        // төлөгдсөн эсэхийг 10 минут хүртэл шалгана
        let paid = false;
        for (let i = 0; i < 200 && !paid; i++) {
          await wait(3000);
          const s = await Api.call('GET', '/payments/' + r.id);
          paid = s.ok && s.status === 'paid';
        }
        if (!paid) return toast('Төлбөр баталгаажаагүй байна', 'Төлсөн бол хэсэг хүлээгээд шинэчилнэ үү', 'warn'), false;
      }
      await refresh();
      return true;
    },
    remind(b, n) {
      const u = unitOf(b, n);
      if (u) act('POST', '/reminders', { unit_id: u.id }, 'Сануулга илгээгдлээ', b + '-р байр ' + n + ' · SMS + апп');
    },
    remindAll() {
      act('POST', '/reminders', { all: true }, 'Сануулга илгээгдлээ');
    },
    setInvoice(p) {
      Object.assign(st.invoice, p);
      store.emit(['invoice']);
      act('PUT', '/settings', { invoice: p }, false);
    },
    runInvoices() {
      act('POST', '/invoices/run', {});
    },
    setSla(m) {
      st.sla = m;
      act('PUT', '/settings', { sla: m }, false);
    },

    /* ---------- хүсэлт ---------- */
    /** → Promise<код> */
    async newRequest({ title, cat, p, desc }) {
      const r = await Api.call('POST', '/requests', { title, cat, priority: p, descr: desc });
      if (!r.ok) {
        toast(r.msg || 'Хүсэлт илгээгдсэнгүй', '', 'bad');
        return null;
      }
      if (reqPhoto) await upload('api/requests/' + r.id + '/photos?kind=before', reqPhoto);
      reqPhoto = null;
      await refresh();
      return r.code;
    },
    /** Хүсэлтэд хавсаргах зураг сонгох (илгээхээс өмнө) → Promise<boolean> */
    async pickRequestPhoto() {
      reqPhoto = await pickFile();
      return !!reqPhoto;
    },
    takeRequest(code, by) {
      const q = rq(code);
      if (B.role === 'staff') return act('POST', '/requests/' + q.rid + '/take', {}, false);
      const s = st.staff.find((x) => x.n === by);
      if (!s) return toast('Ажилтан олдсонгүй', '', 'warn');
      return act('POST', '/requests/' + q.rid + '/assign', { staff_id: s.aid }, 'Ажилтан оноогдлоо', code + ' · ' + s.n);
    },
    setReqStatus(code, s) {
      return act('POST', '/requests/' + rq(code).rid + '/status', { status: s }, false);
    },
    /** Шийдсэн ажлын зураг (ажилтан) → Promise<boolean> */
    async addPhoto(code) {
      const f = await pickFile();
      if (!f) return false;
      const r = await upload('api/requests/' + rq(code).rid + '/photos?kind=' + (B.role === 'resident' ? 'before' : 'after'), f);
      if (r.ok) await refresh();
      return r.ok;
    },

    /* ---------- ус алдалт, гэрэл ---------- */
    newLeak(b, u, room) {
      act('POST', '/leaks', { b, n: u, room }, 'Ус алдалт бүртгэгдлээ', b + '-р байр · ' + u + ' тоот · ' + room);
    },
    closeLeak(code) {
      const l = st.leaks.find((x) => x.id === code);
      if (l) act('POST', '/leaks/' + l.lid + '/close', {});
    },
    breakLight(id) {
      act('POST', '/lights/' + id + '/report', {}, false);
    },
    fixLight(id) {
      act('POST', '/lights/' + id + '/fix', {});
    },

    /* ---------- зогсоол ---------- */
    reserveSlot(id) {
      const s = st.slots.find((x) => x.id === id);
      if (!s || s.st !== 0) return;
      const mine = D.ME.b + '-' + D.ME.n;
      if (s.own && s.own !== mine)
        return toast(id + ' түрээсийн зогсоол', 'Өөр айлд хуваарилагдсан тул захиалах боломжгүй', 'warn');
      act('POST', '/parking/reserve', { slot_id: id }, id + ' захиалагдлаа', 'Хугацаандаа очиж зогсоно уу');
    },
    parkNotify() {
      act('POST', '/parking/queue', {}, 'Дараалалд бүртгэгдлээ', 'Сул зогсоол гармагц мэдэгдэнэ');
    },
    parkCancel() {
      if (st.park.stage === 'reserved') act('POST', '/parking/cancel', {}, false);
      else act('DELETE', '/parking/queue', undefined, false);
    },
    parkArrive() {
      act('POST', '/parking/arrive', {}, false);
    },
    parkLeave() {
      act('POST', '/parking/leave', {}, false);
    },
    assignSlot(id, key, fee) {
      act('POST', '/slots/' + encodeURIComponent(id) + '/rental', { unit: key, fee });
    },
    unassignSlot(id) {
      act('DELETE', '/slots/' + encodeURIComponent(id) + '/rental');
    },
    rentIncome() {
      const L = st.slots.filter((x) => x.own);
      return { n: L.length, sum: L.reduce((a, x) => a + (x.fee || 0), 0) };
    },
    slotOf(b, n) {
      return st.slots.find((x) => x.own === b + '-' + n) || null;
    },

    /* ---------- санхүү ---------- */
    fund: () => st.fund,
    addExpense({ cat, t, amt, vendor }) {
      act('POST', '/finance/ledger', { cat, title: t, amount: amt, vendor }, 'Зарлага нийтлэгдлээ', 'Оршин суугчид шууд харагдана');
    },
    addWork({ cat, t, where }) {
      act('POST', '/works', { cat, title: t, location: where }, 'Ажил тайланд нэмэгдлээ', 'Оршин суугчдад мэдэгдэл очлоо');
    },
    payObligation(id) {
      act('POST', '/finance/obligations/' + id + '/pay', {});
    },
    publishReport(month) {
      act('POST', '/reports/' + month + '/publish', {});
    },

    /** Секунд тутам: захиалгын тоолуур (симуляц байхгүй) */
    tick() {
      st.sec = (st.sec || 0) + 1;
      const T = ['tick'];
      const p = st.park;
      if (p && p.until) {
        const h = Math.max(0, Math.round((p.until - Date.now()) / 1000));
        if (h !== p.hold) {
          p.hold = h;
          T.push('park');
        }
        if (!h) {
          p.until = 0;
          refresh();
        }
      }
      store.emit(T, false);
    },
  };
  // өөр таб (ижил хэрэглэгч) өөрчилбөл
  store.onExternal = (n, old) => {
    n.theme = n.theme || old.theme;
    st = n;
  };
  window.S = S;

  setInterval(() => S.tick(), 1000);
  // бусдын өөрчлөлт: WebSocket (DO) дохио ирвэл шууд, эс бөгөөс 5 сек тутам ver шалгана.
  // Live холбогдсон үед polling нь зөвхөн нөөц (30 сек; таб нуугдсан үед 60 сек).
  let lastPoll = 0,
    live = false;
  (function connect(wait) {
    if (!window.WebSocket) return;
    let ws,
      ping = 0;
    try {
      ws = new WebSocket(location.href.replace(/^http/, 'ws').replace(/[^/]*$/, '') + 'api/live');
    } catch (e) {
      return;
    }
    ws.onopen = () => {
      live = true;
      wait = 1000;
      lastPoll = 0; // холбогдох хооронд алдсан өөрчлөлтийг нөхнө
      ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 30000);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      try {
        if (JSON.parse(e.data).type === 'sync') lastPoll = 0; // дараагийн секундэд /api/sync
      } catch (err) {}
    };
    ws.onclose = () => {
      live = false;
      clearInterval(ping);
      // server WebSocket дэмжихгүй (локал Node) эсвэл тасарсан → дахин оролдоно (≤ 60 сек)
      setTimeout(() => connect(Math.min(wait * 2, 60000)), wait);
    };
  })(2000);
  setInterval(() => {
    const gap = live ? (document.hidden ? 60000 : 30000) : document.hidden ? 30000 : 5000;
    if (Date.now() - lastPoll < gap || loading) return;
    lastPoll = Date.now();
    const top = ((st.notifs[B.role] || [])[0] || {}).id || 0;
    fetch('api/sync?since=' + top)
      .then((r) => (r.status === 401 ? (Api.logout(), location.replace('index.html')) : r.ok ? r.json() : null))
      .then((s) => {
        if (s && (s.ver !== ver || s.notifs.length)) refresh();
      })
      .catch(() => {});
  }, 1000);
})();
