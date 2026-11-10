/* ==========================================================================
   Nar.js — СӨХ Platform-д зориулж бичсэн жижиг UI framework (гадны сангүй).
   ---------------------------------------------------------------------------
   • html``      — tagged template; утгыг автоматаар escape хийнэ (XSS-ээс хамгаална)
   • createStore — төлөв + topic-той subscribe + localStorage + олон таб хооронд sync
   • leader      — олон таб нээлттэй үед зөвхөн нэг нь симуляц ажиллуулна
   • morph       — шинэ HTML-ийг хуучин DOM-той харьцуулж зөвхөн өөрчлөгдсөнийг солино
                   (focus, scroll, animation, 3D canvas алдагдахгүй)
   • define      — Web Component (Custom Element) тодорхойлох: Light DOM эсвэл Shadow DOM
   • app         — region-ууд, hash router, data-act / data-in event delegation
   • modal, toast — <nar-modal>, <nar-toast> component
   ========================================================================== */
(function () {
  const Nar = (window.Nar = window.Nar || {});

  /* ---------- templating ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  class Raw {
    constructor(s) {
      this.s = s;
    }
    toString() {
      return this.s;
    }
  }
  const raw = (s) => new Raw(String(s == null ? '' : s));
  const val = (v) =>
    v == null || v === false
      ? ''
      : v instanceof Raw
        ? v.s
        : Array.isArray(v)
          ? v.map(val).join('')
          : esc(v);
  /** html`<b>${name}</b>` → Raw. Массив автоматаар нийлнэ, false/null хоосон болно. */
  function html(strings, ...vals) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += val(vals[i]) + strings[i + 1];
    return new Raw(out);
  }
  /** cx('btn', on && 'on') → "btn on" */
  const cx = (...a) => a.filter(Boolean).join(' ');
  /** Component-д объект дамжуулах: data="${Nar.json(list)}" (html`` escape хийнэ) */
  const json = (v) => JSON.stringify(v == null ? null : v);
  /** Boolean attribute: <sokh-flower ${Nar.flag('paid', s.paid)}> */
  const flag = (name, on) => raw(on ? name : '');
  Object.assign(Nar, { esc, raw, html, cx, Raw, json, flag });

  /* ---------- store ---------- */
  function createStore({ key, version = 1, init, keep = [] }) {
    let state = null;
    try {
      state = JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {}
    if (!state || state.__v !== version) {
      // шинэ хувилбар: өгөгдлийг шинэчилнэ, харин keep[] (жишээ нь theme)-ийг хадгална
      const old = state || {};
      state = Object.assign(init(), { __v: version });
      keep.forEach((k) => {
        if (old[k] != null) state[k] = old[k];
      });
    }
    const subs = [];
    let saveT = 0;
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {}
      }, 120);
    };
    const st = {
      get state() {
        return state;
      },
      on(fn) {
        subs.push(fn);
        return () => subs.splice(subs.indexOf(fn), 1);
      },
      /** emit(['reqs','notifs']) — бүх subscriber-д мэдэгдэж, хадгална */
      emit(topics, persist = true) {
        if (persist) save();
        subs.forEach((f) => f(topics));
      },
      reset() {
        const old = state;
        state = Object.assign(init(), { __v: version });
        keep.forEach((k) => {
          if (old[k] != null) state[k] = old[k];
        });
        st.emit(['all']);
      },
      onExternal: null,
    };
    // өөр таб өөрчилбөл энд шууд тусна
    window.addEventListener('storage', (e) => {
      if (e.key !== key || !e.newValue) return;
      try {
        const n = JSON.parse(e.newValue);
        if (st.onExternal) st.onExternal(n, state);
        state = n;
        subs.forEach((f) => f(['all']));
      } catch (err) {}
    });
    return st;
  }

  /** leader('sokh-leader', tick, 1000) — зөвхөн нэг таб tick ажиллуулна; тэр таб хаагдвал өөр нь авна */
  function leader(lockKey, fn, ms = 1000) {
    const id = Math.random().toString(36).slice(2);
    setInterval(() => {
      let L = null;
      try {
        L = JSON.parse(localStorage.getItem(lockKey) || 'null');
      } catch (e) {}
      const now = Date.now();
      if (!L || L.id === id || now - L.t > ms * 2.5) {
        try {
          localStorage.setItem(lockKey, JSON.stringify({ id, t: now }));
        } catch (e) {}
        fn();
      }
    }, ms);
  }
  Object.assign(Nar, { createStore, leader });

  /* ---------- DOM morph (жижиг diff алгоритм) ---------- */
  const tpl = document.createElement('template');
  function parse(h) {
    tpl.innerHTML = String(h).trim();
    return tpl.content;
  }
  function syncAttrs(a, b) {
    for (let i = a.attributes.length - 1; i >= 0; i--) {
      const n = a.attributes[i].name;
      if (!b.hasAttribute(n)) a.removeAttribute(n);
    }
    for (let i = 0; i < b.attributes.length; i++) {
      const { name, value } = b.attributes[i];
      if (a.getAttribute(name) !== value) a.setAttribute(name, value);
    }
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') {
      if (
        document.activeElement !== a &&
        b.hasAttribute('value') &&
        a.value !== b.getAttribute('value')
      )
        a.value = b.getAttribute('value');
      if (a.type === 'checkbox') a.checked = b.hasAttribute('checked');
    }
  }
  const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);
  function morphNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || keyOf(a) !== keyOf(b)) {
      a.replaceWith(b);
      return b;
    }
    if (a.nodeType === 3 || a.nodeType === 8) {
      if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
      return a;
    }
    syncAttrs(a, b);
    if (a.hasAttribute('data-keep')) return a; // keep-alive: дотор нь хүрэхгүй
    // Web component: дотор талыг component өөрөө зурдаг → зөвхөн attribute-ийг шинэчилнэ,
    // өөрчлөгдвөл attributeChangedCallback дахин зурна.
    if (a.localName.includes('-')) return a;
    morphChildren(a, b);
    return a;
  }
  function morphChildren(a, b) {
    const nb = Array.from(b.childNodes);
    const keyed = new Map();
    Array.from(a.childNodes).forEach((n) => {
      const k = keyOf(n);
      if (k) keyed.set(k, n);
    });
    let cur = a.firstChild;
    nb.forEach((n) => {
      const k = keyOf(n);
      if (k && keyed.has(k)) {
        const old = keyed.get(k);
        keyed.delete(k);
        if (old !== cur) a.insertBefore(old, cur);
        cur = morphNode(old, n).nextSibling;
        return;
      }
      if (cur && !keyOf(cur) && !k) {
        cur = morphNode(cur, n).nextSibling;
        return;
      }
      a.insertBefore(n, cur);
    });
    while (cur) {
      const nx = cur.nextSibling;
      cur.remove();
      cur = nx;
    }
    keyed.forEach((n) => n.parentNode === a && n.remove());
  }
  /** morph(el, html) — el (element эсвэл ShadowRoot)-ийн агуулгыг шинэ HTML болгоно */
  function morph(el, h) {
    const frag = parse(h);
    const wrap = document.createElement(el.tagName || 'div');
    wrap.appendChild(frag);
    morphChildren(el, wrap);
  }
  Nar.morph = morph;

  /* ---------- Web Components ---------- */
  /**
   * Nar.define('sokh-flower', {
   *   attrs:  ['wilt', 'paid'],          // ажиглах attribute (өөрчлөгдвөл дахин зурна)
   *   shadow: true,                      // Shadow DOM (style тусгаарлагдана) · false = Light DOM
   *   styles: ['css/components/flower.css'],  // Shadow DOM-д ачаалах CSS файл
   *   css:    ':host{display:block}',    // Shadow DOM-ийн нэмэлт inline CSS
   *   render(el) { return html`...` },   // el.str/num/bool/data-аар attribute уншина
   *   connected(el), disconnected(el), updated(el), changed(el, name, old, new), methods: { ... }
   * })
   * Хуудсанд: html`<sokh-flower wilt="0.4" paid></sokh-flower>` — morph нь зөвхөн attribute-ийг
   * солих тул component дотоод DOM, анимаци, focus-оо хадгална.
   */
  const sheets = {};
  function define(tag, def) {
    if (customElements.get(tag)) return customElements.get(tag);
    const attrs = def.attrs || [];
    class NarElement extends HTMLElement {
      static get observedAttributes() {
        return attrs;
      }
      connectedCallback() {
        if (!this._nar) {
          this._nar = true;
          if (def.shadow) {
            const sr = this.attachShadow({ mode: 'open' });
            // CSS файлыг <link>-ээр ачаална (file:// дээр ч ажиллана); ачаалагдтал нууна
            const links = (def.styles || []).map((href) => {
              const l = document.createElement('link');
              l.rel = 'stylesheet';
              l.href = href;
              return l;
            });
            const st = document.createElement('style');
            st.textContent =
              ':host{display:block}[hidden]{display:none!important}' + (def.css || '');
            sr.append(st, ...links);
            this._root = document.createElement('div');
            this._root.className = 'root';
            if (links.length && !links.every((l) => sheets[l.href])) {
              this._root.style.visibility = 'hidden';
              let n = links.length;
              const done = (l) => {
                sheets[l.href] = 1;
                if (--n <= 0) this._root.style.visibility = '';
              };
              links.forEach((l) => {
                l.onload = l.onerror = () => done(l);
              });
            }
            sr.append(this._root);
          } else this._root = this;
          if (def.init) def.init(this);
        }
        this._paint();
        if (def.connected) def.connected(this);
      }
      disconnectedCallback() {
        if (def.disconnected) def.disconnected(this);
      }
      attributeChangedCallback(n, a, b) {
        if (!this._nar || a === b) return;
        if (def.changed) def.changed(this, n, a, b);
        this.refresh();
      }
      /** дахин зурах (нэг microtask-д нэг удаа) */
      refresh() {
        if (this._q) return;
        this._q = true;
        queueMicrotask(() => {
          this._q = false;
          if (this.isConnected) this._paint();
        });
      }
      _paint() {
        if (!def.render) return;
        morph(this._root, def.render(this));
        if (def.updated) def.updated(this);
      }
      /** дотоод DOM (Light DOM бол element өөрөө, Shadow бол .root div) */
      get root() {
        return this._root;
      }
      str(n, d = '') {
        const v = this.getAttribute(n);
        return v == null ? d : v;
      }
      num(n, d = 0) {
        const v = parseFloat(this.getAttribute(n));
        return isNaN(v) ? d : v;
      }
      bool(n) {
        const v = this.getAttribute(n);
        return v != null && v !== 'false' && v !== '0';
      }
      data(n = 'data', d = null) {
        const v = this.getAttribute(n);
        if (v == null || v === '') return d;
        try {
          return JSON.parse(v);
        } catch (e) {
          return d;
        }
      }
    }
    if (def.methods) Object.assign(NarElement.prototype, def.methods);
    customElements.define(tag, NarElement);
    return NarElement;
  }
  Nar.define = define;

  /** event-ийн замаас (Shadow DOM-ийг нэвтэрч) attribute-тэй хамгийн ойрын element */
  function closest(e, attr) {
    const path = e.composedPath ? e.composedPath() : [];
    for (const n of path) {
      if (n === document) break;
      if (n.nodeType === 1 && n.hasAttribute(attr)) return n;
    }
    return e.target.closest ? e.target.closest('[' + attr + ']') : null;
  }
  Nar.closest = closest;

  /* ---------- router ---------- */
  const router = {
    get path() {
      return (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    },
    get query() {
      const q = location.hash.split('?')[1] || '';
      return Object.fromEntries(new URLSearchParams(q));
    },
    go(p) {
      location.hash = '#/' + p;
    },
  };
  Nar.router = router;

  /* ---------- app ---------- */
  /**
   * Nar.app({ store, regions: [{ el, render, topics }], actions, inputs })
   * region.topics: аль topic ирэхэд дахин зурахыг заана (байхгүй бол бүгд дээр).
   */
  function app(o) {
    const regions = o.regions.map((r) =>
      Object.assign({}, r, {
        node: typeof r.el === 'string' ? document.querySelector(r.el) : r.el,
      }),
    );
    let raf = 0;
    let pend = new Set();
    function render(T) {
      regions.forEach((r) => {
        const t = typeof r.topics === 'function' ? r.topics() : r.topics;
        if (T && t && !T.has('all') && !T.has('route') && !t.some((x) => T.has(x))) return;
        morph(r.node, r.render());
        if (r.after) r.after(r.node, T);
      });
      if (o.after) o.after(T);
    }
    function schedule(topics) {
      (topics || ['all']).forEach((t) => pend.add(t));
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const T = pend;
        pend = new Set();
        if (o.before) o.before(T);
        render(T);
      });
    }
    const A = o.actions || {};
    document.addEventListener('click', (e) => {
      const el = closest(e, 'data-act');
      if (!el || el.disabled) return;
      const f = A[el.dataset.act];
      if (!f) return;
      if (el.tagName === 'A' && !el.dataset.follow) e.preventDefault();
      f(el.dataset.arg, el, e);
    });
    document.addEventListener('input', (e) => {
      const el = closest(e, 'data-in');
      if (el && o.inputs && o.inputs[el.dataset.in]) o.inputs[el.dataset.in](el.value, el, e);
    });
    document.addEventListener('change', (e) => {
      const el = closest(e, 'data-change');
      if (el && o.inputs && o.inputs[el.dataset.change])
        o.inputs[el.dataset.change](el.value, el, e);
    });
    document.addEventListener('submit', (e) => {
      const el = closest(e, 'data-submit');
      if (el && A[el.dataset.submit]) {
        e.preventDefault();
        A[el.dataset.submit](new FormData(el), el, e);
      }
    });
    window.addEventListener('hashchange', () => {
      if (o.onRoute) o.onRoute(router.path);
      schedule(['route']);
    });
    if (o.store) o.store.on(schedule);
    if (o.onRoute) o.onRoute(router.path);
    render(null);
    return { refresh: schedule };
  }
  Nar.app = app;

  /* ---------- <nar-modal> / sheet ---------- */
  // <nar-modal> нь body-д нэг л байна; агуулгыг Nar.modal.open(fn)-ийн fn зурна.
  define('nar-modal', {});
  let modalRoot = null;
  const modal = {
    fn: null,
    opt: {},
    open(fn, opt = {}) {
      modal.fn = fn;
      modal.opt = opt;
      modal.refresh(true);
    },
    close(force) {
      if (!modal.fn) return;
      if (!force && modal.opt.lock && modal.opt.lock()) return;
      modal.fn = null;
      modalRoot.innerHTML = '';
      document.body.classList.remove('modal-open');
      if (modal.opt.onClose) modal.opt.onClose();
    },
    refresh(first) {
      if (!modal.fn) return;
      if (!modalRoot) {
        modalRoot = document.querySelector('nar-modal') || document.createElement('nar-modal');
        if (!modalRoot.isConnected) document.body.appendChild(modalRoot);
      }
      const o = modal.opt;
      const h = html`<div class="${cx('modal', o.side && 'sheet-r')}">
        <button class="modal-bg" data-act="__close" aria-label="Хаах"></button>
        <div role="dialog" aria-modal="true" class="${cx('modal-box scroll', o.cls)}">
          ${raw(modal.fn())}
        </div>
      </div>`;
      if (first || !modalRoot.firstChild) {
        modalRoot.innerHTML = String(h);
        document.body.classList.add('modal-open');
      } else morph(modalRoot, h);
    },
  };
  document.addEventListener('click', (e) => {
    if (closest(e, 'data-act') && closest(e, 'data-act').dataset.act === '__close') {
      e.preventDefault();
      modal.close();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.close();
  });
  Nar.modal = modal;

  /* ---------- <nar-toast> ---------- */
  /** <nar-toast kind="ok|bad|acc|warn" heading="..." sub="..."> — 3.4 сек харагдаад алга болно */
  const TOAST_IC = { ok: 'ok', bad: 'droplet', acc: 'info', warn: 'alert' };
  define('nar-toast', {
    attrs: ['kind', 'heading', 'sub', 'stamp'],
    render(el) {
      if (!el.str('heading')) return '';
      const k = el.str('kind', 'ok');
      return html`<div role="status" class="toast card">
        <span class="${'toast-ic t-' + k}">${raw(Nar.icon(TOAST_IC[k] || 'ok', 18))}</span>
        <div class="grow">
          <b class="t13 block">${el.str('heading')}</b
          ><span class="muted t12">${el.str('sub')}</span>
        </div>
      </div>`;
    },
    updated(el) {
      clearTimeout(el._t);
      if (el.str('heading')) el._t = setTimeout(() => el.removeAttribute('heading'), 3400);
    },
  });
  Nar.toast = function (t, s = '', k = 'ok') {
    let el = document.querySelector('nar-toast');
    if (!el) {
      el = document.createElement('nar-toast');
      el.className = 'toast-root';
      document.body.appendChild(el);
    }
    el.setAttribute('kind', k);
    el.setAttribute('sub', s);
    el.setAttribute('heading', t);
    el.setAttribute('stamp', Date.now()); // ижил мэдэгдэл дахин ирвэл хугацааг шинэчилнэ
  };
})();
