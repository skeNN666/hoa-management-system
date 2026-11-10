/* СӨХ Platform — Нэвтрэх (login.html): 1) хотхон сонгох 2) эрх сонгоод нэвтрэх
 * + оршин суугч бүртгүүлэх хүсэлт (СӨХ батална), шинэ СӨХ бүртгүүлэх. Ажилтныг админ үүсгэнэ. */
(function () {
  const { html, cx, raw } = Nar;
  const ic = Nar.ic;
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
  // index.html-ээс ирсэн систем: login.html?role=admin|staff|resident
  const qRole = new URLSearchParams(location.search).get('role');
  const DISTRICTS = [
    'Баянгол',
    'Баянзүрх',
    'Сонгинохайрхан',
    'Сүхбаатар',
    'Хан-Уул',
    'Чингэлтэй',
    'Налайх',
    'Багануур',
    'Багахангай',
  ];
  const COLORS = ['#0A72B8', '#B5651E', '#0F766E', '#6D3FD6', '#2E8B57', '#C2410C', '#BE185D'];
  const s = {
    step: 'cx', // cx · login · reg (оршин суугчийн хүсэлт) · sokh (шинэ СӨХ) · sent
    f: {}, // бүртгэлийн маягтын талбарууд
    info: '', // хүлээгдэж буй хүсэлтийн мэдээлэл
    sent: null,
    cx: null,
    q: '',
    role: ROLES[qRole] ? qRole : 'admin',
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

  // <1024px: hero (skyline анимаци) харагдахгүй, шууд нэвтрэх хэсэг гарна.
  // Нуусан үед ~4k элементтэй skyline-ийг огт үүсгэхгүй (утсан дээр хурдан ачаална).
  const wide = matchMedia('(min-width: 1024px)');
  wide.addEventListener('change', () => app && app.refresh(['ui']));
  function hero() {
    if (!wide.matches) return '';
    const c = C();
    const R = ROLES[s.role];
    return html`<section class="lg-hero">
      <sokh-skyline></sokh-skyline>
      <div class="lg-hero-fade lg-down"></div>
      <div class="lg-hero-in">
        <div class="flex ic g3">
          <span class="logo lg">${ic('building', 24)}</span>
          <div class="col">
            <b style="color:#AFBDCC" class="t14">${c ? c.n : 'Улаанбаатар'}</b
            ><span class="t12" style="color:#7F93A8"
              >${c
                ? c.b + ' байр · ' + c.u.toLocaleString() + ' айл'
                : COMPLEXES.length +
                  ' хотхон · ' +
                  COMPLEXES.reduce((a, x) => a + x.u, 0).toLocaleString() +
                  ' айл'}</span
            >
          </div>
        </div>
        <h1 class="lg-h1">СӨХ Platform</h1>
        <p class="sm-up lg-lead"><b style="color:#fff">${R.l}</b> — ${R.long}</p>
      </div>
    </section>`;
  }
  /** маягтын талбар: data-in="f" data-k="<k>" → s.f[k] */
  const fld = (label, k, o = {}) =>
    html`<label class="field"
      >${label}<input
        class="inp"
        data-in="f"
        data-k="${k}"
        value="${s.f[k] || ''}"
        type="${o.type || 'text'}"
        placeholder="${o.ph || ''}"
        inputmode="${o.mode || 'text'}"
        autocomplete="${o.auto || 'off'}"
    /></label>`;
  const sel = (label, k, opts) =>
    html`<label class="field"
      >${label}<select class="inp" data-change="f" data-k="${k}">
        ${opts.map(
          ([v, l]) =>
            html`<option value="${v}" ${String(s.f[k]) === String(v) ? raw('selected') : ''}>
              ${l}
            </option>`,
        )}
      </select></label
    >`;
  const backBtn = (to, label) =>
    html`<button type="button" class="lg-home" data-act="go" data-arg="${to}">
      ${ic('arrow-right', 14, 'flip')}${label}
    </button>`;
  const errBox = () => (s.err ? html`<p class="badc t13 b">${s.err}</p>` : '');
  const bldOf = (L, n) => L.buildings.find((b) => String(b.n) === String(n)) || L.buildings[0];

  function regForm() {
    const c = C();
    const L = Layout.get(c.id);
    const B = bldOf(L, s.f.b);
    return html`${backBtn('login', 'Нэвтрэх')}
      <form class="col g4" data-submit="reg" autocomplete="off">
        <div>
          <h2 class="t20 b">Бүртгүүлэх хүсэлт</h2>
          <p class="muted t13">
            Мэдээллээ бөглөөд илгээнэ үү. <b>${c.sokh}</b> баталгаажуулсны дараа утасны дугаар, нууц
            үгээрээ нэвтэрнэ.
          </p>
        </div>
        <div class="flex ic g3 p3 soft-box">
          <span class="cx-logo s" style="${'background:' + c.c}"
            >${c.n.slice(0, 2).toUpperCase()}</span
          >
          <div class="grow col">
            <b class="t14">${c.n}</b><span class="muted t12">${c.sokh} · ${c.d}</span>
          </div>
        </div>
        ${fld('Овог нэр', 'name', { ph: 'Б. Болд', auto: 'name' })}
        ${fld('Утасны дугаар', 'phone', { ph: '9911 2233', mode: 'tel', auto: 'tel' })}
        <div class="cols gs c2">
          ${sel(
            'Байр',
            'b',
            L.buildings.map((b) => [b.n, b.n + '-р байр']),
          )}
          ${fld('Тоот (1–' + B.units + ')', 'u', { ph: '34', mode: 'numeric' })}
        </div>
        ${fld('Ам бүлийн тоо', 'fam', { ph: '3', mode: 'numeric' })}
        <div class="cols gs c2">
          ${fld('Нууц үг', 'pw', { type: 'password', auto: 'new-password' })}
          ${fld('Нууц үг давтах', 'pw2', { type: 'password', auto: 'new-password' })}
        </div>
        ${errBox()}
        <button class="btn p lg" ${s.busy ? raw('disabled') : ''}>
          ${s.busy ? 'Илгээж байна…' : 'Хүсэлт илгээх'}
        </button>
      </form>`;
  }

  function sokhForm() {
    return html`${backBtn('cx', 'Буцах')}
      <form class="col g4" data-submit="sokh" autocomplete="off">
        <div>
          <h2 class="t20 b">Шинэ СӨХ бүртгүүлэх</h2>
          <p class="muted t13">
            Хотхоноо бүртгээд админ эрхтэйгээр шууд нэвтэрнэ. Map-ыг дараа нь
            <b>Хотхоны бүтэц</b> хэсэгт нарийвчилж засна.
          </p>
        </div>
        <p class="th">Хотхон</p>
        ${fld('СӨХ-ийн нэр', 'sokh', { ph: 'Мөнх-Өргөө СӨХ' })}
        ${fld('Хотхоны нэр', 'n', { ph: 'Мөнх-Өргөө хотхон' })}
        ${sel(
          'Дүүрэг',
          'd',
          DISTRICTS.map((d) => [d, d]),
        )}
        <div class="cols gs c2">
          ${fld('Байрны тоо', 'nb', { ph: '6', mode: 'numeric' })}
          ${fld('Давхар', 'fl', { ph: '12', mode: 'numeric' })}
        </div>
        <p class="th">Админ</p>
        ${fld('Овог нэр', 'name', { ph: 'Д. Сарнай', auto: 'name' })}
        ${fld('Утасны дугаар', 'phone', { ph: '9911 2233', mode: 'tel', auto: 'tel' })}
        ${fld('Нэвтрэх нэр (латин)', 'login', { ph: 'munkh.admin', auto: 'username' })}
        <div class="cols gs c2">
          ${fld('Нууц үг', 'pw', { type: 'password', auto: 'new-password' })}
          ${fld('Нууц үг давтах', 'pw2', { type: 'password', auto: 'new-password' })}
        </div>
        ${errBox()}
        <button class="btn p lg" ${s.busy ? raw('disabled') : ''}>
          ${s.busy ? 'Бүртгэж байна…' : 'СӨХ бүртгүүлэх'}
        </button>
      </form>`;
  }

  function sent() {
    const a = s.sent;
    const c = C();
    return html`<div class="col g4 center">
      <span class="lg-sent-ic">${ic('check', 30)}</span>
      <div class="col g1">
        <h2 class="t20 b">Хүсэлт илгээгдлээ</h2>
        <p class="muted t13">
          <b>${c.sokh}</b> таны хүсэлтийг хянаад баталгаажуулна. Баталгаажсаны дараа утасны дугаар,
          нууц үгээрээ нэвтэрнэ.
        </p>
      </div>
      <div class="soft-box p3 col g1 t13" style="text-align:left">
        <span><span class="muted">Нэр:</span> <b>${a.name}</b></span>
        <span><span class="muted">Хаяг:</span> <b>${c.n} · ${a.b}-р байр ${a.u} тоот</b></span>
        <span><span class="muted">Утас:</span> <b class="num">${a.phone}</b></span>
        <span class="flex ic g2"
          ><span class="muted">Төлөв:</span><span class="chip c-warn">Хүлээгдэж байна</span></span
        >
      </div>
      <button class="btn p lg" data-act="go" data-arg="login">Нэвтрэх хуудас руу</button>
    </div>`;
  }

  function card() {
    if (s.step === 'reg') return regForm();
    if (s.step === 'sokh') return sokhForm();
    if (s.step === 'sent') return sent();
    const R = ROLES[s.role];
    const c = C();
    const q = s.q.toLowerCase();
    const list = COMPLEXES.filter((x) => !q || (x.n + x.sokh + x.d).toLowerCase().includes(q));
    const head = html`<a class="lg-home" href="index.html"
        >${ic('arrow-right', 14, 'flip')}Нүүр хуудас</a
      >
      <div class="lg-steps">
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
        </button>
        <p class="t13 muted center">
          Таны хотхон жагсаалтад алга уу?
          <button class="link" data-act="go" data-arg="sokh">Шинэ СӨХ бүртгүүлэх</button>
        </p>`;
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
        ${errBox()}
        ${s.info ? html`<p class="lg-info t13">${ic('clock', 16)}<span>${s.info}</span></p>` : ''}
        <button class="btn p lg" ${s.busy ? raw('disabled') : ''}>
          ${s.busy ? 'Нэвтэрч байна…' : R.l + 'аар нэвтрэх'}
        </button>
        <div class="demo-box">
          Demo · ${R.l}: <b class="num" style="color:var(--ink)">${R.demo[0]} · ${R.demo[1]}</b
          ><button type="button" class="btn s ml-auto" data-act="fill">Бөглөх</button>
        </div>
        <p class="t13 muted center">
          ${s.role === 'resident'
            ? html`Бүртгэлгүй юу?
                <button type="button" class="link" data-act="go" data-arg="reg">
                  Бүртгүүлэх хүсэлт илгээх
                </button>`
            : s.role === 'admin'
              ? html`Шинэ хотхон уу?
                  <button type="button" class="link" data-act="go" data-arg="sokh">
                    СӨХ бүртгүүлэх
                  </button>`
              : 'Ажилтны бүртгэлийг СӨХ-ийн админ үүсгэж, ID, нууц үгийг танд өгнө.'}
        </p>
      </form>`;
  }

  try {
    const st = JSON.parse(localStorage.getItem('sokh-v1') || 'null');
    if (st && st.theme) document.documentElement.classList.toggle('dark', st.theme === 'dark');
  } catch (e) {}
  // бүтэц (#hero, #card) нь login.html-д бичигдсэн
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
      go: (step) => {
        const f = {};
        if (step === 'reg') f.b = Layout.get(s.cx).buildings[0].n;
        if (step === 'sokh') f.d = DISTRICTS[0];
        set({ step, f, err: '', info: '', busy: false });
      },
      role: (k) => set({ role: k, err: '', info: '' }),
      eye: () => set({ show: !s.show }),
      fill: () => {
        const R = ROLES[s.role];
        set({ id: R.demo[0], pw: R.demo[1] });
      },
      login: async () => {
        const R = ROLES[s.role];
        const enter = (id, name) => {
          // session: эрх + хотхон (admin / staff / resident хуудас энэ хотхоны map-ыг ачаална)
          Api.login(s.role, s.cx, id, name);
          setTimeout(() => (location.href = R.go), 650);
        };
        set({ err: '', info: '', busy: true });
        if (s.id.trim() === R.demo[0] && s.pw === R.demo[1]) return enter(s.id.trim());
        // бүртгүүлсэн хэрэглэгч (js/accounts.js): хүлээгдэж буй хүсэлт бол мэдээлэл харуулна
        const r = await Api.accounts.signIn(s.role, s.cx, s.id, s.pw);
        if (r.ok) return enter(r.acc.login, r.acc.name);
        if (r.status === 'pending') return set({ busy: false, info: r.msg });
        set({ busy: false, err: r.msg, shake: s.shake + 1 });
      },
      reg: async () => {
        const f = s.f;
        if (Number(f.u) > bldOf(Layout.get(s.cx), f.b).units)
          return set({ err: 'Тоот тухайн байрны айлын тооноос хэтэрсэн байна' });
        set({ busy: true, err: '' });
        const r = await Api.accounts.register({ ...f, role: 'resident', cx: s.cx });
        if (!r.ok) return set({ busy: false, err: r.msg });
        set({ busy: false, step: 'sent', sent: r.acc, f: {} });
      },
      sokh: async () => {
        const f = s.f;
        const nb = Math.round(Number(f.nb)),
          fl = Math.round(Number(f.fl));
        if (!String(f.sokh || '').trim() || !String(f.n || '').trim())
          return set({ err: 'СӨХ болон хотхоны нэрийг бичнэ үү' });
        if (COMPLEXES.some((c) => c.n.toLowerCase() === f.n.trim().toLowerCase()))
          return set({ err: 'Ийм нэртэй хотхон бүртгэлтэй байна' });
        if (!(nb >= 1 && nb <= 30)) return set({ err: 'Байрны тоо 1–30 байна' });
        if (!(fl >= 2 && fl <= 30)) return set({ err: 'Давхар 2–30 байна' });
        const id = 'cx-' + Date.now().toString(36);
        set({ busy: true, err: '' });
        const r = await Api.accounts.register({ ...f, role: 'admin', cx: id });
        if (!r.ok) return set({ busy: false, err: r.msg });
        // админаар нэвтрээд (server map хадгалахдаа эрх шалгана) хотхоны анхны map-ыг үүсгэнэ
        Api.login('admin', id, r.acc.login, r.acc.name);
        const L = Object.assign(
          Layout.generate({
            buildings: nb,
            floors: [fl, fl],
            slots: nb * 8,
            seed: Date.now() % 997,
          }),
          {
            id,
            n: f.n.trim(),
            sokh: f.sokh.trim(),
            d: f.d,
            c: COLORS[COMPLEXES.length % COLORS.length],
          },
        );
        const saved = await Layout.save(L);
        if (!saved.ok) {
          Api.logout();
          return set({ busy: false, err: saved.msg });
        }
        location.href = 'admin.html';
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
      f: (v, el) => {
        s.f[el.dataset.k] = v;
        if (el.dataset.k === 'b') app.refresh(['ui']); // тоотын хязгаар шинэчлэгдэнэ
      },
    },
  });
})();
