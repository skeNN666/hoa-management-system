/* СӨХ Platform — Удирдлага (admin.html) */
(function () {
  const { html, cx } = Nar;
  const { ic, seg, switchBtn, prio } = Shell;
  const { money, nf, ago, REQ_STATUS, BUILDINGS } = D;
  const SLA_DEF = 60;
  const NB = BUILDINGS.length;
  const BN = BUILDINGS.map((b) => b.n);
  const ui = {
    leakB: Math.min(5, NB),
    mode: 'light',
    night: false,
    selB: null,
    selL: 'L07',
    zone: 'p',
    selSlot: null,
    b: Math.min(5, NB),
    unit: 34,
    q: '',
    payTab: 'debt',
    sla: SLA_DEF,
    repM: D.CUR_MONTH,
    exp: { cat: 'Засвар', t: '', amt: '', v: '' },
    wk: { cat: 'Засвар', t: '', where: '' },
  };
  const set = (p) => {
    Object.assign(ui, p);
    Shell.refresh(['ui']);
  };
  const st = () => S.state;
  const debtorsOf = () => S.units.flat().filter((u) => u.st !== 0);

  /* ------------------------------ Dashboard ------------------------------ */
  function dashboard() {
    const s = st();
    const now = Date.now();
    const SLA = SLA_DEF * 60000;
    const debtors = debtorsOf().sort(
      (a, b) => (b.st === 1) - (a.st === 1) || b.amt + b.prev - (a.amt + a.prev),
    );
    const overdue = debtors.filter((u) => u.st === 1);
    const debtSum = debtors.reduce((a, u) => a + u.amt + u.prev, 0);
    const open = s.reqs.filter((q) => q.st < 4);
    const isLate = (q) => q.st <= 1 && now - q.stAt >= SLA;
    const late = open.filter(isLate);
    const leaks = s.leaks.filter((x) => x.st !== 'fixed');
    const act = leaks.filter((x) => x.st === 'active');
    const off = s.lights.filter((l) => l.st === 'off');
    const sOff = s.slots.filter((x) => x.sens === 'off');
    const sLow = s.slots.filter((x) => x.sens === 'low');
    const tiles = [
      {
        n: debtors.length,
        l: 'Өртэй айл',
        sub: overdue.length + ' нь хугацаа хэтэрсэн · ' + money(debtSum),
        icon: 'alert',
        cta: 'Сануулга илгээх',
        h: 'payments',
        hot: overdue.length > 0,
      },
      {
        n: open.length,
        l: 'Шийдэгдээгүй хүсэлт',
        sub: late.length ? late.length + ' нь SLA хэтэрсэн' : 'SLA хугацаанд байна',
        icon: 'wrench',
        cta: 'Хуваарилах',
        h: 'requests',
        hot: late.length > 0,
      },
      {
        n: leaks.length,
        l: 'Ус алдалт',
        sub: act.length ? act.length + ' айлд яг одоо алдаж байна' : 'Засвар хийгдэж байна',
        icon: 'droplet',
        cta: 'Харах',
        h: 'leak',
        hot: act.length > 0,
      },
      {
        n: off.length,
        l: 'Эвдэрсэн гэрэл',
        sub: off.map((l) => l.id).join(', '),
        icon: 'bulb',
        cta: 'Засвар захиалах',
        h: 'map',
        hot: false,
      },
      {
        n: sOff.length + sLow.length,
        l: 'Мэдрэгч асуудалтай',
        sub: sOff.length + ' холбогдохгүй · ' + sLow.length + ' цэнэг бага',
        icon: 'radio',
        cta: 'Шалгах',
        h: 'parking',
        hot: sOff.length > 0,
      },
    ];
    const kinds = tiles.filter((t) => t.n > 0).length;
    const tone = (t) => (t.n ? (t.hot ? 'c-bad' : 'c-warn') : 'c-ok');
    const alert = (key, t, icn, title, sub, cta, act, arg) =>
      html`<div class="trow flex ic g3 p2" data-key="${key}">
        <span class="${'chip icon c-' + t}">${ic(icn, 16)}</span>
        <div class="grow">
          <b class="t13 block">${title}</b><span class="muted t12">${sub}</span>
        </div>
        <button class="btn s no-shrink" data-act="${act}" data-arg="${arg}">${cta}</button>
      </div>`;
    return html`<div class="col g4">
      <section class="card pad flex ic g4">
        <span
          class="${'chip icon xl ' +
          (act.length || late.length ? 'c-bad' : kinds ? 'c-warn' : 'c-ok')}"
          >${ic(kinds ? 'alert' : 'ok', 24)}</span
        >
        <div class="grow">
          <h2 class="t20 b tight">
            ${kinds
              ? 'Өнөөдөр анхаарах ' + kinds + ' төрлийн асуудал байна'
              : 'Бүх зүйл хэвийн байна'}
          </h2>
          <p class="muted t13 mt1">
            Хэвийн ажиллаж буй зүйлсийг энд харуулахгүй — зөвхөн арга хэмжээ авах шаардлагатайг.
          </p>
        </div>
      </section>
      <div class="cols gs c2 md-c3 xl-c5 st">
        ${tiles.map(
          (t) =>
            html`<div class="${cx('card p4 col g2', t.hot && 'hot', !t.n && 'dim')}">
              <div class="flex jb ic">
                <span class="${'chip icon ' + tone(t)}">${ic(t.icon, 17)}</span
                ><span class="${'chip ' + tone(t)}"
                  >${t.n ? (t.hot ? 'Яаралтай' : 'Анхаарах') : 'Хэвийн'}</span
                >
              </div>
              <b class="${cx('num t30 tight', !t.n && 'okc')}">${nf(t.n)}</b
              ><b class="t13">${t.l}</b
              ><span class="muted t12 tile-sub">${t.n ? t.sub : 'Асуудал алга'}</span>
              <a href="#/${t.h}" class="${cx('btn s mt-auto', t.n && 'p')}"
                >${t.n ? t.cta : 'Харах'}</a
              >
            </div>`,
        )}
      </div>
      <div class="cols c1 xl-split">
        <section class="card pad col g1">
          <div class="flex wrap g2 jb ic mb2">
            <div>
              <h2 class="h2">Өртэй айлууд</h2>
              <p class="muted t12 num">${overdue.length} хугацаа хэтэрсэн · ${money(debtSum)}</p>
            </div>
            <button class="btn s p" data-act="remindAll">Бүгдэд сануулга илгээх</button>
          </div>
          ${debtors.slice(0, 7).map((u) => {
            const k = u.b + '-' + u.n;
            const sent = s.reminded[k];
            return html`<div class="trow debt-row" data-key="d${k}">
              <b class="num">${k}</b><span class="trunc">${u.owner}</span
              ><span class="${'chip sm-up ' + (u.st === 1 ? 'c-bad' : 'c-warn')}"
                >${u.st === 1 ? '2+ сар' : 'Төлөөгүй'}</span
              >
              <b class="num right sm-up">${money(u.amt + u.prev)}</b
              ><button
                class="btn s"
                data-act="remind"
                data-arg="${k}"
                ${sent ? Nar.raw('disabled') : ''}
              >
                ${sent ? '✓ Илгээсэн' : 'Сануулах'}
              </button>
            </div>`;
          })}
          <a href="#/payments" class="link mt1">Бүх өртэй айл (${nf(debtors.length)}) →</a>
        </section>
        <section class="card pad col g1">
          <div class="flex jb ic mb2">
            <div>
              <h2 class="h2">Шийдэгдээгүй хүсэлтүүд</h2>
              <p class="muted t12">${open.length} нээлттэй · ${late.length} SLA хэтэрсэн</p>
            </div>
            <a href="#/requests" class="btn s">Бүгд →</a>
          </div>
          ${open
            .slice()
            .sort((a, b) => isLate(b) - isLate(a))
            .slice(0, 6)
            .map(
              (q) =>
                html`<div class="trow flex ic g3 p2 t13" data-key="${q.id}">
                  ${prio(q.p)}
                  <div class="grow">
                    <b class="block trunc">${q.title}</b
                    ><span class="muted t12">${q.b}-р байр · ${q.u} тоот · ${q.cat}</span>
                  </div>
                  <span
                    class="${'chip sm-up ' +
                    (isLate(q) ? 'c-bad' : q.st === 0 ? 'c-acc' : 'c-warn')}"
                    >${isLate(q) ? 'SLA хэтэрсэн' : REQ_STATUS[q.st]}</span
                  ><span class="num faint t11 age">${ago(now - q.createdAt)}</span>
                </div>`,
            )}
        </section>
      </div>
      <section class="card pad col g1">
        <h2 class="h2 mb2">Бусад анхааруулга</h2>
        ${act.map((x) =>
          alert(
            x.id,
            'bad',
            'droplet',
            'Ус алдаж байна · ' + x.b + '-р байр ' + x.u + ' тоот',
            x.room + ' · хавхлага автоматаар хаагдана',
            'Хавхлага хаах',
            'closeLeak',
            x.id,
          ),
        )}
        ${off.map((l) =>
          alert(
            l.id,
            'warn',
            'bulb',
            'Гадна гэрэл ' + l.id + ' унтарсан',
            l.loc,
            'Засвар захиалах',
            'fixLight',
            l.id,
          ),
        )}
        ${sOff.map((x) =>
          alert(
            's' + x.id,
            'bad',
            'radio',
            'Зогсоолын мэдрэгч ' + x.id + ' холбогдохгүй',
            'Сүүлд 2 цагийн өмнө дохио өгсөн',
            'Техникч илгээх',
            'task',
            x.id + ' шалгах · Б. Ганзориг',
          ),
        )}
        ${sLow.length
          ? alert(
              'slow',
              'warn',
              'car',
              sLow.length + ' мэдрэгчийн цэнэг бага',
              sLow.map((x) => x.id).join(', '),
              'Батарей солих',
              'task',
              'Батарей солих',
            )
          : ''}
        ${!act.length && !off.length && !sOff.length && !sLow.length
          ? html`<p class="okc b t13 p2">Бүгд хэвийн ✓</p>`
          : ''}
      </section>
    </div>`;
  }

  /* ------------------------------ Ус алдалт ------------------------------ */
  const STEPS = [
    'Чип ус илрүүлэв',
    'Айл, сантехникч, доод айлд мэдэгдэв',
    'Айлын хавхлага хаагдав',
    'Сантехникч ажиллаж байна',
    'Засагдаж, хавхлага нээгдэв',
  ];
  const SI = { active: 1, closed: 2, fixing: 3, fixed: 4 };
  const LNAME = {
    active: 'Ус алдаж байна',
    closed: 'Хавхлага хаагдсан',
    fixing: 'Засаж байна',
    fixed: 'Засагдсан',
  };
  const LTONE = { active: 'c-bad', closed: 'c-acc', fixing: 'c-warn', fixed: 'c-ok' };
  function leak() {
    const leaks = st().leaks;
    const b = ui.leakB;
    const act = leaks.filter((x) => x.st === 'active');
    const open = leaks.filter((x) => x.st !== 'fixed').sort((x) => (x.st === 'active' ? -1 : 1));
    const storm = act.some((x) => x.b === b);
    const stats = [
      ['2,520 чип', '', '#3DDC84'],
      ['Online', '2,516', '#3DDC84'],
      ['Идэвхтэй алдалт', String(act.length), act.length ? '#FF5A4E' : '#64748B'],
      ['Хаагдсан хавхлага', String(leaks.filter((x) => x.st === 'closed').length), '#5B7DA8'],
      ['Дундаж хариу', '4 сек', '#F0B03E'],
    ];
    return html`<div class="cols c1 xl-side">
      <section class="${cx('leak-panel', storm && 'storm')}">
        ${storm ? html`<div class="leak-glow pulse2"></div>` : ''}
        <div class="rel flex wrap g3 jb ic">
          <div>
            <h2 class="t18 b" style="color:#fff">Ус алдалтын хяналт · ${b}-р байр</h2>
            <p class="t12" style="color:#9FB3C8">
              Айл бүрийн угаалгын өрөө, гал тогоонд мэдрэгч чип · стояк дотор ус урсаж байна
            </p>
          </div>
          <div class="flex wrap g2 ic">
            <div class="seg dark-seg">
              ${BN.map(
                (n) =>
                  html`<button class="${b === n ? 'on' : ''}" data-act="leakB" data-arg="${n}">
                    ${n}-р${leaks.some((x) => x.b === n && x.st !== 'fixed')
                      ? html`<span class="dot bad" style="margin-left:4px"></span>`
                      : ''}
                  </button>`,
              )}
            </div>
            <button class="btn s glass" data-act="leakHist">
              ${ic('history', 14)}Сүүлийн алдалтууд</button
            ><button class="btn s glass" data-act="demoLeak">Демо: алдалт</button>
          </div>
        </div>
        <div class="rel flex wrap g2">
          ${stats.map(
            ([l, v, c]) =>
              html`<span
                class="${cx('lk-stat', l === 'Идэвхтэй алдалт' && act.length && 'hot pulse2')}"
                ><i class="dot" style="${'background:' + c}"></i>${l}
                ${v ? html`<b class="num" style="color:#fff">${v}</b>` : ''}</span
              >`,
          )}
        </div>
        ${W.leakBuilding(b, leaks, storm)}
      </section>
      <div class="col g4 xl-sticky">
        ${open.slice(0, 2).map((x) => {
          const si = SI[x.st];
          const on = x.st === 'active';
          return html`<section class="${cx('card p4 col g3', on && 'hot')}" data-key="${x.id}">
            <div class="flex is g3">
              <span class="${cx('lk-ic', 'lk-ic-' + x.st, on && 'pulse2')}"
                >${ic('droplet', 20)}</span
              >
              <div class="grow">
                <b class="block"
                  >${x.b}-р байр · ${Math.ceil(x.u / BUILDINGS[x.b - 1].per)}-р давхар · ${x.u}
                  тоот</b
                ><span class="muted t12">${x.id} · ${x.room}</span>
              </div>
              <span class="${'chip ' + LTONE[x.st]}">${LNAME[x.st]}</span>
            </div>
            <ol class="steps">
              ${STEPS.map(
                (l, i) =>
                  html`<li class="${cx(i <= si && 'done', on && i <= 1 && 'alarm')}">
                    <span class="st-dot"></span
                    ><span class="grow flex jb"
                      >${l}<span class="num faint t11">${x.times[i]}</span></span
                    >
                  </li>`,
              )}
            </ol>
            ${on
              ? html`<div class="flex g2">
                  <button
                    class="btn danger grow"
                    style="flex:2"
                    data-act="closeLeak"
                    data-arg="${x.id}"
                  >
                    Хавхлага алсаас хаах</button
                  ><button class="btn grow" data-act="call" data-arg="${x.u}" aria-label="Залгах">
                    ${ic('phone', 15)}
                  </button>
                </div>`
              : ''}
          </section>`;
        })}
        ${open.length
          ? ''
          : html`<section class="card p4 flex ic g3 ok-card">
              <span class="chip icon m c-solid okbg">${ic('ok', 22)}</span>
              <div>
                <b>Бүх айл хэвийн</b>
                <p class="muted t12">2,520 чип онлайн</p>
              </div>
            </section>`}
      </div>
    </div>`;
  }
  function leakHistory() {
    const leaks = st().leaks;
    return html`<div class="flex jb ic">
        <div>
          <h2 class="h2">Сүүлийн алдалтууд</h2>
          <p class="muted t12">${leaks.length} бүртгэл</p>
        </div>
        <button class="btn s sq" data-act="__close" aria-label="Хаах">${ic('x', 16)}</button>
      </div>
      <div class="list">
        ${leaks.map(
          (x) =>
            html`<div class="hist-row">
              <b>${x.b}-р байр · ${x.u} тоот</b><span class="muted sm-up">${x.room}</span
              ><span class="${'chip self-start ' + LTONE[x.st]}">${LNAME[x.st]}</span
              ><span class="num faint t12 right sm-up">${x.times[0]}</span>
            </div>`,
        )}
      </div>`;
  }

  /* ------------------------------ 3D map ------------------------------ */
  let complex = null;
  function mapView() {
    const s = st();
    const L = s.lights.find((l) => l.id === ui.selL) || s.lights[0];
    const off = s.lights.filter((l) => l.st !== 'on');
    const B = ui.selB != null ? BUILDINGS[ui.selB] : null;
    const BU = B ? S.units[B.n - 1] : [];
    const paid = BU.length ? BU.filter((u) => u.st === 0).length / BU.length : 0;
    const LT = {
      on: ['c-ok', 'Ажиллаж байна'],
      off: ['c-bad', 'Унтарсан'],
      fixing: ['c-warn', 'Засварт'],
    };
    return html`<div class="col g4">
      <section class="card p0 ovh map-box">
        ${Nar.keep('complex3d', 'fill')}
        <div class="map-title">
          <b class="${cx('t24 b9', ui.night && 'night')}">${D.LAYOUT.n}</b>
          <p class="t12 b sm-up" style="color:#7A7365">
            Чирж эргүүлнэ · scroll-оор томруулна · байр дээр дарвал хөтөч тийш дагуулна
          </p>
        </div>
        <button class="map-night" data-act="night" aria-label="Өдөр / шөнө">
          ${ic(ui.night ? 'moon' : 'sun', 18)}
        </button>
        <div class="map-modes">
          ${[
            ['light', 'Гэрэлтүүлэг'],
            ['pay', 'Төлбөр'],
            ['leak', 'Ус алдалт'],
          ].map(
            ([k, l]) =>
              html`<button class="${ui.mode === k ? 'on' : ''}" data-act="mode" data-arg="${k}">
                ${l}
              </button>`,
          )}
        </div>
        ${B
          ? html`<div class="map-card view-in">
              <div class="flex jb ic">
                <span class="t11 b9 gold-t">СОНГОСОН БАЙР</span
                ><button data-act="selB" data-arg="" aria-label="Хаах">${ic('x', 16)}</button>
              </div>
              <b class="t18"
                >${B.n}-р байр
                <span class="t12" style="color:#B9B2A2"
                  >· ${B.fl} давхар · ${BU.length} айл</span
                ></b
              >
              <div class="flex jb t13">
                <span class="mc-mu">Төлбөр төлөлт</span
                ><b class="num">${Math.round(paid * 100)}%</b>
              </div>
              <div class="bar dk">
                <i
                  style="${'width:' +
                  paid * 100 +
                  '%;background:' +
                  (paid >= 0.85 ? '#2EAE68' : '#F0B03E')}"
                ></i>
              </div>
              <div class="flex jb t13">
                <span class="mc-mu">Нээлттэй хүсэлт</span
                ><b>${s.reqs.filter((q) => q.b === B.n && q.st < 4).length}</b>
              </div>
              <div class="flex jb t13">
                <span class="mc-mu">Ус алдалт</span
                ><b>${s.leaks.filter((x) => x.b === B.n && x.st !== 'fixed').length || 'Хэвийн'}</b>
              </div>
            </div>`
          : ''}
      </section>
      <div class="cols c1 md-c2 xl-c3">
        <section class="${cx('card p4 flex ic g3', off.length ? 'bad-card' : 'ok-card')}">
          <span class="${'chip icon m ' + (off.length ? 'c-bad' : 'c-ok')}">${ic('bulb', 20)}</span>
          <div>
            <b>${off.length ? off.length + ' гэрэл асуудалтай' : 'Бүх гэрэл хэвийн'}</b>
            <p class="muted t12">
              ${s.lights.length - off.length}/${s.lights.length} гэрэл ажиллаж байна
            </p>
          </div>
        </section>
        <section class="card p4 col g3">
          <div class="flex jb">
            <span class="th">Сонгосон гэрэл</span
            ><span class="${'chip ' + LT[L.st][0]}">${LT[L.st][1]}</span>
          </div>
          <b class="t24 num">${L.id}</b>
          <p class="t13 muted">${L.loc} · LED 60W · 19:00–07:00</p>
          ${L.st === 'off'
            ? html`<button class="btn p" data-act="fixLight" data-arg="${L.id}">
                ${ic('wrench', 16)}Засварын хүсэлт үүсгэх
              </button>`
            : ''}
          ${L.st === 'on'
            ? html`<button class="btn" data-act="breakLight" data-arg="${L.id}">
                Эвдрэл бүртгэх
              </button>`
            : ''}
          ${L.st === 'fixing' ? html`<p class="warnc t13 b">Н. Тунгалаг засварлаж байна…</p>` : ''}
        </section>
        <section class="card p4 col g1">
          <span class="th mb1">Асуудалтай гэрэл</span> ${off.map(
            (l) =>
              html`<button
                class="trow flex ic g2 p2 t13"
                data-act="selL"
                data-arg="${l.id}"
                data-key="${l.id}"
              >
                <b class="num" style="width:40px">${l.id}</b><span class="grow muted">${l.loc}</span
                ><span class="${'chip ' + LT[l.st][0]}">${LT[l.st][1]}</span>
              </button>`,
          )}
          ${off.length ? '' : html`<p class="okc t13 b p2">Бүгд хэвийн ✓</p>`}
        </section>
      </div>
    </div>`;
  }
  function mapAfter() {
    if (!complex)
      complex = Scenes.complex(Nar.host('complex3d'), {
        onSelectB: (i) => set({ selB: i }),
        onSelectLight: (id) => set({ selL: id, selB: null }),
      });
    complex.update({
      lights: st().lights,
      leaks: st().leaks,
      units: S.units,
      slots: st().slots, // зогсоолын хуудастай sync
      mode: ui.mode,
      night: ui.night,
      selB: ui.selB,
      selLight: ui.selL,
    });
  }

  /* ------------------------------ Санхүү ------------------------------ */
  const MN = [
    '1-р сар',
    '2-р сар',
    '3-р сар',
    '4-р сар',
    '5-р сар',
    '6-р сар',
    '7-р сар',
    '8-р сар',
    '9-р сар',
    '10-р сар',
    '11-р сар',
    '12-р сар',
  ];
  function invoices() {
    const c = st().invoice;
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), c.day, Number(c.time.slice(0, 2)));
    if (next <= now)
      next = new Date(now.getFullYear(), now.getMonth() + 1, c.day, Number(c.time.slice(0, 2)));
    const days = Math.ceil((next - now) / 86400000);
    const sum = S.units.flat().reduce((a, u) => a + u.amt, 0);
    const p2 = (n) => String(n).padStart(2, '0');
    const sel = (k, opts, cur, fmt) =>
      html`<select class="inp" data-change="inv" data-k="${k}">
        ${opts.map(
          (o) =>
            html`<option value="${o}" ${String(o) === String(cur) ? Nar.raw('selected') : ''}>
              ${fmt ? fmt(o) : o}
            </option>`,
        )}
      </select>`;
    return html`<div class="cols c1 xl-side" style="--sw:380px">
      <section class="card pad col g4">
        <div class="flex wrap g3 jb is">
          <div>
            <h2 class="h2">Автомат нэхэмжлэл</h2>
            <p class="muted t12 max-xl">
              Сар бүр тогтсон өдөр, цагт бүх айлд нэхэмжлэл автоматаар үүсч апп + SMS-ээр очно.
              Админ гараар үүсгэх шаардлагагүй.
            </p>
          </div>
          <label class="flex ic g3 t12 b"
            ><span class="muted">${c.auto ? 'Автомат · асаалттай' : 'Унтраалттай'}</span
            >${switchBtn(c.auto, 'invToggle', 'auto', 'Автомат илгээлт')}</label
          >
        </div>
        <div class="${cx('inv-next', !c.auto && 'off')}">
          <div class="cal"><span>${MN[next.getMonth()]}</span><b class="num">${c.day}</b></div>
          <div class="grow" style="min-width:180px">
            <span class="th">Дараагийн илгээлт</span
            ><b class="block t18 num"
              >${next.getFullYear()}/${p2(next.getMonth() + 1)}/${p2(c.day)} · ${c.time}</b
            ><span class="muted t12 num"
              >1,248 айл · ${money(sum)} · төлөх хугацаа ${c.due} хоног</span
            >
          </div>
          <div class="right">
            <b class="num t24 accc">${c.auto ? days + ' өдөр' : '—'}</b
            ><span class="block muted t12 b">үлдлээ</span>
          </div>
        </div>
        <div class="cols gs c1 sm-c3">
          <label class="field">Сар бүрийн өдөр${sel('day', [1, 5, 10, 15, 20, 25], c.day)}</label>
          <label class="field"
            >Илгээх цаг${sel('time', ['08:00', '09:00', '10:00', '12:00', '18:00'], c.time)}</label
          >
          <label class="field"
            >Төлөх хугацаа${sel('due', [7, 10, 15], c.due, (d) => d + ' хоногийн дотор')}</label
          >
        </div>
        ${[
          ['remBefore', 'Төлөх хугацаа дуусахаас 3 хоногийн өмнө сануулга'],
          ['remAfter', 'Хугацаа хэтэрмэгц өдөр бүр сануулга (3 удаа)'],
          ['remSms', 'Апп мэдэгдэлтэй хамт SMS илгээх'],
        ].map(
          ([k, l]) =>
            html`<div class="flex ic g3 t13 semi">${switchBtn(c[k], 'invToggle', k, l)}${l}</div>`,
        )}
        <div class="bt pt3 col g2">
          <span class="th">Өмнөх автомат илгээлтүүд</span> ${[
            ['10/01 · 09:00', '1,248 нэхэмжлэл · ₮96.8M', '86% төлсөн'],
            ['09/01 · 09:00', '1,248 нэхэмжлэл · ₮96.2M', '97% төлсөн'],
            ['08/01 · 09:00', '1,246 нэхэмжлэл · ₮95.8M', '99% төлсөн'],
          ].map(
            (h) =>
              html`<div class="flex wrap ic g3 t13">
                <span class="chip icon s round c-ok" style="width:24px;height:24px"
                  >${ic('check', 13)}</span
                ><b class="num" style="width:112px">${h[0]}</b
                ><span class="muted grow num">${h[1]}</span><b class="num">${h[2]}</b>
              </div>`,
          )}
        </div>
        <button class="link self-start" data-act="runInv">Туршилтаар одоо ажиллуулах →</button>
      </section>
      <aside class="card p0 ovh xl-sticky">
        <div class="inv-head">
          <span class="t12 b" style="opacity:.85">НЭХЭМЖЛЭЛИЙН ЗАГВАР · INV-2026-1024</span
          ><b class="block t18">2026 оны 10 сарын СӨХ төлбөр</b>
        </div>
        <div class="p5 col g3 t13">
          ${[
            ['СӨХ-ийн сарын хураамж', 50000],
            ['Лифт', 10000],
            ['Дундын цахилгаан', 5000],
            ['Ус', 12000],
            ['Өмнөх сарын өр', 20000],
          ].map(
            ([l, v]) =>
              html`<div class="flex jb"><span>${l}</span><b class="num">${money(v)}</b></div>`,
          )}
          <div class="inv-sum flex jb ib"><b>Нийт</b><b class="num t24">₮97,000</b></div>
          <p class="faint t12 flex g2">
            ${ic('calendar', 14)}QPay, SocialPay, банкны аппаар төлнө. Төлмөгц eBarimt автоматаар
            очно.
          </p>
        </div>
      </aside>
    </div>`;
  }

  function payments() {
    const s = st();
    const debtors = debtorsOf().sort((a, b) => b.amt + b.prev - (a.amt + a.prev));
    const out = debtors.reduce((a, u) => a + u.amt + u.prev, 0);
    return html`<div class="col g4">
      <div class="cols gs c2 lg-c4">
        ${[
          ['Өнөөдөр орсон', money(s.payments.reduce((a, p) => a + p.amt, 0)), 'okc'],
          ['Өртэй айл', nf(debtors.length), 'badc'],
          ['Нийт үлдэгдэл', money(out), 'badc'],
          ['Хугацаа хэтэрсэн', nf(debtors.filter((u) => u.st === 1).length), 'warnc'],
        ].map(
          ([l, v, c]) =>
            html`<div class="card p4">
              <span class="muted t12 semi">${l}</span><b class="${'block num t24 ' + c}">${v}</b>
            </div>`,
        )}
      </div>
      ${seg(
        [
          ['debt', 'Өр төлбөр'],
          ['pay', 'Орж ирсэн төлбөр'],
        ],
        ui.payTab,
        'payTab',
      )}
      ${ui.payTab === 'debt'
        ? html`<section class="card pad ovx">
            <div class="tbl" style="min-width:560px">
              <div class="flex jb ic mb2">
                <h2 class="h2">Өртэй айлууд</h2>
                <button class="btn s p" data-act="remindAll">Бүгдэд сануулга илгээх</button>
              </div>
              <div class="rows">
                <div class="r head th g-debt">
                  <span>Тоот</span><span>Өмчлөгч</span><span>Төлөв</span
                  ><span class="right">Дүн</span><span></span>
                </div>
                ${debtors.slice(0, 14).map((u) => {
                  const k = u.b + '-' + u.n;
                  return html`<div class="r trow g-debt" data-key="${k}">
                    <b class="num">${u.b}-р · ${u.n}</b><span>${u.owner}</span
                    ><span class="${'chip self-start ' + (u.st === 1 ? 'c-bad' : 'c-warn')}"
                      >${u.st === 1 ? 'Хугацаа хэтэрсэн' : 'Төлөөгүй'}</span
                    ><b class="num right">${money(u.amt + u.prev)}</b
                    ><button
                      class="btn s"
                      data-act="remind"
                      data-arg="${k}"
                      ${s.reminded[k] ? Nar.raw('disabled') : ''}
                    >
                      ${s.reminded[k] ? '✓ Илгээсэн' : 'Сануулга'}
                    </button>
                  </div>`;
                })}
              </div>
            </div>
          </section>`
        : html`<section class="card pad ovx">
            <div style="min-width:620px">
              <div class="flex jb ic mb2">
                <h2 class="h2">Орж ирсэн төлбөр</h2>
                <span class="chip c-bad"><span class="dot bad pulse2"></span>LIVE</span>
              </div>
              <div class="rows">
                ${s.payments.map(
                  (p) =>
                    html`<div class="r trow g-pay view-in" data-key="${p.inv + p.time}">
                      <span class="num muted">${p.time}</span><b class="num">${p.inv}</b
                      ><span>${p.unit} · ${p.name}</span><span class="muted">${p.ch}</span
                      ><b class="num okc right">+${money(p.amt)}</b
                      ><span class="chip c-ok" style="justify-self:end">✓ Баталгаажсан</span>
                    </div>`,
                )}
              </div>
            </div>
          </section>`}
    </div>`;
  }

  const REV = [88.2, 90.1, 91.4, 92.0, 94.8, 96.8],
    EXP = [51.2, 50.4, 53.9, 52.1, 54.6, 52.7],
    MM = ['5-р', '6-р', '7-р', '8-р', '9-р', '10-р'];
  const RC = [
    ['СӨХ төлбөр', 87.1],
    ['Зогсоол', 5.8],
    ['Торгууль', 1.5],
    ['Түрээс · бусад', 2.4],
  ];
  const EC = [
    ['Цалин', 21.4],
    ['Цахилгаан', 8.2],
    ['Засвар', 6.8],
    ['Ус', 4.9],
    ['Харуул', 4.1],
    ['Цэвэрлэгээ', 3.6],
    ['Лифт', 2.9],
    ['Бусад', 0.8],
  ];
  function finance() {
    const r = REV[5],
      e = EXP[5];
    const struct = (t, L, cls) => {
      const mx = Math.max(...L.map((x) => x[1]));
      return html`<div class="col g3">
        <span class="${'th ' + cls}">${t}</span>${L.map(
          ([l, v]) =>
            html`<div class="col g1">
              <div class="flex jb t12"><span class="semi">${l}</span><b class="num">₮${v}M</b></div>
              <div class="bar thin">
                <i
                  class="${cls === 'okc' ? 'okbg' : 'badbg'}"
                  style="${'width:' + (v / mx) * 100 + '%'}"
                ></i>
              </div>
            </div>`,
        )}
      </div>`;
    };
    return html`<div class="col g4">
      <div class="cols gs c1 sm-c3">
        <div class="card p5">
          <span class="th">Орлого · 10-р сар</span><b class="block num t30 okc">₮${r}M</b>
        </div>
        <div class="card p5">
          <span class="th">Зарлага · 10-р сар</span><b class="block num t30 badc">₮${e}M</b>
        </div>
        <div class="card p5 acc-card">
          <span class="th">Цэвэр үлдэгдэл</span><b class="block num t30">₮${(r - e).toFixed(1)}M</b>
        </div>
      </div>
      <div class="cols c1 xl-split2">
        <section class="card p5 col g4">
          <div class="flex wrap jb g2">
            <h2 class="h2">Орлого ба зарлага · 6 сар</h2>
            <div class="flex g3 t12 muted">
              <span class="flex ic g1"><i class="lg-sq accbg"></i>Орлого</span
              ><span class="flex ic g1"><i class="lg-sq warnbg"></i>Зарлага</span>
            </div>
          </div>
          <div class="chart">
            ${REV.map(
              (v, i) =>
                html`<div class="chart-col" title="${'₮' + v + 'M / ₮' + EXP[i] + 'M'}">
                  <i class="accbg" style="${'height:' + v + '%'}"></i
                  ><i class="warnbg" style="${'height:' + EXP[i] + '%'}"></i>
                </div>`,
            )}
          </div>
          <div class="chart-x">${MM.map((m) => html`<span>${m} сар</span>`)}</div>
        </section>
        <section class="card p5 cols c1 sm-c2">
          ${struct('Орлогын бүтэц', RC, 'okc')}${struct('Зарлагын бүтэц', EC, 'badc')}
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------ Ил тод тайлан ------------------------------ */
  // СӨХ-ийн сан дутвал бүх хуудасны дээд талд байнга хөдөлж анхааруулна
  function fundBanner() {
    const f = S.fund();
    if (!f.short) return '';
    const pct = Math.round(f.cover * 100);
    return html`<div class="fund-alert view-in" role="alert">
      <span class="fa-ic">${ic('coins', 22)}</span>
      <div class="grow col g1 fa-txt">
        <b class="t14">СӨХ-ийн сан ${money(f.short)} дутуу байна</b>
        <span class="t12 fa-sub"
          >Энэ сард төлөх ${money(f.due)} зардлын ${pct}%-ийг л хангаж байна · ${nf(f.debtors)} айл
          ${money(f.debt)} өртэй</span
        >
        <div class="fa-bar"><i style="${'width:' + pct + '%'}"></i></div>
      </div>
      <div class="flex g2 fa-btns">
        <button class="btn s" data-act="remindAll">Сануулга илгээх</button
        ><a href="#/report" class="btn s p">Тайлан</a>
      </div>
    </div>`;
  }

  function report() {
    const s = st();
    const f = S.fund();
    const m = ui.repM;
    const isCur = m === D.CUR_MONTH;
    const L = s.ledger.filter((x) => x.month === m);
    const Wk = s.works.filter((x) => x.month === m);
    const pub = s.reportPub[m];
    const opt = (list, cur) =>
      list.map(
        (c) => html`<option value="${c}" ${c === cur ? Nar.raw('selected') : ''}>${c}</option>`,
      );
    return html`<div class="col g4">
      <div class="flex wrap g3 jb ic">
        <div>
          <h2 class="h2">СӨХ-ийн сан ба ил тод байдал</h2>
          <p class="muted t12">
            Энд оруулсан зарлага, хийсэн ажил бүх оршин суугчид тэр дороо харагдаж, мэдэгдэл очно.
          </p>
        </div>
        <a href="#/payments" class="btn s">${ic('users', 15)}Хэн төлсөн бэ →</a>
      </div>
      ${Report.fundStats(f)}
      <section class="card pad col g2">
        <div class="flex jb ic mb1">
          <h2 class="h2">Энэ сард төлөх зардал</h2>
          <span class="muted t12 num">${money(f.due)} үлдсэн</span>
        </div>
        ${s.obligations.map(
          (o) =>
            html`<div class="trow flex ic g3 p2 t13" data-key="${o.id}">
              <span class="${'chip icon s ' + (o.paid ? 'c-ok' : 'c-warn')}"
                >${ic(o.paid ? 'ok' : 'clock', 15)}</span
              >
              <div class="grow">
                <b class="block">${o.t}</b
                ><span class="muted t12">${o.cat} · хугацаа ${o.due}</span>
              </div>
              <b class="num nowrap">${money(o.amt)}</b>
              ${o.paid
                ? html`<span class="chip c-ok">Төлсөн</span>`
                : html`<button class="btn s" data-act="payOb" data-arg="${o.id}">Төлөх</button>`}
            </div>`,
        )}
      </section>
      <div class="flex wrap g2 jb ic">
        ${seg(D.MONTHS, m, 'repM')}
        <div class="flex wrap ic g2">
          ${pub
            ? html`<span class="chip c-ok">${ic('ok', 13)}Нийтлэгдсэн · ${pub}</span>`
            : html`<span class="chip c-warn">Тайлан нийтлээгүй</span>`}
          <button class="btn s p" data-act="pubReport">
            ${ic('megaphone', 15)}${Report.mLabel(m)}ын тайланг нийтлэх
          </button>
        </div>
      </div>
      <div class="cols c1 xl-split2">
        <section class="card pad col g3">
          <div class="flex jb ic">
            <h2 class="h2">Зарлага · юунд зарцуулав</h2>
            <b class="num badc">−${money(Report.sum(L))}</b>
          </div>
          ${L.length ? Report.catBars(L) : ''}
          ${isCur
            ? html`<div class="add-box col g2">
                <span class="th">Шинэ зарлага нийтлэх</span>
                <div class="cols gs c1 sm-c2">
                  <label class="field"
                    >Ангилал<select class="inp" data-change="expCat">
                      ${opt(D.EXP_CATS, ui.exp.cat)}
                    </select></label
                  ><label class="field"
                    >Дүн (₮)<input
                      class="inp num"
                      inputmode="numeric"
                      data-in="expAmt"
                      placeholder="1,250,000"
                  /></label>
                </div>
                <label class="field"
                  >Юунд зарцуулсан<input
                    class="inp"
                    data-in="expT"
                    placeholder="Жишээ: 3-р байрны орцны хаалга солив"
                /></label>
                <label class="field"
                  >Хэнд төлсөн<input class="inp" data-in="expV" placeholder="Байгууллагын нэр"
                /></label>
                <button class="btn p self-start" data-act="addExp">${ic('plus', 15)}Нийтлэх</button>
              </div>`
            : ''}
          ${Report.ledgerRows(L)}
        </section>
        <section class="card pad col g3">
          <div class="flex jb ic">
            <h2 class="h2">Хийсэн ажил</h2>
            <span class="chip c-acc num">${Wk.length} ажил</span>
          </div>
          <p class="muted t12 flex ic g2">
            ${ic('info', 14)}Ажилтан ажлаа "шийдэгдсэн" гэж батлахад энд автоматаар нэмэгдэнэ.
          </p>
          ${isCur
            ? html`<div class="add-box col g2">
                <span class="th">Хийсэн ажил нэмэх</span>
                <div class="cols gs c1 sm-c2">
                  <label class="field"
                    >Төрөл<select class="inp" data-change="wkCat">
                      ${opt(D.WORK_CATS, ui.wk.cat)}
                    </select></label
                  ><label class="field"
                    >Хаана<input class="inp" data-in="wkWhere" placeholder="Жишээ: 3-р байр"
                  /></label>
                </div>
                <label class="field"
                  >Юу хийсэн<input
                    class="inp"
                    data-in="wkT"
                    placeholder="Жишээ: Подвалын гэрэлтүүлгийг шинэчилсэн"
                /></label>
                <button class="btn p self-start" data-act="addWork">${ic('plus', 15)}Нэмэх</button>
              </div>`
            : ''}
          ${Report.workRows(Wk)}
        </section>
      </div>
      <section class="card pad col g3">
        <div class="flex wrap jb ic g2">
          <h2 class="h2">Төлбөрийн гүйцэтгэл · байраар</h2>
          <span class="muted t12">Оршин суугчид айлын нэргүйгээр, зөвхөн байрны хувиар харна</span>
        </div>
        ${Report.bldRates(S.units)}
      </section>
    </div>`;
  }
  // маягтын талбаруудыг цэвэрлэнэ (input-ийн утгыг morph өөрчилдөггүй)
  const clearInputs = (prefix) =>
    document.querySelectorAll('[data-in^="' + prefix + '"]').forEach((el) => (el.value = ''));

  /* ------------------------------ Орон сууц ------------------------------ */
  const DOT = ['okbg', 'warnbg', 'badbg'];
  function residents() {
    const L = S.units[ui.b - 1];
    const u = ui.unit ? L[ui.unit - 1] : null;
    const q = ui.q.trim().toLowerCase();
    const found = q
      ? S.units
          .flat()
          .filter(
            (x) =>
              x.owner.toLowerCase().includes(q) ||
              (x.plate || '').toLowerCase().includes(q) ||
              String(x.n) === q,
          )
          .slice(0, 8)
      : [];
    const BB = BUILDINGS[ui.b - 1];
    const nf0 = Math.ceil(BB.units / BB.per);
    const floors = Array.from({ length: nf0 }, (_, i) => nf0 - i);
    return html`<div class="cols c1 xl-side" style="--sw:360px">
      <section class="card pad col g3">
        <div class="flex wrap g2 jb ic">
          ${seg(
            BN.map((n) => [n, n + '-р байр']),
            ui.b,
            'resB',
          )}
          <label class="inp-icon search-box"
            >${ic('search', 16)}<input
              class="inp"
              style="height:40px"
              data-in="resQ"
              placeholder="Нэр, тоот, машины дугаар"
              value="${ui.q}"
          /></label>
        </div>
        ${found.length
          ? html`<div class="col g1 p2 soft-box">
              ${found.map(
                (x) =>
                  html`<button
                    class="trow flex g2 p2 t13"
                    data-act="pickUnit"
                    data-arg="${x.b + '-' + x.n}"
                  >
                    <b class="num" style="width:64px">${x.b}-${x.n}</b
                    ><span class="grow">${x.owner}</span><span class="num muted">${x.plate}</span>
                  </button>`,
              )}
            </div>`
          : ''}
        <div class="ovx">
          <div class="floors" style="${'--per:' + BB.per}">
            ${floors.map(
              (f) =>
                html`<div class="flex ic g2">
                  <span class="fl-n num">${f}</span>
                  <div class="fl-row">
                    ${L.filter((x) => x.floor === f).map(
                      (x) =>
                        html`<button
                          class="${cx('unit', DOT[x.st], ui.unit === x.n && 'sel')}"
                          data-act="unit"
                          data-arg="${x.n}"
                          title="${x.n + ' тоот · ' + x.owner}"
                        >
                          ${x.n}
                        </button>`,
                    )}
                  </div>
                </div>`,
            )}
          </div>
        </div>
        <div class="flex g4 t12 muted">
          ${['Төлсөн', 'Хугацаа хэтэрсэн', 'Төлөөгүй'].map(
            (l, i) =>
              html`<span class="flex ic g1"><i class="${'lg-sq ' + DOT[i]}"></i>${l}</span>`,
          )}
        </div>
      </section>
      <aside class="card p5 col g3 xl-sticky">
        ${u
          ? html`<span class="th">${ui.b}-р байр · ${u.floor}-р давхар</span
              ><b class="t24">${u.n} тоот</b>
              <span class="${'chip self-start ' + ['c-ok', 'c-warn', 'c-bad'][u.st]}"
                >${['Төлсөн', 'Хугацаа хэтэрсэн', 'Төлөөгүй'][u.st]}</span
              >
              ${[
                ['Өмчлөгч', u.owner],
                ['Түрээслэгч', u.tenant || '—'],
                ['Утас', u.phone],
                ['Автомашин', u.plate || '—'],
                ['Энэ сарын төлбөр', money(u.amt)],
                ['Өмнөх өр', u.prev ? money(u.prev) : '—'],
              ].map(
                ([k, v]) =>
                  html`<div class="flex jb t13 bb pb2">
                    <span class="muted">${k}</span><b class="num">${v}</b>
                  </div>`,
              )}`
          : html`<p class="muted">Тоот сонгоно уу</p>`}
      </aside>
    </div>`;
  }

  /* ------------------------------ Зогсоол ------------------------------ */
  const SL = ['Сул', 'Эзэмшсэн', 'Зочин · түр', 'Захиалсан'];
  const SLT = ['c-ok', 'c-mute', 'c-warn', 'c-acc'];
  const parkScenes = {};
  function parking() {
    const nP = Layout.slots(D.LAYOUT),
      nG = D.LAYOUT.garage;
    if (!nG) ui.zone = 'p';
    const z = st().slots.filter((s) => s.zone === ui.zone);
    const n = (k) => z.filter((s) => s.st === k).length;
    const cur = ui.selSlot ? st().slots.find((s) => s.id === ui.selSlot) : null;
    return html`<div class="col g4">
      <div class="flex wrap g2 jb ic">
        ${seg(
          [
            ['p', 'Гадна зогсоол · ' + nP + ' байр'],
            nG ? ['g', 'Газар доорх гараж · ' + nG + ' байр'] : null,
          ].filter(Boolean),
          ui.zone,
          'zone',
        )}
        <div class="flex wrap g2">
          ${SL.map(
            (l, k) =>
              html`<span class="${'chip lg ' + SLT[k]}">${l} · <b class="num">${n(k)}</b></span>`,
          )}<span class="chip lg c-bad"
            >Мэдрэгч асуудалтай · ${z.filter((s) => s.sens !== 'ok').length}</span
          >
        </div>
      </div>
      <div class="cols c1 xl-side" style="--sw:320px">
        <section class="card p0 ovh park-box">
          ${Nar.keep('park-' + ui.zone, 'fill')}
          <div class="map-title">
            <b class="t20 b9">${ui.zone === 'p' ? 'Гадна зогсоол' : 'Газар доорх гараж'}</b>
          </div>
        </section>
        <section class="card p4 col g3">
          <span class="th">Сонгосон зогсоол</span>
          ${cur
            ? html`<b class="t30 num">${cur.id}</b
                ><span class="${'chip self-start ' + SLT[cur.st]}">${SL[cur.st]}</span> ${[
                  ['Машин', cur.plate || '—'],
                  ['Айл', cur.unit || (cur.st === 2 ? 'Зочин' : '—')],
                  [
                    'Мэдрэгч',
                    cur.sens === 'off'
                      ? 'Холбогдохгүй'
                      : cur.sens === 'low'
                        ? 'Цэнэг ' + cur.bat + '%'
                        : 'Онлайн',
                  ],
                ].map(
                  ([k, v]) =>
                    html`<div class="flex jb t13">
                      <span class="muted">${k}</span><b class="num">${v}</b>
                    </div>`,
                )}`
            : html`<p class="muted t13">
                3D зураг дээрх зогсоол дээр дарна уу. Чирж эргүүлэх, scroll-оор томруулж болно.
              </p>`}
          <p class="faint t12 bt pt3">
            Зогсоол бүрийн доор мэдрэгч бий. Машин ирэх, гарахыг автоматаар бүртгэж, хүлээлгийн
            жагсаалтын эхний хүнд мэдэгдэнэ.
          </p>
        </section>
      </div>
    </div>`;
  }
  function parkAfter() {
    const k = ui.zone;
    if (!parkScenes[k])
      parkScenes[k] = Scenes.parking(Nar.host('park-' + k), {
        zone: k,
        onPick: (s) => set({ selSlot: s.id }),
      });
    parkScenes[k].update({ slots: st().slots, selected: ui.selSlot });
  }

  /* ------------------------------ Хүсэлт ------------------------------ */
  const COL = ['badbg', 'accbg', 'warnbg', 'faintbg', 'okbg'];
  function requests() {
    const s = st();
    const now = Date.now();
    const late = (q) => q.st <= 1 && now - q.stAt >= ui.sla * 60000;
    return html`<div class="col g4">
      <section class="card p4 flex wrap ic g3">
        <span class="chip icon c-acc">${ic('clock', 17)}</span>
        <div class="grow" style="min-width:200px">
          <b class="t13">SLA · хүлээн авах хугацаа</b>
          <p class="muted t12">
            Хугацаандаа хүлээн аваагүй бол ангиллын бүх ажилтанд автомат сануулга очно
          </p>
        </div>
        ${seg(
          [15, 30, 60, 120].map((m) => [m, m < 60 ? m + ' мин' : m / 60 + ' цаг']),
          ui.sla,
          'sla',
        )}
      </section>
      <div class="cols gs c1 sm-c2 xl-c5">
        ${REQ_STATUS.map((l, k) => {
          const items = s.reqs.filter((x) => x.st === k);
          return html`<section class="kan">
            <div class="flex ic g2 p2">
              <i class="${'dot ' + COL[k]}"></i><b class="t13 grow">${l}</b
              ><span class="chip c-mute">${items.length}</span>
            </div>
            ${items.map(
              (x) =>
                html`<button
                  class="${cx('card lift p3 col g1 kan-card', late(x) && 'hot')}"
                  data-act="openReq"
                  data-arg="${x.id}"
                  data-key="${x.id}"
                >
                  <div class="flex jb">
                    <span class="num faint t11 b">${x.id}</span>${prio(x.p)}
                  </div>
                  <b class="t13">${x.title}</b
                  ><span class="muted t12">${x.b}-р байр · ${x.u} тоот · ${x.cat}</span>
                  <div class="flex jb t11">
                    <span class="muted">${x.by || 'Хуваарилаагүй'}</span
                    ><span class="${cx('num b', late(x) ? 'badc' : 'faint')}"
                      >${late(x) ? 'SLA хэтэрсэн · ' : ''}${ago(now - x.stAt)}</span
                    >
                  </div>
                </button>`,
            )}
          </section>`;
        })}
      </div>
    </div>`;
  }
  let openReqId = null;
  function reqDrawer() {
    const q = st().reqs.find((x) => x.id === openReqId);
    if (!q) return '';
    return html`<div class="flex jb">
        <span class="num faint t12 b">${q.id} · ${q.cat}</span
        ><button data-act="__close" aria-label="Хаах">${ic('x', 18)}</button>
      </div>
      <h2 class="t20 b">${q.title}</h2>
      <p class="muted t13">
        ${q.b}-р байр · ${q.u} тоот ·
        ${q.from === 'resident' ? 'Оршин суугчаас' : q.from === 'sensor' ? 'Мэдрэгчээс' : 'Админ'}
      </p>
      <div class="card flat p3 t13">${q.desc}</div>
      <div class="flex wrap g1">
        ${REQ_STATUS.map(
          (l, i) =>
            html`<button
              class="${cx('chip lg', q.st === i ? 'c-solid' : 'c-mute')}"
              data-act="reqSt"
              data-arg="${q.id + ':' + i}"
            >
              ${l}
            </button>`,
        )}
      </div>
      <div class="col g1">
        <span class="th">Ажилтан оноох</span>${st()
          .staff.filter((s) => s.cat === q.cat || q.cat === 'Засвар')
          .slice(0, 4)
          .map(
            (s) =>
              html`<button
                class="${cx('trow flex ic g3 p2 t13', q.by === s.n && 'acc-soft')}"
                data-act="assign"
                data-arg="${q.id + ':' + s.n}"
              >
                <span class="avatar soft">${s.n.split(' ')[1].slice(0, 2)}</span
                ><span class="grow"
                  ><b>${s.n}</b
                  ><span class="block muted t12"
                    >${s.role} · ${s.on ? 'Ээлжинд' : 'Амралттай'}</span
                  ></span
                >${q.by === s.n ? html`<span class="chip c-acc">Хариуцсан</span>` : ''}
              </button>`,
          )}
      </div>`;
  }

  function staffView() {
    const s = st();
    return html`<div class="cols gs c1 sm-c2 lg-c3 xl-c4">
      ${s.staff.map((p) => {
        const mine = s.reqs.filter((q) => q.by === p.n && q.st < 4);
        return html`<section class="card p4 col g3">
          <div class="flex ic g3">
            <span class="avatar"
              >${p.n.split(' ')[1].slice(0, 2)}<i class="${cx('on', !p.on && 'off')}"></i
            ></span>
            <div class="grow">
              <b class="block trunc">${p.n}</b><span class="muted t12">${p.role} · ${p.id}</span>
            </div>
          </div>
          <div class="cols gs c3 center">
            <div class="mini"><b class="num block">${mine.length}</b><span>Идэвхтэй</span></div>
            <div class="mini"><b class="num block">${p.done}</b><span>Энэ сар</span></div>
            <div class="mini">
              <b class="num flex ic jc g1"
                >${p.rating.toFixed(1)}<span class="star">${ic('star', 12)}</span></b
              ><span>Үнэлгээ</span>
            </div>
          </div>
          ${mine[0]
            ? html`<p class="t12 muted trunc">
                Одоо: <b style="color:var(--ink)">${mine[0].title}</b>
              </p>`
            : ''}
        </section>`;
      })}
    </div>`;
  }

  /* ------------------------- Хотхоны бүтэц (layout model) ------------------------- */
  // Хотхоноо үгээр тайлбарлахад model (Layout.parse → Layout.generate) map, зогсоолыг зохион байгуулна.
  // Админ зөвхөн өөрийн хотхоны (D.LAYOUT.id) map-ыг харж, засна — бусад хотхонд хүрэхгүй.
  const LY_EX = [
    '8 байр, 12-20 давхар, 60 зогсоол, тоглоомын талбай, гараж 30',
    '12 байр, 16 давхар, 96 машины зогсоол, спорт талбай, газар доорх гараж 80',
    '4 байр нэг эгнээ, 9 давхар, давхартаа 6 айл, 24 зогсоол',
    '5 bair 20-24 davhar 40 zogsool togloomyn talbai',
  ];
  const DOORS = [
    ['n', 'Хойд'],
    ['s', 'Урд'],
    ['w', 'Баруун'],
    ['e', 'Зүүн'],
  ];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  /** Хотхоны таних мэдээлэл (id, нэр, дүүрэг, өнгө) үргэлж өөрийнх хэвээр үлдэнэ */
  const own = (L) =>
    Object.assign(L, {
      id: D.LAYOUT.id,
      n: D.LAYOUT.n,
      sokh: D.LAYOUT.sokh,
      d: D.LAYOUT.d,
      c: D.LAYOUT.c,
    });
  const lyState = () =>
    ui.ly || (ui.ly = { text: '', L: clone(D.LAYOUT), got: [], sel: null, saved: true });
  const lySpec = () => Object.assign({}, Layout.DEF, lyState().L.spec || {});
  /** spec-ийн нэг утгыг өөрчлөөд map-ыг дахин үүсгэнэ (id, нэр, өнгө хадгалагдана) */
  function lyRegen(patch) {
    const y = lyState();
    const sp = Object.assign(lySpec(), { manual: false }, patch);
    sp.floors = [Math.min(sp.floors[0], sp.floors[1]), Math.max(sp.floors[0], sp.floors[1])];
    y.L = own(Layout.generate(sp));
    y.sel = null;
    y.saved = false;
    set({});
  }
  /* ---------- Builder: 2D дээр чирж зөөх, palette-аас чирж нэмэх, 3D preview ---------- */
  const LY_PAL = [
    ['b', 'Байр', 'building'],
    ['lot', 'Зогсоол', 'car'],
    ['play', 'Тоглоомын талбай', 'party'],
    ['sport', 'Спорт талбай', 'star'],
  ];
  /** дэлгэцийн цэгийг SVG (map) координат руу */
  const lyPt = (svg, e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  let lyDrag = null;
  document.addEventListener('pointerdown', (e) => {
    const g = e.target.closest && e.target.closest('.ly-svg [data-drag]');
    if (!g || !ui.ly) return;
    const svg = g.ownerSVGElement,
      o = Layout.itemOf(ui.ly.L, g.dataset.drag);
    if (!o) return;
    lyDrag = {
      key: g.dataset.drag,
      g,
      svg,
      p0: lyPt(svg, e),
      o,
      dx: 0,
      dz: 0,
      moved: false,
      id: e.pointerId,
    };
    try {
      svg.setPointerCapture(e.pointerId);
    } catch (err) {} // зарим төхөөрөмж дэмжихгүй
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    const d = lyDrag;
    if (!d || e.pointerId !== d.id) return;
    const p = lyPt(d.svg, e);
    d.dx = Math.round((p.x - d.p0.x) * 2) / 2;
    d.dz = Math.round((p.y - d.p0.y) * 2) / 2;
    if (Math.hypot(d.dx, d.dz) > 0.4) d.moved = true;
    if (!d.moved) return;
    // чирж байх үед DOM-ыг шууд хөдөлгөнө (дахин зурахгүй) — давхцвал улаан
    d.g.setAttribute('transform', 'translate(' + d.dx + ' ' + d.dz + ')');
    d.g.classList.add('drag');
    d.g.classList.toggle('bad', !Layout.canPlace(ui.ly.L, d.key, d.o.r.x + d.dx, d.o.r.z + d.dz));
  });
  const lyDrop = (e, cancel) => {
    const d = lyDrag;
    if (!d || e.pointerId !== d.id) return;
    lyDrag = null;
    const y = lyState();
    d.g.removeAttribute('transform');
    d.g.classList.remove('drag', 'bad');
    if (cancel) return;
    if (!d.moved) {
      y.sel = y.sel === d.key ? null : d.key;
      return set({});
    }
    const r = Layout.moveItem(y.L, d.key, d.o.r.x + d.dx, d.o.r.z + d.dz);
    if (!r.ok) S.toast('Зөөх боломжгүй', r.msg, 'warn');
    else {
      y.saved = false;
      y.sel = d.key;
    }
    set({});
  };
  document.addEventListener('pointerup', (e) => lyDrop(e));
  document.addEventListener('pointercancel', (e) => lyDrop(e, true));
  // palette → map руу чирж нэмэх (HTML5 drag & drop)
  document.addEventListener('dragstart', (e) => {
    const b = e.target.closest && e.target.closest('[data-add]');
    if (!b) return;
    e.dataTransfer.setData('text/plain', 'ly:' + b.dataset.add);
    e.dataTransfer.effectAllowed = 'copy';
  });
  document.addEventListener('dragover', (e) => {
    if (e.target.closest && e.target.closest('.ly-box')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  document.addEventListener('drop', (e) => {
    const box = e.target.closest && e.target.closest('.ly-box');
    const t = e.dataTransfer.getData('text/plain');
    if (!box || !t.startsWith('ly:')) return;
    e.preventDefault();
    const p = lyPt(box.querySelector('svg'), e);
    lyAddAt(t.slice(3), p.x, p.y);
  });
  function lyAddAt(kind, x, z) {
    const y = lyState();
    const r = Layout.addItem(y.L, kind, x, z);
    if (!r.ok) return S.toast('Нэмэх боломжгүй', r.msg, 'warn');
    y.sel = r.key;
    y.saved = false;
    set({});
    S.toast('Map засагдлаа', r.msg, 'ok');
  }
  /** Сонгосон объект дээр builder үйлдэл (эргүүлэх, устгах, зогсоолын тоо) */
  function lyItem(fn) {
    const y = lyState();
    if (!y.sel) return;
    const r = fn(y.L, y.sel);
    if (r && r.ok === false) return S.toast('Боломжгүй', r.msg || '', 'warn');
    y.saved = false;
    set({});
  }

  /* 3D preview — засаж буй layout-ыг жинхэнэ 3D map-аар харуулна */
  let ly3 = null,
    ly3key = '',
    ly3state = null;
  function lyPreviewState(L) {
    const r = Layout.rng(7);
    const n = Layout.slots(L);
    return {
      lights: L.lights.map((l, i) => ({ ...l, id: 'L' + i, st: 'on' })),
      leaks: [],
      units: L.buildings.map((b) =>
        Array.from({ length: b.units }, () => ({ st: r() < 0.85 ? 0 : 2, amt: 90000, prev: 0 })),
      ),
      slots: Array.from({ length: n }, (_, i) => ({
        id: 'P' + i,
        zone: 'p',
        st: r() < 0.6 ? 1 : 0,
        color: D.CAR_COLORS[i % D.CAR_COLORS.length],
        sens: 'ok',
      })),
      mode: 'light',
      night: false,
      selLight: null,
    };
  }
  function lyAfter() {
    const y = ui.ly;
    if (!y || y.view !== '3d') return;
    const key = JSON.stringify(y.L);
    if (!ly3 || key !== ly3key) {
      ly3key = key;
      if (ly3) ly3.dispose(); // хуучин WebGL-ийг чөлөөлнө
      const host = Nar.host('ly3d');
      host.innerHTML = '';
      ly3state = lyPreviewState(y.L);
      ly3 = Scenes.complex(host, {
        layout: y.L,
        onSelectB: (i) => {
          y.sel = i == null ? null : 'b:' + i;
          set({});
        },
        onSelectLight: () => {},
      });
    }
    const o = y.sel && y.sel.startsWith('b:') ? Number(y.sel.slice(2)) : null;
    ly3.update({ ...ly3state, selB: o });
  }

  /** Одоогийн map дээр хэсэгчилсэн засвар хийнэ (Layout.setSlots гэх мэт) */
  function lyEditMap(fn) {
    const y = lyState();
    const r = fn(y.L);
    y.sel = null;
    y.saved = false;
    set({});
    if (r && r.msg) S.toast(r.ok ? 'Map засагдлаа' : 'Анхааруулга', r.msg, r.ok ? 'ok' : 'warn');
  }
  function layoutView() {
    const y = lyState();
    const L = y.L;
    const sp = lySpec();
    if (!y.view) y.view = '2d';
    const O = y.sel ? Layout.itemOf(L, y.sel) : null;
    const edited = Layout.isEdited(L.id);
    const manual = L.spec && L.spec.manual;
    const hasPark = (k) => L.parks.some((p) => p.kind === k);
    const num = (k, v, min, max, lbl) =>
      html`<label class="field"
        >${lbl}<input
          class="inp num"
          type="number"
          min="${min}"
          max="${max}"
          value="${v}"
          data-change="lyNum"
          data-k="${k}"
      /></label>`;
    const stat = [
      ['Байр', L.buildings.length],
      ['Айл', nf(Layout.units(L))],
      ['Зогсоол', Layout.slots(L)],
      ['Гараж', L.garage || '—'],
      ['Гэрэл', L.lights.length],
      ['Мод', L.trees.length],
    ];
    return html`<div class="col g4">
      <div class="cols c1 xl-side" style="--sw:400px">
        <section class="card p4 col g3">
          <div class="flex wrap g2 jb ic">
            <div>
              <b class="t20 b9">${L.n}</b>
              <p class="muted t12">
                ${L.d ? L.d + ' дүүрэг · ' : ''}${L.size[0] * 10}×${L.size[1] * 10} м ·
                ${manual ? 'гараар зурсан map' : 'model үүсгэсэн map'}
                ${y.saved ? '' : ' · хадгалаагүй өөрчлөлттэй'}
              </p>
            </div>
            <div class="flex wrap g1">
              ${stat.map(
                ([k, v]) => html`<span class="chip c-mute">${k} · <b class="num">${v}</b></span>`,
              )}
            </div>
          </div>
          <div class="flex wrap g2 jb ic">
            <div class="flex wrap g1">
              ${LY_PAL.map(
                ([k, l, icn]) =>
                  html`<button
                    class="ly-pal"
                    draggable="true"
                    data-add="${k}"
                    data-act="lyAdd"
                    data-arg="${k}"
                    title="Map руу чирж тавина, эсвэл дарахад хоосон газар автоматаар нэмэгдэнэ"
                  >
                    ${ic(icn, 15)}${l}
                  </button>`,
              )}
            </div>
            ${seg(
              [
                ['2d', '2D · засах'],
                ['3d', '3D · харах'],
              ],
              y.view,
              'lyView',
            )}
          </div>
          ${y.view === '3d'
            ? html`<div class="ly-3d card p0 ovh">${Nar.keep('ly3d', 'fill')}</div>`
            : html`<div class="ly-box">${Nar.raw(Layout.svg(L, { drag: true, sel: y.sel }))}</div>`}
          <div class="flex wrap g3 t12 muted">
            <span><i class="ly-sw b"></i>Байр (тоо = дугаар, д = давхар)</span>
            <span><i class="ly-sw door"></i>Орц</span>
            <span><i class="ly-sw road"></i>Зам</span>
            <span><i class="ly-sw lot"></i>Зогсоол</span>
            <span><i class="ly-sw play"></i>Тоглоом / спорт</span>
            <span><i class="ly-sw light"></i>Гэрэл</span>
          </div>
          ${O
            ? html`<div class="soft-box p3 col g2 view-in">
                <div class="flex jb ic">
                  <b
                    >${O.t === 'b'
                      ? O.it.n + '-р байр · ' + O.it.units + ' айл'
                      : O.t === 'l'
                        ? 'Зогсоол · ' +
                          O.it.n +
                          ' байр (' +
                          O.it.aisles +
                          ' эгнээ × ' +
                          O.it.cols +
                          ')'
                        : O.it.kind === 'play'
                          ? 'Тоглоомын талбай'
                          : 'Спорт талбай'}</b
                  >
                  <button class="btn s sq" data-act="lySel" data-arg="" aria-label="Хаах">
                    ${ic('x', 14)}
                  </button>
                </div>
                ${O.t === 'b'
                  ? html`<div class="cols gs c2">
                        ${num('fl', O.it.fl, 1, 40, 'Давхар')}
                        ${num('per', O.it.per, 1, 30, 'Давхартаа айл')}
                      </div>
                      <span class="t12 muted">Орцны хаалга аль тал руу харах вэ</span>
                      ${seg(DOORS, O.it.door, 'lyDoor')}`
                  : ''}
                ${O.t === 'l'
                  ? html`<div class="flex ic g2">
                      <button class="btn sq" data-act="lySlot" data-arg="-2" aria-label="Хасах">
                        −
                      </button>
                      <input
                        class="inp num grow center"
                        type="number"
                        min="1"
                        max="160"
                        value="${O.it.n}"
                        data-change="lyLotN"
                      />
                      <button class="btn sq" data-act="lySlot" data-arg="2" aria-label="Нэмэх">
                        +
                      </button>
                    </div>`
                  : ''}
                <div class="flex g2">
                  ${O.t !== 'l'
                    ? html`<button class="btn s grow" data-act="lyRot">
                        ${ic('history', 14)}90° эргүүлэх
                      </button>`
                    : ''}
                  <button class="btn s grow" data-act="lyDel">${ic('x', 14)}Устгах</button>
                </div>
              </div>`
            : html`<p class="faint t12">
                Объектыг чирж зөөнө · дарж сонгоод давхар, зогсоолын тоо, орцыг засна · дээрх
                жагсаалтаас map руу чирж шинээр нэмнэ. Улаан болвол тэнд тавих боломжгүй.
              </p>`}
        </section>
        <aside class="card p5 col g3 xl-sticky">
          <span class="th">${L.n} · map үүсгэгч</span>
          <p class="muted t12">
            Хотхоноо энгийн үгээр тайлбарла. Model нь байр, зам, орц, зогсоолын эгнээ, машин орох
            зам, гэрэл, модыг өөрөө зохион байгуулна. Өөрчлөлт зөвхөн энэ хотхонд хамаарна.
          </p>
          <textarea
            class="inp ly-txt"
            rows="3"
            data-in="lyText"
            placeholder="Жишээ: 8 байр, 12-20 давхар, 60 зогсоол, тоглоомын талбай"
          >
${y.text}</textarea
          >
          <div class="flex wrap g1">
            ${LY_EX.map(
              (t, i) =>
                html`<button class="chip c-acc ly-ex" data-act="lyEx" data-arg="${i}" title="${t}">
                  Жишээ ${i + 1}
                </button>`,
            )}
          </div>
          <button class="btn p" data-act="lyGen">${ic('map', 16)}Map үүсгэх</button>
          ${y.got.length
            ? html`<div class="flex wrap g1 ic t12">
                <span class="muted">Ойлгосон:</span>${y.got.map(
                  (g) => html`<span class="chip c-ok">${g}</span>`,
                )}
              </div>`
            : ''}
          <div class="bt pt3 col g2">
            <span class="th">Нарийн тохируулга</span>
            <p class="faint t12">
              Зөвхөн өөрчилсөн хэсэг нь өөрчлөгдөнө — бусад байр, зам, талбай байрандаа үлдэнэ.
            </p>
            <div class="cols gs c2">
              ${num('buildings', L.buildings.length, 1, 24, 'Байрны тоо')}
              ${num('per', sp.per, 0, 24, 'Давхартаа айл (0=авто)')}
              ${num('f0', sp.floors[0], 2, 40, 'Давхар · доод')}
              ${num('f1', sp.floors[1], 2, 40, 'Давхар · дээд')}
              ${num('slots', Layout.slots(L), 0, 160, 'Гадна зогсоол')}
              ${num('garage', L.garage, 0, 120, 'Газар доорх гараж')}
            </div>
            <div class="flex jb ic t13">
              Тоглоомын талбай ${switchBtn(hasPark('play'), 'lyTgl', 'play', 'Тоглоомын талбай')}
            </div>
            <div class="flex jb ic t13">
              Спорт талбай ${switchBtn(hasPark('sport'), 'lyTgl', 'sport', 'Спорт талбай')}
            </div>
          </div>
          <div class="bt pt3 col g2">
            <span class="th">Бүхэлд нь шинээр үүсгэх</span>
            <p class="faint t12">Бүх байр, зам, зогсоолын байрлал шинээр зохиогдоно.</p>
            ${seg(
              [
                ['grid', 'Замын хоёр талд'],
                ['row', 'Нэг эгнээ'],
              ],
              sp.style,
              'lyStyle',
            )}
            <button class="btn" data-act="lySeed">
              ${ic('history', 16)}Map-ыг бүхэлд нь шинээр үүсгэх
            </button>
          </div>
          <div class="bt pt3 col g2">
            <button class="btn p" data-act="lySave" ${y.saved ? Nar.raw('disabled') : ''}>
              ${ic('check', 16)}${y.saved ? 'Хадгалагдсан' : 'Хадгалж map-аа шинэчлэх'}
            </button>
            ${y.saved
              ? ''
              : html`<button class="btn" data-act="lyDiscard">Өөрчлөлтийг болих</button>`}
            ${edited && y.saved
              ? html`<button class="btn" data-act="lyReset">
                  ${ic('history', 16)}Анхны map руу буцаах
                </button>`
              : ''}
            <div class="flex g2">
              <button class="btn s grow" data-act="lyDl">${ic('file', 14)}JSON татах</button>
              <label class="btn s grow ly-file"
                >${ic('plus', 14)}JSON оруулах<input
                  type="file"
                  accept=".json,application/json"
                  data-change="lyFile"
              /></label>
            </div>
          </div>
        </aside>
      </div>
    </div>`;
  }
  /** Хадгалаад хуудсыг дахин ачаална → 3D map, зогсоол, айлын жагсаалт шинэ map-аар */
  const lyReload = (t, m) => {
    S.toast(t, m, 'ok');
    setTimeout(() => location.reload(), 600);
  };
  const lyActions = {
    lyEx: (i) => {
      lyState().text = LY_EX[i];
      lyActions.lyGen();
    },
    lyGen: () => {
      const y = lyState();
      if (!y.text.trim())
        return S.toast('Тайлбар хоосон', 'Хотхоныхоо байр, давхар, зогсоолыг бичнэ үү', 'warn');
      const sp = Layout.parse(y.text);
      y.got = sp.got;
      y.L = own(Layout.generate(sp));
      y.sel = null;
      y.saved = false;
      set({});
      S.toast('Map үүслээ', sp.got.length ? sp.got.join(' · ') : 'Анхны тохиргоогоор', 'ok');
    },
    lySeed: () => lyRegen({ seed: (lySpec().seed || 1) + 1 }),
    lyTgl: (k) => lyEditMap((L) => Layout.setPark(L, k, !L.parks.some((p) => p.kind === k))),
    lyStyle: (v) => {
      // зөвхөн дараагийн "бүхэлд нь шинээр үүсгэх"-д хэрэглэнэ — одоогийн map хөдлөхгүй
      lyState().L.spec = Object.assign(lySpec(), { style: v });
      set({});
    },
    lySel: (k) => {
      lyState().sel = k || null;
      set({});
    },
    lyView: (v) => {
      lyState().view = v;
      set({});
    },
    lyAdd: (k) => lyAddAt(k), // дарвал хоосон газар автоматаар
    lyRot: () => lyItem((L, k) => Layout.rotateItem(L, k)),
    lyDel: () =>
      lyItem((L, k) => {
        lyState().sel = null;
        return Layout.removeItem(L, k);
      }),
    lySlot: (dlt) =>
      lyItem((L, k) => {
        const o = Layout.itemOf(L, k);
        return Layout.setLotSlots(L, o.i, Math.max(1, o.it.n + Number(dlt)));
      }),
    lyDoor: (v) =>
      lyItem((L, k) => {
        const o = Layout.itemOf(L, k);
        if (o && o.t === 'b') o.it.door = v;
      }),
    lySave: () => {
      Layout.save(own(lyState().L));
      lyReload(
        'Map шинэчлэгдлээ',
        D.LAYOUT.n + ' · map, зогсоол, айлын мэдээлэл шинэчлэгдэж байна…',
      );
    },
    lyDiscard: () => {
      ui.ly = null;
      set({});
    },
    lyReset: () => {
      Layout.reset(D.LAYOUT.id);
      lyReload('Анхны map сэргээгдлээ', D.LAYOUT.n);
    },
    lyDl: () => {
      const L = lyState().L;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify(L, null, 2)], { type: 'application/json' }),
      );
      a.download = (L.id || 'hothon') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
  const lyInputs = {
    lyText: (v) => (lyState().text = v),
    lyLotN: (v) =>
      lyItem((L, k) => Layout.setLotSlots(L, Layout.itemOf(L, k).i, Math.max(1, Number(v) || 1))),
    lyNum: (v, el) => {
      const k = el.dataset.k,
        n = Math.max(0, Math.round(Number(v) || 0));
      const y = lyState();
      const O = y.sel && Layout.itemOf(y.L, y.sel);
      if (O && O.t === 'b' && (k === 'fl' || k === 'per') && el.closest('.soft-box')) {
        // сонгосон нэг байрыг гараар засах
        const b = O.it;
        b[k] = Math.max(1, n);
        b.units = b.fl * b.per;
        y.saved = false;
        return set({});
      }
      const sp = lySpec();
      const F = {
        buildings: (L) => Layout.setBuildings(L, n),
        per: (L) => Layout.setPer(L, n),
        f0: (L) => Layout.setFloors(L, n, sp.floors[1]),
        f1: (L) => Layout.setFloors(L, sp.floors[0], n),
        // нийт тоо → эхний зогсоолын талбайд (бусад талбай хэвээр)
        slots: (L) =>
          Layout.setSlots(
            L,
            Math.max(
              L.lots.length > 1 ? 1 : 0,
              n - (Layout.slots(L) - (L.lots[0] ? L.lots[0].n : 0)),
            ),
          ),
        garage: (L) => Layout.setGarage(L, n),
      }[k];
      if (F) lyEditMap(F);
    },
    lyFile: (v, el) => {
      const f = el.files && el.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const L = own(Layout.normalize(JSON.parse(rd.result)));
          ui.ly = { text: '', L, got: [], sel: null, saved: false };
          set({});
          S.toast('Map оруулагдлаа', L.n + ' · ' + L.buildings.length + ' байр', 'ok');
        } catch (e) {
          S.toast('Файл буруу байна', e.message, 'bad');
        }
        el.value = '';
      };
      rd.readAsText(f);
    },
  };

  /* ------------------------------ boot ------------------------------ */
  Shell.boot({
    role: 'admin',
    brand: 'СӨХ Platform',
    sub: D.LAYOUT.n + ' · ' + NB + ' байр',
    mobile: 'drawer',
    nav: () => {
      const s = st();
      return [
        { h: '', label: 'Dashboard', icon: 'dashboard' },
        {
          h: 'leak',
          label: 'Ус алдалт',
          icon: 'droplet',
          badge: s.leaks.filter((x) => x.st !== 'fixed').length,
        },
        {
          h: 'map',
          label: 'Хотхоны map',
          icon: 'map',
          badge: s.lights.filter((l) => l.st === 'off').length,
        },
        {
          h: 'invoices',
          label: 'Санхүү',
          icon: 'wallet',
          kids: [
            { h: 'invoices', label: 'Нэхэмжлэл' },
            { h: 'payments', label: 'Төлбөр · өр' },
            { h: 'finance', label: 'Орлого · Зарлага' },
          ],
        },
        {
          h: 'report',
          label: 'Ил тод тайлан',
          icon: 'chart',
          badge: S.fund().short ? '!' : 0,
        },
        { h: 'residents', label: 'Орон сууц', icon: 'building' },
        { h: 'parking', label: 'Зогсоол', icon: 'car' },
        { h: 'layout', label: 'Хотхоны бүтэц', icon: 'pin' },
        {
          h: 'requests',
          label: 'Хүсэлт',
          icon: 'wrench',
          badge: s.reqs.filter((q) => q.st === 0).length,
        },
        { h: 'staff', label: 'Ажилтан', icon: 'users' },
      ];
    },
    routes: {
      '': {
        title: 'Удирдлагын самбар',
        topics: ['reqs', 'leaks', 'lights', 'slots', 'remind', 'pay'],
        view: dashboard,
      },
      leak: { title: 'Ус алдалтын хяналт', topics: ['leaks'], view: leak },
      map: {
        title: 'Хотхоны 3D map',
        topics: ['lights', 'leaks', 'pay', 'reqs', 'slots'],
        view: mapView,
        after: mapAfter,
      },
      invoices: { title: 'Автомат нэхэмжлэл', topics: ['invoice'], view: invoices },
      payments: { title: 'Төлбөр ба өр', topics: ['payments', 'remind', 'pay'], view: payments },
      finance: { title: 'Орлого · Зарлага', view: finance },
      report: {
        title: 'Ил тод тайлан',
        topics: ['ledger', 'works', 'fund', 'pay', 'payments'],
        view: report,
      },
      residents: { title: 'Байр ба оршин суугч', topics: ['pay'], view: residents },
      parking: { title: 'Зогсоол · 3D', topics: ['slots'], view: parking, after: parkAfter },
      layout: { title: 'Хотхоны бүтэц · map builder', view: layoutView, after: lyAfter },
      requests: { title: 'Хүсэлт ба SLA', topics: ['reqs', 'tick'], view: requests },
      staff: { title: 'Ажилтан', topics: ['reqs'], view: staffView },
    },
    actions: {
      ...lyActions,
      remind: (k) => {
        const [b, n] = k.split('-').map(Number);
        S.remind(b, n);
      },
      remindAll: () => S.remindAll(),
      closeLeak: (id) => S.closeLeak(id),
      fixLight: (id) => S.fixLight(id),
      breakLight: (id) => S.breakLight(id),
      task: (t) => S.toast('Даалгавар үүслээ', t),
      leakB: (n) => set({ leakB: Number(n) }),
      demoLeak: () => {
        const B = BUILDINGS[ui.leakB - 1];
        S.newLeak(ui.leakB, Math.min(B.units, B.per * 8 + 6), 'Угаалгын өрөө');
      },
      leakHist: () => Nar.modal.open(leakHistory, { cls: 'wide' }),
      call: (u) => S.toast('Айл руу залгаж байна…', u + ' тоот', 'acc'),
      night: () => set({ night: !ui.night }),
      mode: (m) => set({ mode: m }),
      selB: () => set({ selB: null }),
      selL: (id) => set({ selL: id }),
      invToggle: (k) => S.setInvoice({ [k]: !st().invoice[k] }),
      runInv: () => S.runInvoices(),
      payTab: (t) => set({ payTab: t }),
      resB: (n) => set({ b: Number(n), unit: null }),
      unit: (n) => set({ unit: Number(n) }),
      pickUnit: (k) => {
        const [b, n] = k.split('-').map(Number);
        set({ b, unit: n, q: '' });
      },
      zone: (z) => set({ zone: z, selSlot: null }),
      sla: (m) => set({ sla: Number(m) }),
      openReq: (id) => {
        openReqId = id;
        Nar.modal.open(reqDrawer, { side: true });
      },
      reqSt: (a) => {
        const [id, k] = a.split(':');
        S.setReqStatus(id, Number(k));
      },
      assign: (a) => {
        const [id, n] = a.split(':');
        S.takeRequest(id, n);
      },
      repM: (m) => set({ repM: m }),
      payOb: (id) => S.payObligation(id),
      pubReport: () => S.publishReport(ui.repM),
      addExp: () => {
        const e = ui.exp;
        const amt = Number(String(e.amt).replace(/[^\d]/g, ''));
        if (!e.t.trim() || !amt)
          return S.toast('Мэдээлэл дутуу', 'Юунд зарцуулсан, дүнгээ оруулна уу', 'warn');
        S.addExpense({ cat: e.cat, t: e.t.trim(), amt, vendor: e.v.trim() });
        Object.assign(e, { t: '', amt: '', v: '' });
        clearInputs('exp');
      },
      addWork: () => {
        const w = ui.wk;
        if (!w.t.trim()) return S.toast('Мэдээлэл дутуу', 'Юу хийснээ бичнэ үү', 'warn');
        S.addWork({ cat: w.cat, t: w.t.trim(), where: w.where.trim() });
        Object.assign(w, { t: '', where: '' });
        clearInputs('wk');
      },
    },
    banner: fundBanner,
    bannerTopics: ['fund', 'pay', 'payments', 'ledger', 'remind'],
    inputs: {
      ...lyInputs,
      expCat: (v) => (ui.exp.cat = v),
      expAmt: (v) => (ui.exp.amt = v),
      expT: (v) => (ui.exp.t = v),
      expV: (v) => (ui.exp.v = v),
      wkCat: (v) => (ui.wk.cat = v),
      wkT: (v) => (ui.wk.t = v),
      wkWhere: (v) => (ui.wk.where = v),
      resQ: (v) => set({ q: v }),
      inv: (v, el) => {
        const k = el.dataset.k;
        S.setInvoice({ [k]: k === 'time' ? v : Number(v) });
      },
    },
  });
  // нээлттэй modal-ыг (хүсэлтийн дэлгэрэнгүй, алдалтын түүх) шинэ өгөгдлөөр шинэчилнэ
  S.on((T) => {
    if (T.includes('reqs') || T.includes('leaks') || T.includes('all')) Nar.modal.refresh();
  });
})();
