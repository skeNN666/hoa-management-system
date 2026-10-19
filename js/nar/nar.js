/* ==========================================================================
   Nar.js — СӨХ Platform-д зориулж бичсэн жижиг UI framework (гадны сангүй).
   ---------------------------------------------------------------------------
   • html``      — tagged template; утгыг автоматаар escape хийнэ (XSS-ээс хамгаална)
   • createStore — төлөв + topic-той subscribe + localStorage + олон таб хооронд sync
   • leader      — олон таб нээлттэй үед зөвхөн нэг нь симуляц ажиллуулна
   • morph       — шинэ HTML-ийг хуучин DOM-той харьцуулж зөвхөн өөрчлөгдсөнийг солино
                   (focus, scroll, animation, 3D canvas алдагдахгүй)
   • app         — region-ууд, hash router, data-act / data-in event delegation
   • keep        — 3D canvas зэрэг байнгын элементийг дахин зурахад хадгална
   • modal, toast
   ========================================================================== */
(function () {
  const Nar = (window.Nar = window.Nar || {});

  /* ---------- templating ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const raw = (s) => new Raw(String(s == null ? '' : s));
  const val = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
  /** html`<b>${name}</b>` → Raw. Массив автоматаар нийлнэ, false/null хоосон болно. */
  function html(strings, ...vals) { let out = strings[0]; for (let i = 0; i < vals.length; i++) out += val(vals[i]) + strings[i + 1]; return new Raw(out); }
  /** cx('btn', on && 'on') → "btn on" */
  const cx = (...a) => a.filter(Boolean).join(' ');
  Object.assign(Nar, { esc, raw, html, cx, Raw });

  /* ---------- store ---------- */
  function createStore({ key, version = 1, init, keep = [] }) {
    let state = null;
    try { state = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
    if (!state || state.__v !== version) { // шинэ хувилбар: өгөгдлийг шинэчилнэ, харин keep[] (жишээ нь theme)-ийг хадгална
      const old = state || {}; state = Object.assign(init(), { __v: version });
      keep.forEach((k) => { if (old[k] != null) state[k] = old[k]; });
    }
    const subs = []; let saveT = 0;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} }, 120); };
    const st = {
      get state() { return state; },
      on(fn) { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); },
      /** emit(['reqs','notifs']) — бүх subscriber-д мэдэгдэж, хадгална */
      emit(topics, persist = true) { if (persist) save(); subs.forEach((f) => f(topics)); },
      reset() { const old = state; state = Object.assign(init(), { __v: version }); keep.forEach((k) => { if (old[k] != null) state[k] = old[k]; }); st.emit(['all']); },
      onExternal: null,
    };
    // өөр таб өөрчилбөл энд шууд тусна
    window.addEventListener('storage', (e) => {
      if (e.key !== key || !e.newValue) return;
      try { const n = JSON.parse(e.newValue); if (st.onExternal) st.onExternal(n, state); state = n; subs.forEach((f) => f(['all'])); } catch (err) {}
    });
    return st;
  }

  /** leader('sokh-leader', tick, 1000) — зөвхөн нэг таб tick ажиллуулна; тэр таб хаагдвал өөр нь авна */
  function leader(lockKey, fn, ms = 1000) {
    const id = Math.random().toString(36).slice(2);
    setInterval(() => {
      let L = null; try { L = JSON.parse(localStorage.getItem(lockKey) || 'null'); } catch (e) {}
      const now = Date.now();
      if (!L || L.id === id || now - L.t > ms * 2.5) { try { localStorage.setItem(lockKey, JSON.stringify({ id, t: now })); } catch (e) {} fn(); }
    }, ms);
  }
  Object.assign(Nar, { createStore, leader });

  /* ---------- DOM morph (жижиг diff алгоритм) ---------- */
  const tpl = document.createElement('template');
  function parse(h) { tpl.innerHTML = String(h).trim(); return tpl.content; }
  function syncAttrs(a, b) {
    for (let i = a.attributes.length - 1; i >= 0; i--) { const n = a.attributes[i].name; if (!b.hasAttribute(n)) a.removeAttribute(n); }
    for (let i = 0; i < b.attributes.length; i++) { const { name, value } = b.attributes[i]; if (a.getAttribute(name) !== value) a.setAttribute(name, value); }
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') {
      if (document.activeElement !== a && b.hasAttribute('value') && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value');
      if (a.type === 'checkbox') a.checked = b.hasAttribute('checked');
    }
  }
  const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);
  function morphNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || keyOf(a) !== keyOf(b)) { a.replaceWith(b); return b; }
    if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return a; }
    syncAttrs(a, b);
    if (a.hasAttribute('data-keep')) return a; // keep-alive: дотор нь хүрэхгүй
    morphChildren(a, b);
    return a;
  }
  function morphChildren(a, b) {
    const nb = Array.from(b.childNodes);
    const keyed = new Map(); Array.from(a.childNodes).forEach((n) => { const k = keyOf(n); if (k) keyed.set(k, n); });
    let cur = a.firstChild;
    nb.forEach((n) => {
      const k = keyOf(n);
      if (k && keyed.has(k)) { const old = keyed.get(k); keyed.delete(k); if (old !== cur) a.insertBefore(old, cur); cur = morphNode(old, n).nextSibling; return; }
      if (cur && !keyOf(cur) && !k) { cur = morphNode(cur, n).nextSibling; return; }
      a.insertBefore(n, cur);
    });
    while (cur) { const nx = cur.nextSibling; cur.remove(); cur = nx; }
    keyed.forEach((n) => n.parentNode === a && n.remove());
  }
  /** morph(el, html) — el-ийн агуулгыг шинэ HTML болгоно, өөрчлөгдсөн хэсгийг л солино */
  function morph(el, h) { const frag = parse(h); const wrap = document.createElement(el.tagName); wrap.appendChild(frag); morphChildren(el, wrap); attachKeeps(el); }
  Nar.morph = morph;

  /* ---------- keep-alive hosts ---------- */
  const hosts = {};
  /** Nar.host('map3d') — байнгын элемент (3D canvas гэх мэт) */
  function host(k) { if (!hosts[k]) { hosts[k] = document.createElement('div'); hosts[k].className = 'keep-host'; } return hosts[k]; }
  /** Nar.keep('map3d','cls') → placeholder; morph-ийн дараа host-ыг автоматаар дотор нь хийнэ */
  const keep = (k, cls = '') => raw('<div data-keep="' + esc(k) + '" class="' + esc(cls) + '"></div>');
  function attachKeeps(root) { root.querySelectorAll('[data-keep]').forEach((ph) => { const h = host(ph.getAttribute('data-keep')); Array.from(ph.children).forEach((c) => { if (c !== h && c.classList.contains('keep-host')) c.remove(); }); if (h.parentNode !== ph) ph.appendChild(h); }); } // өмнөх host-ыг салгана (жишээ нь зогсоолын бүс солиход)
  Object.assign(Nar, { host, keep });

  /* ---------- router ---------- */
  const router = {
    get path() { return (location.hash || '').replace(/^#\/?/, '').split('?')[0]; },
    get query() { const q = (location.hash.split('?')[1] || ''); return Object.fromEntries(new URLSearchParams(q)); },
    go(p) { location.hash = '#/' + p; },
  };
  Nar.router = router;

  /* ---------- app ---------- */
  /**
   * Nar.app({ store, regions: [{ el, render, topics }], actions, inputs })
   * region.topics: аль topic ирэхэд дахин зурахыг заана (байхгүй бол бүгд дээр).
   */
  function app(o) {
    const regions = o.regions.map((r) => Object.assign({}, r, { node: typeof r.el === 'string' ? document.querySelector(r.el) : r.el }));
    let raf = 0; let pend = new Set();
    function render(T) {
      regions.forEach((r) => {
        const t = typeof r.topics === 'function' ? r.topics() : r.topics;
        if (T && t && !T.has('all') && !T.has('route') && !t.some((x) => T.has(x))) return;
        morph(r.node, r.render());
        if (r.after) r.after(r.node, T);
      });
      if (o.after) o.after(T);
    }
    function schedule(topics) { (topics || ['all']).forEach((t) => pend.add(t)); if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const T = pend; pend = new Set(); if (o.before) o.before(T); render(T); }); }
    const A = o.actions || {};
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
      const f = A[el.dataset.act]; if (!f) return;
      if (el.tagName === 'A' && !el.dataset.follow) e.preventDefault();
      f(el.dataset.arg, el, e);
    });
    document.addEventListener('input', (e) => { const el = e.target.closest('[data-in]'); if (el && o.inputs && o.inputs[el.dataset.in]) o.inputs[el.dataset.in](el.value, el, e); });
    document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && o.inputs && o.inputs[el.dataset.change]) o.inputs[el.dataset.change](el.value, el, e); });
    document.addEventListener('submit', (e) => { const el = e.target.closest('[data-submit]'); if (el && A[el.dataset.submit]) { e.preventDefault(); A[el.dataset.submit](new FormData(el), el, e); } });
    window.addEventListener('hashchange', () => { if (o.onRoute) o.onRoute(router.path); schedule(['route']); });
    if (o.store) o.store.on(schedule);
    if (o.onRoute) o.onRoute(router.path);
    render(null);
    return { refresh: schedule };
  }
  Nar.app = app;

  /* ---------- modal / sheet ---------- */
  let modalRoot = null;
  const modal = {
    fn: null, opt: {},
    open(fn, opt = {}) { modal.fn = fn; modal.opt = opt; modal.refresh(true); },
    close(force) { if (!modal.fn) return; if (!force && modal.opt.lock && modal.opt.lock()) return; modal.fn = null; modalRoot.innerHTML = ''; document.body.classList.remove('modal-open'); if (modal.opt.onClose) modal.opt.onClose(); },
    refresh(first) {
      if (!modal.fn) return; if (!modalRoot) { modalRoot = document.createElement('div'); document.body.appendChild(modalRoot); }
      const o = modal.opt;
      const h = '<div class="modal ' + (o.side ? 'sheet-r' : '') + '"><button class="modal-bg" data-act="__close" aria-label="Хаах"></button><div role="dialog" aria-modal="true" class="modal-box scroll ' + (o.cls || '') + '">' + modal.fn() + '</div></div>';
      if (first || !modalRoot.firstChild) { modalRoot.innerHTML = h; document.body.classList.add('modal-open'); } else morph(modalRoot, h);
    },
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-act="__close"]')) { e.preventDefault(); modal.close(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.close(); });
  Nar.modal = modal;

  /* ---------- toast ---------- */
  let toastRoot = null, toastT = 0;
  Nar.toast = function (t, s = '', k = 'ok') {
    if (!toastRoot) { toastRoot = document.createElement('div'); toastRoot.className = 'toast-root'; document.body.appendChild(toastRoot); }
    const icn = { ok: 'ok', bad: 'droplet', acc: 'info', warn: 'alert' }[k] || 'ok';
    toastRoot.innerHTML = '<div role="status" class="toast card"><span class="toast-ic t-' + k + '">' + Nar.icon(icn, 18) + '</span><div class="grow"><b class="t13 block">' + esc(t) + '</b><span class="muted t12">' + esc(s) + '</span></div></div>';
    clearTimeout(toastT); toastT = setTimeout(() => (toastRoot.innerHTML = ''), 3400);
  };
})();
