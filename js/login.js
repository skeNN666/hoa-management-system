/* СӨХ Platform — Нэвтрэх (index.html): 1) хотхон сонгох 2) эрх сонгоод нэвтрэх */
(function () {
  const { html, cx, icon, raw } = Nar;
  const ic = (n, s) => raw(icon(n, s));
  // хотхоны жагсаалт: js/layout.js-ийн бүртгэл (админ шинээр бүртгэсэн хотхонууд ч энд гарна)
  const COMPLEXES = Layout.all().map((L) => ({
    id: L.id,
    n: L.n,
    sokh: L.sokh,
    d: L.d,
    b: L.buildings.length,
    u: Layout.units(L),
    c: L.c,
  }));
  const ROLES = {
    admin: {
      l: 'Админ',
      s: 'Удирдлага, санхүү',
      icon: 'shield',
      id: 'Нэвтрэх нэр',
      demo: ['admin', 'admin2026'],
      go: 'admin.html',
      long: 'СӨХ-ийн удирдлага, санхүү, тайлан',
    },
    staff: {
      l: 'Ажилтан',
      s: 'Даалгавар, засвар',
      icon: 'wrench',
      id: 'Ажилтны ID',
      demo: ['EMP-009', 'staff2026'],
      go: 'staff.html',
      long: 'Даалгавар, засвар үйлчилгээ',
    },
    resident: {
      l: 'Оршин суугч',
      s: 'Төлбөр, хүсэлт',
      icon: 'home',
      id: 'Утасны дугаар',
      demo: ['9911 2233', 'bat2026'],
      go: 'resident.html',
      long: 'Төлбөр, хүсэлт, зогсоол',
    },
  };
  const s = {
    step: 'cx',
    cx: null,
    q: '',
    role: 'admin',
    id: '',
    pw: '',
    show: false,
    err: '',
    busy: false,
    shake: 0,
  };
  let app;
  const set = (p) => {
    Object.assign(s, p);
    app.refresh(['ui']);
  };
  const C = () => COMPLEXES.find((c) => c.id === s.cx);

  function hero() {
    const c = C();
    const R = ROLES[s.role];
    return html`<section class="lg-hero">
      ${W.skyline()}
      <div class="lg-hero-fade lg-down"></div>
      <div class="lg-hero-in">
        <div class="flex ic g3">
          <span class="logo lg">${ic('building', 24)}</span>
          <div class="col">
            <b style="color:#AFBDCC" class="t14">${c ? c.n : 'Улаанбаатар'}</b
            ><span class="t12" style="color:#7F93A8"
              >${c
                ? c.b + ' байр · ' + c.u.toLocaleString() + ' айл'
                : '8 хотхон · 6,536 айл'}</span
            >
          </div>
        </div>
        <h1 class="lg-h1">СӨХ Platform</h1>
        <p class="sm-up lg-lead"><b style="color:#fff">${R.l}</b> — ${R.long}</p>
      </div>
    </section>`;
  }
  function card() {
    const R = ROLES[s.role];
    const c = C();
    const q = s.q.toLowerCase();
    const list = COMPLEXES.filter((x) => !q || (x.n + x.sokh + x.d).toLowerCase().includes(q));
    const head = html`<div class="lg-steps">
      <span class="${cx('ls-n', s.step === 'cx' ? 'on' : 'ok')}"
        >${s.step === 'cx' ? '1' : ic('check', 13)}</span
      >Хотхон<span class="${cx('ls-line', s.step === 'login' && 'on')}"></span
      ><span class="${cx('ls-n', s.step === 'login' && 'on')}">2</span>Нэвтрэх
    </div>`;
    if (s.step === 'cx')
      return html`${head}
        <div>
          <h2 class="t20 b">Хотхон / СӨХ-өө сонгоно уу</h2>
          <p class="muted t13">Систем олон хотхоны СӨХ-д үйлчилдэг.</p>
        </div>
        <label class="inp-icon"
          >${ic('search', 17)}<input
            class="inp"
            data-in="q"
            placeholder="Хотхон, СӨХ, дүүрэг хайх…"
            value="${s.q}"
        /></label>
        <div class="col g2 scroll cx-list">
          ${list.map(
            (x) =>
              html`<button
                class="${cx('cx-item', s.cx === x.id && 'on')}"
                data-act="cx"
                data-arg="${x.id}"
                data-key="${x.id}"
              >
                <span class="cx-logo" style="${'background:' + x.c}"
                  >${x.n.slice(0, 2).toUpperCase()}</span
                >
                <span class="grow col"
                  ><b class="t14">${x.n}</b
                  ><span class="muted t12"
                    >${x.sokh} · ${x.d} · ${x.b} байр · ${x.u.toLocaleString()} айл</span
                  ></span
                ><span class="${cx('radio', s.cx === x.id && 'on')}"></span>
              </button>`,
          )}
        </div>
        <button class="btn p lg" data-act="next" ${s.cx ? '' : raw('disabled')}>
          Үргэлжлүүлэх
        </button>`;
    return html`${head}
      <form class="col g4" data-submit="login" autocomplete="on">
        <div class="flex ic g3 p3 soft-box">
          <span class="cx-logo s" style="${'background:' + c.c}"
            >${c.n.slice(0, 2).toUpperCase()}</span
          >
          <div class="grow col">
            <b class="t14">${c.n}</b><span class="muted t12">${c.sokh} · ${c.d}</span>
          </div>
          <button type="button" class="btn s" data-act="back">Солих</button>
        </div>
        <h2 class="t20 b">Нэвтрэх</h2>
        <div class="cols gs c3" role="radiogroup">
          ${Object.keys(ROLES).map((k) => {
            const r = ROLES[k];
            const on = s.role === k;
            return html`<button
              type="button"
              role="radio"
              aria-checked="${on}"
              class="${cx('role', on && 'on')}"
              data-act="role"
              data-arg="${k}"
            >
              <span class="role-ic">${ic(r.icon, 19)}</span><b class="t13">${r.l}</b
              ><span class="t11 muted sm-up">${r.s}</span>
            </button>`;
          })}
        </div>
        <label class="field"
          >${R.id}<input class="inp" name="id" data-in="id" value="${s.id}" autocomplete="username"
        /></label>
        <label class="field"
          >Нууц үг<span class="rel"
            ><input
              class="inp"
              style="padding-right:52px"
              name="pw"
              data-in="pw"
              type="${s.show ? 'text' : 'password'}"
              value="${s.pw}"
              autocomplete="current-password"
            />
            <button type="button" class="btn s sq pw-eye" data-act="eye" aria-label="Нууц үг харах">
              ${ic(s.show ? 'eye-off' : 'eye', 16)}
            </button></span
          ></label
        >
        ${s.err ? html`<p class="badc t13 b">${s.err}</p>` : ''}
        <button class="btn p lg" ${s.busy ? raw('disabled') : ''}>
          ${s.busy ? 'Нэвтэрч байна…' : R.l + 'аар нэвтрэх'}
        </button>
        <div class="demo-box">
          Demo · ${R.l}: <b class="num" style="color:var(--ink)">${R.demo[0]} · ${R.demo[1]}</b
          ><button type="button" class="btn s ml-auto" data-act="fill">Бөглөх</button>
        </div>
      </form>`;
  }

  try {
    const st = JSON.parse(localStorage.getItem('sokh-v1') || 'null');
    if (st && st.theme) document.documentElement.classList.toggle('dark', st.theme === 'dark');
  } catch (e) {}
  document.body.innerHTML =
    '<div class="login"><div id="hero"></div><section class="lg-form"><div id="card" class="card lg-card"></div></section></div>';
  app = Nar.app({
    regions: [
      { el: '#hero', render: hero, topics: ['ui'] },
      {
        el: '#card',
        render: card,
        topics: ['ui'],
        after: (el) => {
          if (el.dataset.shake !== String(s.shake)) {
            el.dataset.shake = s.shake;
            if (s.shake) {
              el.classList.remove('shake');
              void el.offsetWidth;
              el.classList.add('shake');
            }
          }
        },
      },
    ],
    actions: {
      cx: (id) => set({ cx: id }),
      next: () => set({ step: 'login' }),
      back: () => set({ step: 'cx' }),
      role: (k) => set({ role: k, err: '' }),
      eye: () => set({ show: !s.show }),
      fill: () => {
        const R = ROLES[s.role];
        set({ id: R.demo[0], pw: R.demo[1] });
      },
      login: () => {
        const R = ROLES[s.role];
        if (s.id.trim() !== R.demo[0] || s.pw !== R.demo[1])
          return set({ err: 'Нэвтрэх нэр эсвэл нууц үг буруу байна', shake: s.shake + 1 });
        set({ err: '', busy: true });
        Layout.setCurrent(s.cx); // admin / staff / resident хуудас энэ хотхоны map-ыг ачаална
        setTimeout(() => (location.href = R.go), 650);
      },
    },
    inputs: {
      q: (v) => set({ q: v }),
      id: (v) => {
        s.id = v;
      },
      pw: (v) => {
        s.pw = v;
      },
    },
  });
})();
