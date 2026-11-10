/*
 * СӨХ Platform — app shell (Nar.js дээр), <sokh-shell> web component:
 *  ≥1024px: зүүн талын цэс (light/dark-д дагана, доор нь горим + гарах товч)
 *  <1024px: дээд мөр + гулсдаг цэс (удирдлага) эсвэл доод tab цэс (ажилтан, оршин суугч)
 *
 * HTML:  <sokh-shell mobile="drawer|bottom" banner></sokh-shell>
 * JS:    Shell.boot({ role, brand, sub, profile(), nav(), routes, actions, inputs, extra(), banner() })
 *   routes: { '': { title, topics:['reqs'], view: () => html``, after(el) } , ... }
 *   nav item: { h, label, icon, badge, kids, bn:false (доод цэсэнд харуулахгүй) }
 *   banner: бүх хуудасны дээд талд байнга харагдах хэсэг (bannerTopics-оор шинэчлэгдэнэ)
 *   mobile: HTML-ийн attribute-аас (эсвэл cfg.mobile)
 */
(function () {
  const { html, cx } = Nar;
  const ic = Nar.ic;
  let cfg,
    drawer = false;

  const curRoute = () => {
    const p = Nar.router.path;
    return cfg.routes[p] ? p : '';
  };
  const isOn = (h, r) => r === h || (h !== '' && r.split('/')[0] === h);

  /** <sokh-shell> — хуудасны үндсэн бүтэц (цэс, header, main, доод цэс) */
  Nar.define('sokh-shell', {
    attrs: [],
    init(el) {
      const bottom = el.str('mobile') === 'bottom';
      el.innerHTML = String(
        html`<div class="app">
            <aside id="side" class="lg-up"></aside>
            <div id="drawer"></div>
            <div class="app-main">
              <header id="hdr" class="hdr"></header>
              <main id="main" class="${cx('main scroll', bottom && 'has-bnav')}">
                ${el.bool('banner') ? html`<div id="banner"></div>` : ''}
                <div id="view" class="view"></div>
              </main>
            </div>
            ${bottom ? html`<nav id="bnav" class="bnav lg-down" aria-label="Доод цэс"></nav>` : ''}
          </div>
          <div id="extra"></div>`,
      );
    },
  });

  const themeBtn = (variant = '') =>
    html`<sokh-theme-btn
      ${Nar.flag('dark', S.state.theme === 'dark')}
      variant="${variant}"
    ></sokh-theme-btn>`;

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
        ${themeBtn()}<a href="login.html" data-follow="1" class="logout" onclick="Api.logout()"
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
      .filter((it) => it.bn !== false)
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
    S.role = cfg.role;
    cfg.routes.notifications = cfg.routes.notifications || {
      title: 'Мэдэгдэл',
      topics: ['notifs'],
      view: () => notifView(cfg.role),
    };
    const applyTheme = () =>
      document.documentElement.classList.toggle('dark', S.state.theme === 'dark');
    applyTheme();
    // HTML-д <sokh-shell> байхгүй бол үүсгэнэ (mobile / banner-ийг cfg-ээс авна)
    let shell = document.querySelector('sokh-shell');
    if (!shell) {
      shell = document.createElement('sokh-shell');
      if (cfg.mobile) shell.setAttribute('mobile', cfg.mobile);
      if (cfg.banner) shell.setAttribute('banner', '');
      document.body.prepend(shell);
    }
    cfg.mobile = shell.getAttribute('mobile') || cfg.mobile || 'drawer';
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
    if (cfg.banner && shell.querySelector('#banner'))
      regions.push({ el: '#banner', render: cfg.banner, topics: cfg.bannerTopics || ['all'] });
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
    watchNotifs(cfg.role);
    return app;
  }

  /** Өөр таб (ажилтан, удирдлага, систем)-аас шинэ мэдэгдэл ирмэгц тэр дороо toast гаргана */
  function watchNotifs(role) {
    const top = () => (S.state.notifs[role][0] || {}).id;
    let seen = top();
    S.on(() => {
      const list = S.state.notifs[role];
      if (!list.length || list[0].id === seen) return;
      const fresh = [];
      for (const n of list) {
        if (n.id === seen) break;
        if (n.from !== role) fresh.push(n);
      }
      seen = list[0].id;
      if (fresh.length) {
        const n = fresh[0];
        Nar.toast(
          n.t,
          n.s + (fresh.length > 1 ? ' · +' + (fresh.length - 1) + ' мэдэгдэл' : ''),
          n.k,
        );
      }
    });
  }

  const NOTIF_IC = { ok: 'ok', warn: 'alert', acc: 'info', bad: 'droplet' };
  function notifView(role) {
    const list = S.state.notifs[role];
    return html`<section class="card pad col g1 max-3">
      <div class="flex jb ic mb2">
        <h2 class="h2">Мэдэгдэл</h2>
        <button class="link" data-act="readAll">Бүгдийг уншсан</button>
      </div>
      ${list.map(
        (n) =>
          html`<sokh-alert
            data-key="${'n' + n.id}"
            tone="${n.k}"
            icon="${NOTIF_IC[n.k]}"
            heading="${n.t}"
            sub="${n.s}"
            time="${n.time}"
            ${Nar.flag('unread', n.unread)}
          ></sokh-alert>`,
      )}
      ${list.length ? '' : html`<p class="empty">Мэдэгдэл алга</p>`}
    </section>`;
  }

  /** жижиг туслахууд → web component tag буцаана */
  const switchBtn = (on, act, arg = '', label = '') =>
    html`<sokh-switch
      ${Nar.flag('on', on)}
      act="${act}"
      arg="${arg}"
      label="${label}"
    ></sokh-switch>`;
  const seg = (items, cur, act, variant = '') =>
    html`<sokh-seg
      value="${cur}"
      act="${act}"
      variant="${variant}"
      options="${Nar.json(items)}"
    ></sokh-seg>`;
  const prio = (p) => html`<sokh-prio p="${p}"></sokh-prio>`;

  window.Shell = { boot, notifView, themeBtn, switchBtn, seg, prio, ic, refresh: () => {} };
})();
