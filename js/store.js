/*
 * СӨХ Platform — store (төлөв + үйлдлүүд).
 * • Төлөв localStorage-д хадгалагдана → admin.html, staff.html, resident.html-ийг өөр өөр табд нээвэл
 *   өгөгдөл нь шууд солилцоно (оршин суугчийн хүсэлт ажилтан, удирдлага дээр тэр дороо гарна).
 * • Секунд тутмын "шууд" симуляцыг зөвхөн нэг таб (leader) ажиллуулна.
 * Backend холбохдоо action-уудыг fetch('/api/...')-аар, tick()-ийг WebSocket/SSE-ээр солино.
 */
(function () {
  const KEY = 'sokh-v1', LEAD = 'sokh-leader';
  const ROOMS = ['Угаалгын өрөө', 'Гал тогоо', 'Бойлер'];
  const WORKER = { 'Лифт': 'Ж. Нарантуяа', 'Сантехник': 'С. Мөнхзул', 'Цахилгаан': 'Н. Тунгалаг', 'Дулаан': 'С. Мөнхзул' };
  const ME = D.ME; const hm = D.hm;
  let nid = Date.now() % 100000;
  
  function fresh() {
    return {
      sec: 0, theme: null, slots: D.makeSlots(), lights: D.LIGHTS.map((l) => ({ ...l })),
      leaks: [
        { id: 'LK-0430', b: 2, u: 57, room: 'Гал тогоо', st: 'fixing', t0: -10, times: ['16:21', '16:21', '16:22', '16:31', ''], by: 'С. Мөнхзул' },
        { id: 'LK-0429', b: 6, u: 140, room: 'Угаалгын өрөө', st: 'fixed', t0: -400, times: ['09:12', '09:12', '09:12', '09:20', '10:05'], by: 'Ц. Эрдэнэ' },
      ],
      reqs: D.REQUESTS.map((q) => ({ ...q })), incoming: D.INCOMING.map((q) => ({ ...q })),
      payments: Array.from({ length: 8 }, (_, i) => ({ time: hm(Date.now() - i * 7 * 60000), inv: 'INV-2026-' + (2400 - i * 7), unit: ((i % 6) + 1) + '-р байр ' + (30 + i * 19), name: D.PAY_NAMES[i], ch: D.CHANNELS[i % 5], amt: 65000 + (i % 4) * 10000 })),
      reminded: {}, paidUnits: [], invoice: { auto: true, day: 1, time: '09:00', due: 10, remBefore: true, remAfter: true, remSms: true },
      notifs: {
        admin: [{ id: nid++, k: 'warn', t: 'SLA хэтэрсэн хүсэлт', s: 'REQ-1040 · 48 мин хүлээн аваагүй', time: '10:02', unread: true }],
        staff: [{ id: nid++, k: 'acc', t: 'Та хүсэлт хүлээн авлаа', s: 'REQ-1042 · Лифтний эвдрэл · 5-р байр', time: '07:58', unread: true }],
        resident: [{ id: nid++, k: 'bad', t: 'Төлбөрийн хугацаа дуусах гэж байна', s: '10/10 хүртэл 5 хоног · ₮97,000', time: '08:00', unread: true }, { id: nid++, k: 'acc', t: 'Ус тасрах тухай мэдэгдэл', s: '10/21 09:00–12:00 · бүх оршин суугч', time: '09:40', unread: true }],
      },
      staff: D.STAFF.map((x) => ({ ...x })), paid: false, wilt: 0.3, park: { stage: 'idle', slot: '', hold: 0, pos: 0 },
    };
  }

  const store = Nar.createStore({ key: KEY, version: 2, init: fresh, keep: ['theme'] });
  let st = store.state;
  if (!st.theme) st.theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let units = D.makeUnits();
  const applyPaid = () => { units = D.makeUnits(); st.paidUnits.forEach((k) => { const [b, n] = k.split('-').map(Number); units[b - 1][n - 1] = { ...units[b - 1][n - 1], st: 0, prev: 0 }; }); };
  applyPaid();
  // өөр табаас өөрчлөлт ирвэл: theme-ээ хадгалаад, айлуудын төлбөрийг шинэчилнэ
  store.onExternal = (n, old) => { n.theme = n.theme || old.theme; st = n; applyPaid(); };
  const emit = (t) => { st = store.state; store.emit(t); };

  const S = {
    get state() { return store.state; }, get units() { return units; },
    on: store.on, emit, store,
    toast: (t, s, k) => Nar.toast(t, s, k),
    notify(r, k, t, s) { st.notifs[r] = [{ id: nid++, k, t, s, time: hm(), unread: true }].concat(st.notifs[r]).slice(0, 30); },
    readAll(r) { st.notifs[r].forEach((n) => (n.unread = false)); emit(['notifs']); },
    setTheme(t) { st.theme = t; emit(['theme']); },
    toggleTheme() { S.setTheme(st.theme === 'dark' ? 'light' : 'dark'); },
    reset() { store.reset(); st = store.state; applyPaid(); },

    pay() {
      const k = ME.b + '-' + ME.n; if (!st.paidUnits.includes(k)) st.paidUnits.push(k); applyPaid(); st.paid = true;
      st.payments = [{ time: hm(), inv: 'INV-2026-1024', unit: '5-р байр 34', name: 'Бат', ch: 'QPay', amt: ME.bill }].concat(st.payments).slice(0, 20);
      S.notify('resident', 'ok', 'Төлбөр амжилттай', '₮97,000 · eBarimt имэйлээр очлоо'); S.notify('admin', 'ok', 'Төлбөр орлоо', '5-р байр 34 тоот · ₮97,000');
      emit(['pay', 'notifs', 'payments']);
    },
    remind(b, n) { st.reminded[b + '-' + n] = true; emit(['remind']); S.toast('Сануулга илгээгдлээ', b + '-р байр ' + n + ' · SMS + push'); },
    remindAll() { let c = 0; units.flat().forEach((u) => { if (u.st !== 0) { st.reminded[u.b + '-' + u.n] = true; c++; } }); emit(['remind']); S.toast('Сануулга илгээгдлээ', c + ' айлд SMS + push явлаа'); },

    newRequest({ title, cat, p, desc }) {
      const id = 'REQ-' + (1052 + st.reqs.length); const t = Date.now();
      st.reqs.unshift({ id, title, cat, p, b: ME.b, u: ME.n, st: 0, createdAt: t, stAt: t, desc, photos: 0, from: 'resident' });
      S.notify('admin', 'acc', 'Шинэ хүсэлт · ' + cat, id + ' · ' + title); S.notify('staff', 'acc', 'Шинэ хүсэлт ирлээ · ' + cat, id + ' · 5-р байр 34 тоот');
      emit(['reqs', 'notifs']); return id;
    },
    takeRequest(id, by) {
      const q = st.reqs.find((x) => x.id === id); if (!q) return; Object.assign(q, { st: 1, by, stAt: Date.now() });
      if (q.b === ME.b && q.u === ME.n) S.notify('resident', 'acc', 'Хүсэлтийг хүлээн авлаа', id + ' · ' + by);
      emit(['reqs', 'notifs']);
    },
    setReqStatus(id, s, by) {
      const q = st.reqs.find((x) => x.id === id); if (!q) return; Object.assign(q, { st: s, by: by || q.by, stAt: Date.now() });
      if (q.b === ME.b && q.u === ME.n) S.notify('resident', s === 4 ? 'ok' : 'acc', s === 4 ? 'Таны хүсэлт шийдэгдлээ' : s === 2 ? 'Засвар эхэллээ' : 'Хүсэлтийн төлөв өөрчлөгдлөө', id + ' · ' + (q.by || ''));
      emit(['reqs', 'notifs']);
    },
    addPhoto(id) { const q = st.reqs.find((x) => x.id === id); if (q) { q.photos++; emit(['reqs']); } },

    newLeak(b, u, room) {
      if (st.leaks.some((x) => x.st === 'active')) return;
      const id = 'LK-0' + (431 + st.leaks.length);
      st.leaks.unshift({ id, b, u, room, st: 'active', t0: st.sec, times: [hm(), hm(), '', '', ''] });
      S.notify('admin', 'bad', 'Ус алдаж байна · ' + b + '-р байр ' + u + ' тоот', room + ' · чип илрүүлэв');
      if (b === ME.b && u === ME.n) S.notify('resident', 'bad', 'Танай ' + room.toLowerCase() + 'нд ус алдаж байна!', 'Хавхлага автоматаар хаагдана');
      emit(['leaks', 'notifs']); S.toast('Ус алдаж байна!', b + '-р байр · ' + u + ' тоот · ' + room, 'bad');
    },
    closeLeak(id, auto) {
      const x = st.leaks.find((y) => y.id === id); if (!x || x.st !== 'active') return;
      Object.assign(x, { st: 'closed', t0: st.sec }); x.times[2] = hm(); emit(['leaks']);
      if (!auto) S.toast('Хавхлага хаагдлаа', 'Ус зогслоо · сантехникч дуудагдсан');
    },
    breakLight(id) { st.lights.find((l) => l.id === id).st = 'off'; emit(['lights']); },
    fixLight(id) {
      st.lights.find((l) => l.id === id).st = 'fixing'; emit(['lights']); S.toast('Засварын хүсэлт үүслээ', id + ' · Н. Тунгалаг-д оноогдлоо');
      setTimeout(() => { const l = st.lights.find((x) => x.id === id); if (l) l.st = 'on'; S.notify('admin', 'ok', 'Гэрэл засагдлаа · ' + id, 'Н. Тунгалаг'); emit(['lights', 'notifs']); }, 9000);
    },

    reserveSlot(id) {
      const s = st.slots.find((x) => x.id === id); if (!s || s.st !== 0) return;
      Object.assign(s, { st: 3, mine: true, plate: ME.plate, unit: '5-34' }); st.park = { stage: 'reserved', slot: id, hold: 600, pos: 0 };
      emit(['slots', 'park']); S.toast(id + ' захиалагдлаа', '10 минутын дотор очиж зогсоно уу', 'acc');
    },
    parkNotify() { st.park = { stage: 'waiting', slot: '', hold: 0, pos: 2 }; emit(['park']); S.toast('Дараалалд бүртгэгдлээ', 'Сул зогсоол гармагц мэдэгдэнэ', 'acc'); },
    parkCancel() { const p = st.park; const s = st.slots.find((x) => x.id === p.slot && x.mine); if (s) Object.assign(s, { st: 0, mine: false, plate: '' }); st.park = { stage: 'idle', slot: '', hold: 0, pos: 0 }; emit(['slots', 'park']); },
    parkArrive() { const p = st.park; if (p.stage !== 'reserved') return; const s = st.slots.find((x) => x.id === p.slot); Object.assign(s, { st: 1, mine: true, color: '#0A72B8' }); p.stage = 'parked'; S.notify('resident', 'ok', 'Мэдрэгч машиныг бүртгэлээ', p.slot + ' · ' + ME.plate); emit(['slots', 'park', 'notifs']); },
    parkLeave() { const p = st.park; const s = st.slots.find((x) => x.id === p.slot); if (s) Object.assign(s, { st: 0, mine: false, plate: '' }); st.park = { stage: 'idle', slot: '', hold: 0, pos: 0 }; emit(['slots', 'park']); },

    setInvoice(p) { Object.assign(st.invoice, p); emit(['invoice']); },
    runInvoices() { S.notify('resident', 'acc', 'Шинэ нэхэмжлэл', '11-р сар · ₮97,000'); emit(['notifs']); S.toast('Нэхэмжлэл илгээгдлээ', '1,248 айлд апп + SMS-ээр очлоо'); },

    tick() {
      const sec = ++st.sec; const T = ['tick'];
      if (!st.paid) { st.wilt = Math.min(1, st.wilt + 0.006); T.push('wilt'); }
      if (sec % 9 === 0) { const i = sec % D.PAY_NAMES.length; st.payments = [{ time: hm(), inv: 'INV-2026-' + (2400 + sec), unit: ((sec % 6) + 1) + '-р байр ' + (10 + (sec * 7) % 190), name: D.PAY_NAMES[i], ch: D.CHANNELS[sec % 5], amt: 65000 + (sec % 4) * 10000 }].concat(st.payments).slice(0, 20); T.push('payments'); }
      if ((sec === 12 || sec === 45 || sec === 90) && st.incoming.length) {
        const q = st.incoming.shift(); const t = Date.now(); st.reqs.unshift({ ...q, createdAt: t, stAt: t });
        S.notify('staff', 'acc', 'Шинэ хүсэлт ирлээ · ' + q.cat, q.id + ' · ' + q.title + ' · ангиллын бүх ажилтанд зэрэг очлоо'); S.notify('admin', 'acc', 'Шинэ хүсэлт · ' + q.cat, q.id + ' · ' + q.title); T.push('reqs', 'notifs');
      }
      st.reqs.forEach((q) => {
        if (q.from !== 'resident' || q.b !== ME.b || q.u !== ME.n || q.id === 'REQ-1042') return;
        const age = (Date.now() - q.stAt) / 1000; const w = WORKER[q.cat] || 'Б. Ганзориг';
        if (q.st === 0 && age > 8) S.takeRequest(q.id, w); else if (q.st === 1 && age > 8) S.setReqStatus(q.id, 2, w); else if (q.st === 2 && age > 25) { q.photos++; S.setReqStatus(q.id, 4, w); }
      });
      st.leaks.forEach((x) => {
        const age = sec - x.t0;
        if (x.st === 'active' && age >= 5) S.closeLeak(x.id, true);
        else if (x.st === 'closed' && age >= 8) { Object.assign(x, { st: 'fixing', t0: sec, by: 'С. Мөнхзул' }); x.times[3] = hm(); T.push('leaks'); }
        else if (x.st === 'fixing' && age >= 30) { x.st = 'fixed'; x.times[4] = hm(); S.notify('admin', 'ok', 'Ус алдалт засагдлаа', x.b + '-р байр ' + x.u); T.push('leaks', 'notifs'); }
      });
      if (sec === 25 || (sec > 25 && sec % 90 === 0)) S.newLeak(1 + (sec % 6), 13 * (2 + (sec % 12)) + 4, ROOMS[sec % 3]);
      const p = st.park;
      if (p.stage === 'reserved') { if (p.hold <= 1) S.parkCancel(); else { p.hold--; T.push('park'); } }
      if (p.stage === 'waiting' && sec % 15 === 0) {
        const f = st.slots.find((x) => x.zone === 'p' && x.st === 1 && !x.mine);
        if (f) { Object.assign(f, { st: 0, plate: '' }); st.park = { stage: 'found', slot: f.id, hold: 60, pos: 1 }; S.notify('resident', 'ok', f.id + ' сул боллоо!', 'Дараалалд 1-рт байсан тул танд санал болгож байна'); T.push('park', 'slots', 'notifs'); }
      }
      if (sec % 4 === 0) { // demo: гадна зогсоол, гаражид ээлжлэн машин орж ирнэ / гарч явна
        const zone = sec % 8 === 0 ? 'p' : 'g';
        const outs = st.slots.filter((x) => x.zone === zone && !x.mine && x.st !== 3 && x.sens !== 'off'); const c = outs[(sec * 7) % outs.length];
        if (c.st === 0) Object.assign(c, { st: sec % 3 === 0 ? 2 : 1, plate: (1000 + (sec * 37) % 8999) + ' УБ' + 'АБВГДЕ'[sec % 6], color: D.CAR_COLORS[sec % D.CAR_COLORS.length] });
        else Object.assign(c, { st: 0, plate: '' });
        T.push('slots');
      }
      emit(T);
    },
  };
  window.S = S;

  // олон таб нээлттэй үед "шууд" симуляцыг зөвхөн нэг таб ажиллуулна
  Nar.leader(LEAD, () => S.tick(), 1000);
})();
