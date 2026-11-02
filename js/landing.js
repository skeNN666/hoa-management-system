/* СӨХ Platform — Танилцуулга (index.html): систем сонгоод → login.html?role=… руу шилжинэ */
(function () {
  const { html, raw } = Nar;
  const ic = (n, s) => raw(Nar.icon(n, s));
  // хотхоны тоо, айлын тоо: js/layout.js-ийн бүртгэлээс
  const ALL = Layout.all();
  const UNITS = ALL.reduce((a, L) => a + Layout.units(L), 0);
  const BUILDINGS = ALL.reduce((a, L) => a + L.buildings.length, 0);

  const SYSTEMS = [
    {
      role: 'admin',
      icon: 'shield',
      l: 'СӨХ-ийн систем',
      s: 'Удирдлага, санхүү',
      d: 'Төлбөр хураалт, зарлага, ажилтны хуваарь, зогсоол түрээс, хотхоны map-ыг нэг дороос удирдана.',
      pts: ['Санхүү, тайлан', 'Хотхоны 3D map builder', 'Зогсоол түрээслэх'],
    },
    {
      role: 'staff',
      icon: 'wrench',
      l: 'Ажилтны систем',
      s: 'Даалгавар, засвар',
      d: 'Оршин суугчийн хүсэлт шууд ирж, даалгавраа авч, засвар үйлчилгээгээ бүртгэнэ.',
      pts: ['Шууд ирэх хүсэлт', 'Ус алдалтын дуудлага', 'Хийсэн ажлын түүх'],
    },
    {
      role: 'resident',
      icon: 'home',
      l: 'Оршин суугчийн систем',
      s: 'Төлбөр, хүсэлт',
      d: 'СӨХ-ийн төлбөрөө төлж, засварын хүсэлт илгээн, сангийн зарцуулалтыг ил тод харна.',
      pts: ['Төлбөр, нэхэмжлэл', 'Засварын хүсэлт', 'Ил тод тайлан'],
    },
  ];
  const FEATURES = [
    ['wallet', 'Төлбөр', 'Сарын төлбөр, өр, төлөлтийн хувийг байр, айл бүрээр харна.'],
    ['inbox', 'Хүсэлт', 'Оршин суугчийн хүсэлт ажилтан, удирдлагад тэр дороо очно.'],
    ['droplet', 'Ус алдалт', 'Алдалтын байр, давхрыг зүсэлтээр харж, шуурхай шийднэ.'],
    ['car', 'Зогсоол', 'Зогсоолын эгнээ, түрээс, орлогыг 3D-ээр удирдана.'],
    ['map', '3D map', 'Хотхон бүр өөрийн байр, зам, зогсоолтой жинхэнэ 3D map-тай.'],
    ['chart', 'Ил тод тайлан', 'Сан, зарлага, хийсэн ажлыг оршин суугч бүр харна.'],
  ];
  const STEPS = [
    ['Систем сонгох', 'СӨХ, ажилтан, оршин суугч — өөрийн системээ сонгоно.'],
    ['Хотхоноо сонгох', 'Олон хотхоны дундаас өөрийн хотхон / СӨХ-өө сонгоно.'],
    ['Нэвтрэх', 'Нэвтрэх нэр, нууц үгээрээ орж ажиллаж эхэлнэ.'],
  ];
  const go = (role) => 'login.html?role=' + role;

  const page = html`<div class="ld">
    <header class="ld-nav">
      <div class="ld-wrap flex ic g3">
        <a href="index.html" class="flex ic g2 ld-brand"
          ><span class="logo">${ic('building', 20)}</span><b class="t15">СӨХ Platform</b></a
        >
        <nav class="ml-auto flex ic g1">
          <a class="ld-link md-up" href="#systems">Систем</a>
          <a class="ld-link md-up" href="#features">Боломжууд</a>
          <a class="ld-link md-up" href="#how">Хэрхэн</a>
          <a class="btn p s" href="#systems">Нэвтрэх</a>
        </nav>
      </div>
    </header>

    <section class="ld-hero">
      ${W.skyline()}
      <div class="lg-hero-fade lg-down"></div>
      <div class="ld-wrap ld-hero-in">
        <span class="ld-pill">${ic('star', 14)} Хотхоны ухаалаг удирдлага</span>
        <h1 class="ld-h1">СӨХ, ажилтан, оршин суугч — нэг системд</h1>
        <p class="ld-lead">
          Төлбөр, хүсэлт, засвар үйлчилгээ, зогсоол, ус алдалтыг нэг дороос, шууд, ил тод удирдана.
        </p>
        <div class="flex g3 wrap">
          <a class="btn p lg" href="#systems">Систем рүү орох ${ic('arrow-right', 18)}</a>
          <a class="btn glass lg" href="#features">Дэлгэрэнгүй</a>
        </div>
        <div class="ld-stats">
          <div><b>${ALL.length}</b><span>хотхон</span></div>
          <div><b>${BUILDINGS}</b><span>байр</span></div>
          <div><b>${UNITS.toLocaleString()}</b><span>айл</span></div>
        </div>
      </div>
    </section>

    <section id="systems" class="ld-sec">
      <div class="ld-wrap">
        <div class="ld-head">
          <span class="th">Систем</span>
          <h2 class="ld-h2">Өөрийн системээ сонгоно уу</h2>
          <p class="muted">Сонгосон системийн нэвтрэх хуудас руу шууд шилжинэ.</p>
        </div>
        <div class="ld-grid3">
          ${SYSTEMS.map(
            (x) =>
              html`<a class="card ld-sys" href="${go(x.role)}">
                <span class="role-ic ld-sys-ic">${ic(x.icon, 22)}</span>
                <div class="col g1">
                  <b class="t18">${x.l}</b><span class="muted t13">${x.s}</span>
                </div>
                <p class="t14">${x.d}</p>
                <ul class="col g2 ld-pts">
                  ${x.pts.map((p) => html`<li class="flex ic g2 t13">${ic('check', 15)}${p}</li>`)}
                </ul>
                <span class="btn p ld-go">${x.l} рүү орох ${ic('arrow-right', 17)}</span>
              </a>`,
          )}
        </div>
      </div>
    </section>

    <section id="features" class="ld-sec ld-alt">
      <div class="ld-wrap">
        <div class="ld-head">
          <span class="th">Боломжууд</span>
          <h2 class="ld-h2">Хотхоны бүх ажил нэг дор</h2>
        </div>
        <div class="ld-grid3">
          ${FEATURES.map(
            ([i, t, d]) =>
              html`<div class="card ld-feat">
                <span class="ld-feat-ic">${ic(i, 20)}</span><b class="t15">${t}</b>
                <p class="muted t13">${d}</p>
              </div>`,
          )}
        </div>
      </div>
    </section>

    <section id="how" class="ld-sec">
      <div class="ld-wrap">
        <div class="ld-head">
          <span class="th">Хэрхэн</span>
          <h2 class="ld-h2">3 алхмаар эхэлнэ</h2>
        </div>
        <ol class="ld-grid3">
          ${STEPS.map(
            ([t, d], i) =>
              html`<li class="ld-step">
                <span class="ld-step-n">${i + 1}</span><b class="t15">${t}</b>
                <p class="muted t13">${d}</p>
              </li>`,
          )}
        </ol>
        <div class="ld-cta card">
          <div class="col g1">
            <b class="t18">Бэлэн үү?</b
            ><span class="muted t13">Системээ сонгоод нэвтрэх хуудас руу орно.</span>
          </div>
          <div class="flex g2 wrap">
            ${SYSTEMS.map(
              (x) =>
                html`<a class="btn" href="${go(x.role)}">${ic(x.icon, 16)}${x.s.split(',')[0]}</a>`,
            )}
          </div>
        </div>
      </div>
    </section>

    <footer class="ld-foot">
      <div class="ld-wrap flex ic g3 wrap">
        <span class="flex ic g2"
          ><span class="logo s">${ic('building', 16)}</span><b>СӨХ Platform</b></span
        >
        <span class="muted t13 ml-auto">© 2026 СӨХ Platform · Улаанбаатар</span>
      </div>
    </footer>
  </div>`;

  document.body.innerHTML = String(page);
})();
