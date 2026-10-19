/*
 * СӨХ Platform — app shell (Nar.js дээр):
 *  ≥1024px: зүүн талын цэс (light/dark-д дагана, доор нь горим + гарах товч)
 *  <1024px: дээд мөр + гулсдаг цэс (удирдлага) эсвэл доод tab цэс (ажилтан, оршин суугч)
 *
 * Shell.boot({ role, brand, sub, mobile:'drawer'|'bottom', profile(), nav(), routes, actions, inputs, extra() })
 *   routes: { '': { title, topics:['reqs'], view: () => html``, after(el) } , ... }
 */
(function () {
  const { html, raw, cx, icon } = Nar;
  const ic = (n, s) => raw(icon(n, s));
  let cfg,
    drawer = false;

  const curRoute = () => {
    const p = Nar.router.path;
    return cfg.routes[p] ? p : '';
  };
  const isOn = (h, r) => r === h || (h !== '' && r.split('/')[0] === h);

  function themeBtn(extra = '') {
    const dark = S.state.theme === 'dark';
    return html`<button
      data-act="theme"
      class="${cx('theme-btn', extra)}"
      title="${dark ? 'Харанхуй горим · гэрэлтэй болгох' : 'Гэрэлтэй горим · харанхуй болгох'}"
      aria-label="Горим солих"
    >
      ${ic(dark ? 'moon' : 'sun', 18)}
    </button>`;
  }

  function side() {
    const r = curRoute();
    return html`<nav class="side" aria-label="Үндсэн цэс">
      <div class="side-brand">
        <span class="logo">${ic('building', 21)}</span>
        <div class="col grow">
          <b class="t15">${cfg.brand}</b><span class="t11 side-mu trunc">${cfg.sub}</span>
        </div>
        <button class="lg-down side-x" data-act="drawer" data-arg="0" aria-label="Цэс хаах">
          ${ic('x', 20)}
        </button>
      </div>
      ${cfg.profile ? cfg.profile() : ''}
      <div class="side-nav scroll">
        ${cfg.nav().map((it) => {
          const kidsOn = it.kids && it.kids.some((k) => k.h === r);
          const on = kidsOn || isOn(it.h, r);
          return html`<div class="col g1">
            <a href="#/${it.h}" class="${cx('nav-a', on && 'on')}"
              >${ic(it.icon, 18)}<span class="grow trunc">${it.label}</span>${it.badge
                ? html`<span class="badge">${it.badge}</span>`
                : ''}</a
            >
            ${it.kids && on
              ? html`<div class="nav-kids">
                  ${it.kids.map(
                    (k) =>
                      html`<a href="#/${k.h}" class="${cx('nav-kid', r === k.h && 'on')}"
                        >${k.label}</a
                      >`,
                  )}
                </div>`
              : ''}
          </div>`;
        })}
      </div>
      <div class="flex g2">
        ${themeBtn()}<a href="index.html" data-follow="1" class="logout"
          >${ic('logout', 16)}Гарах</a
        >
      </div>
    </nav>`;
  }

  function header() {
    const R = cfg.routes[curRoute()];
    const unread = S.state.notifs[cfg.role].filter((n) => n.unread).length;
    return html`${cfg.mobile === 'drawer'
        ? html`<button class="btn sq lg-down" data-act="drawer" data-arg="1" aria-label="Цэс нээх">
            ${ic('menu', 20)}
          </button>`
        : ''}
      <h1 class="hdr-title trunc">${typeof R.title === 'function' ? R.title() : R.title}</h1>
      <span class="live md-up"
        ><span class="live-dot"><i class="ping2"></i></span>Шууд</span
      >
      <a href="#/notifications" class="btn sq rel" aria-label="Мэдэгдэл"
        >${ic('bell', 18)}${unread ? html`<span class="badge hdr-badge">${unread}</span>` : ''}</a
      >
      ${cfg.mobile === 'bottom' ? themeBtn('lg-down alt') : ''}`;
  }

  function bottomNav() {
    const r = curRoute();
    return html`${cfg
      .nav()
      .slice(0, 5)
      .map(
        (it) =>
          html`<a href="#/${it.h}" class="${cx('bn-a', isOn(it.h, r) && 'on')}"
            >${ic(it.icon, 19)}${it.label}${it.badge
              ? html`<span class="badge bn-badge">${it.badge}</span>`
              : ''}</a
          >`,
      )}`;
  }

  let lastView = null;
  function boot(c) {
    cfg = c;
    cfg.routes.notifications = cfg.routes.notifications || {
      title: 'Мэдэгдэл',
      topics: ['notifs'],
      view: () => notifView(cfg.role),
    };
    const applyTheme = () =>
      document.documentElement.classList.toggle('dark', S.state.theme === 'dark');
    applyTheme();
    document.body.innerHTML =
      '<div class="app"><aside id="side" class="lg-up"></aside><div id="drawer"></div><div class="app-main"><header id="hdr" class="hdr"></header>' +
      '<main id="main" class="main scroll' +
      (cfg.mobile === 'bottom' ? ' has-bnav' : '') +
      '"><div id="view" class="view"></div></main></div>' +
      (cfg.mobile === 'bottom'
        ? '<nav id="bnav" class="bnav lg-down" aria-label="Доод цэс"></nav>'
        : '') +
      '</div><div id="extra"></div>';
    const regions = [
      {
        el: '#side',
        render: side,
        topics: ['theme', 'notifs', 'reqs', 'leaks', 'lights', 'pay', 'nav'],
      },
      {
        el: '#drawer',
        render: () =>
          drawer
            ? html`<div class="drawer lg-down">
                <button
                  class="drawer-bg"
                  data-act="drawer"
                  data-arg="0"
                  aria-label="Цэс хаах"
                ></button>
                <div class="drawer-panel view-in">${side()}</div>
              </div>`
            : '',
        topics: ['nav', 'theme'],
      },
      { el: '#hdr', render: header, topics: ['theme', 'notifs', 'nav'] },
      {
        el: '#view',
        render: () => {
          const R = cfg.routes[curRoute()];
          return R.view();
        },
        topics: () => (cfg.routes[curRoute()].topics || []).concat('ui'), // 'ui' = хуудасны дотоод төлөв өөрчлөгдсөн
        after: (el) => {
          const r = curRoute();
          if (lastView !== r) {
            lastView = r;
            el.classList.remove('view-in');
            void el.offsetWidth;
            el.classList.add('view-in');
            document.getElementById('main').scrollTop = 0;
          }
          const R = cfg.routes[r];
          if (R.after) R.after(el);
        },
      },
      {
        el: '#extra',
        render: () => (cfg.extra ? cfg.extra() : ''),
        topics: cfg.extraTopics || ['all'],
      },
    ];
    if (cfg.mobile === 'bottom')
      regions.push({ el: '#bnav', render: bottomNav, topics: ['notifs', 'reqs', 'pay', 'nav'] });
    const actions = Object.assign(
      {
        theme: () => S.toggleTheme(),
        drawer: (v) => {
          drawer = v === '1';
          app.refresh(['nav']);
        },
        readAll: () => S.readAll(cfg.role),
      },
      cfg.actions,
    );
    const app = Nar.app({
      store: S,
      regions,
      actions,
      inputs: cfg.inputs,
      before: (T) => {
        if (T.has('theme') || T.has('all')) applyTheme();
      },
      onRoute: (p) => {
        drawer = false;
        if (cfg.onRoute) cfg.onRoute(p);
      },
    });
    Shell.refresh = app.refresh;
    return app;
  }

  function notifView(role) {
    const IC = { ok: 'ok', warn: 'alert', acc: 'info', bad: 'droplet' };
    const list = S.state.notifs[role];
    return html`<section class="card pad col g1 max-3">
      <div class="flex jb ic mb2">
        <h2 class="h2">Мэдэгдэл</h2>
        <button class="link" data-act="readAll">Бүгдийг уншсан</button>
      </div>
      ${list.map(
        (n) =>
          html`<div class="trow flex g3 is p2" data-key="n${n.id}">
            <span class="${'chip icon c-' + n.k}">${ic(IC[n.k], 16)}</span>
            <div class="grow">
              <b class="t13 block">${n.t}</b><span class="muted t12">${n.s}</span>
            </div>
            <div class="col ie g1">
              <span class="num faint t11">${n.time}</span>${n.unread
                ? html`<span class="dot acc"></span>`
                : ''}
            </div>
          </div>`,
      )}
      ${list.length ? '' : html`<p class="empty">Мэдэгдэл алга</p>`}
    </section>`;
  }

  /** жижиг туслахууд */
  const switchBtn = (on, act, arg = '', label = '') =>
    html`<button
      role="switch"
      aria-checked="${on}"
      aria-label="${label}"
      data-act="${act}"
      data-arg="${arg}"
      class="${cx('switch', on && 'on')}"
    ></button>`;
  const seg = (items, cur, act) =>
    html`<div class="seg">
      ${items.map(
        ([v, l]) =>
          html`<button
            class="${String(v) === String(cur) ? 'on' : ''}"
            data-act="${act}"
            data-arg="${v}"
          >
            ${l}
          </button>`,
      )}
    </div>`;
  const prio = (p) =>
    html`<span class="${'chip ' + (p === 'HIGH' ? 'c-bad' : p === 'MED' ? 'c-warn' : 'c-mute')}"
      >${p}</span
    >`;

  window.Shell = { boot, notifView, themeBtn, switchBtn, seg, prio, ic, refresh: () => {} };
})();
