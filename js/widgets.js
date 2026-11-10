/*
 * СӨХ Platform — SVG widget-ууд, Shadow DOM Web Component хэлбэрээр (CSS: css/components/*.css):
 *   <sokh-worker-scene kind>        ажилтны засварын анимаци
 *   <sokh-leak-building b storm data> ус алдалтын байрны зүсэлт
 *   <sokh-flower wilt paid size>    төлбөрөөс хамаарч хатах / цэцэглэх цэцэг
 *   <sokh-avatar size>              хөтөч Сараа
 *   <sokh-ring value size>          тойрог прогресс
 *   <sokh-fund-jar cover paid size> хотхоны сангийн сав
 *   <sokh-skyline>                  шөнийн хот (login, landing)
 * W.kindOf(cat, st) — хүсэлтийн төрлөөс аль анимаци харуулахыг сонгоно.
 */
(function () {
  const kindOf = (cat, st) =>
    st === 1
      ? 'walk'
      : st === 2
        ? /Лифт/.test(cat)
          ? 'lift'
          : /Цахилгаан/.test(cat)
            ? 'light'
            : /Сантехник|Ус|Дулаан|Засвар/.test(cat)
              ? 'pipe'
              : 'gen'
        : null;

  function worker(x, hammer) {
    return (
      '<g transform="translate(' +
      x +
      ' 58)"><g class="wk-bob">' +
      '<rect x="-9" y="22" width="7" height="30" rx="3" fill="#2F3B52"/><rect x="2" y="22" width="7" height="30" rx="3" fill="#2F3B52"/>' +
      '<rect x="-12" y="-6" width="24" height="32" rx="7" fill="#F28C28"/><rect x="-12" y="6" width="24" height="4" fill="#FFE08A"/>' +
      '<circle cx="0" cy="-16" r="10" fill="#F2C7A5"/><path d="M-11 -18a11 11 0 0 1 22 0z" fill="#F5D130"/><rect x="-12" y="-19" width="24" height="3" rx="1.5" fill="#E0B21E"/>' +
      '<g class="' +
      (hammer ? 'hammer' : 'wk-arm') +
      '"><rect x="9" y="-2" width="6" height="22" rx="3" fill="#F28C28" transform="rotate(-60 12 0)"/>' +
      (hammer
        ? '<rect x="22" y="-18" width="3" height="18" fill="#7A5A3A"/><rect x="17" y="-22" width="13" height="6" rx="1.5" fill="#64748B"/>'
        : '') +
      '</g></g></g>'
    );
  }
  /** Засварын явцын анимаци — оршин суугч болон ажилтан хоёуланд харагдана */
  function workerScene(kind, cls = '') {
    let s = '';
    if (kind === 'lift')
      s =
        '<rect x="150" y="12" width="96" height="122" rx="4" fill="#CBD5E1"/><rect x="185" y="2" width="26" height="10" rx="2" fill="#1F2937"/><text x="198" y="10" font-size="7" text-anchor="middle" fill="#F87171" class="blink">3 ▲</text>' +
        '<rect class="door-l" x="156" y="18" width="42" height="116" fill="#94A3B8"/><rect class="door-r" x="198" y="18" width="42" height="116" fill="#94A3B8"/><rect x="196" y="18" width="4" height="116" fill="#1F2937"/>' +
        '<rect x="128" y="62" width="12" height="20" rx="2" fill="#1F2937"/><circle cx="134" cy="72" r="2" fill="#3DDC84" class="blink"/>' +
        worker(110) +
        '<polygon points="262,134 270,112 278,134" fill="#F97316"/><rect x="264" y="122" width="12" height="3" fill="#fff"/>';
    if (kind === 'pipe')
      s =
        '<rect x="40" y="20" width="230" height="10" rx="5" fill="#94A3B8"/><rect x="200" y="20" width="10" height="70" fill="#94A3B8"/><rect x="194" y="56" width="22" height="12" rx="3" fill="#64748B"/>' +
        [0, 0.45, 0.9]
          .map(
            (d) =>
              '<circle class="wdrop" style="animation-delay:' +
              d +
              's" cx="205" cy="92" r="3.2" fill="#4FB0F5"/>',
          )
          .join('') +
        '<ellipse cx="205" cy="133" rx="26" ry="4" fill="#4FB0F5" opacity=".5"/>' +
        worker(160, true) +
        '<g class="spark"><path d="M190 60l-6-4M192 66l-8 0M190 72l-6 4" stroke="#FFE08A" stroke-width="2.5" stroke-linecap="round"/></g>';
    if (kind === 'light')
      s =
        '<rect x="196" y="18" width="6" height="116" fill="#64748B"/><rect x="170" y="14" width="58" height="8" rx="4" fill="#64748B"/><circle class="bulb" cx="176" cy="30" r="9" fill="#6B7280"/>' +
        '<rect x="120" y="40" width="10" height="94" fill="#A16207"/><rect x="150" y="40" width="10" height="94" fill="#A16207"/>' +
        [56, 80, 104]
          .map((y) => '<rect x="120" y="' + y + '" width="40" height="5" fill="#A16207"/>')
          .join('') +
        '<g transform="translate(0 -36)">' +
        worker(140) +
        '</g><g class="spark"><path d="M168 30l-8-6M168 36h-10" stroke="#FFE08A" stroke-width="2.5" stroke-linecap="round"/></g>';
    if (kind === 'gen')
      s =
        '<rect x="170" y="70" width="80" height="64" rx="6" fill="#CBD5E1"/><rect x="182" y="82" width="56" height="12" rx="3" fill="#94A3B8"/>' +
        worker(140, true) +
        '<g class="spark"><path d="M172 76l-8-4M174 84h-10" stroke="#FFE08A" stroke-width="2.5" stroke-linecap="round"/></g>';
    if (kind === 'walk')
      s =
        '<rect x="230" y="40" width="56" height="94" rx="4" fill="#CBD5E1"/>' +
        [54, 78, 102]
          .map((y) => '<rect x="240" y="' + y + '" width="12" height="12" rx="2" fill="#64748B"/>')
          .join('') +
        '<g class="walk"><g transform="translate(0 58)"><rect class="leg-a" x="-8" y="22" width="7" height="30" rx="3" fill="#2F3B52"/><rect class="leg-b" x="1" y="22" width="7" height="30" rx="3" fill="#2F3B52"/>' +
        '<rect x="-12" y="-6" width="24" height="32" rx="7" fill="#F28C28"/><circle cx="0" cy="-16" r="10" fill="#F2C7A5"/><path d="M-11 -18a11 11 0 0 1 22 0z" fill="#F5D130"/><rect x="10" y="8" width="16" height="12" rx="2" fill="#64748B"/></g></g>';
    return Nar.raw(
      '<div class="wscene ' +
        cls +
        '"><svg viewBox="0 0 300 150" aria-hidden="true"><rect x="0" y="134" width="300" height="16" rx="3" fill="var(--line)"/>' +
        s +
        '</svg></div>',
    );
  }

  const RISERS = [2, 5, 8, 11];
  const RAIN = Array.from({ length: 60 }, (_, k) => {
    const r1 = ((k * 9301 + 49297) % 233280) / 233280,
      r2 = ((k * 4111 + 1013) % 9973) / 9973;
    return {
      left: r1 * 112 + '%',
      h: 14 + r2 * 22,
      dur: 0.7 + r2 * 0.6,
      delay: -r1 * 1.3,
      op: 0.35 + r2 * 0.6,
    };
  });

  /** Байрны зүсэлт (давхар × давхартаа байх айл — D.BUILDINGS-ээс): бороо, босоо хоолойд урсах ус, алдсан айлын долгион */
  function leakBuilding(b, leaks, storm) {
    const B = D.BUILDINGS[b - 1] || { per: 13, units: 208 };
    const per = B.per,
      FL = Math.ceil(B.units / per);
    const ris = [...new Set(RISERS.map((c) => Math.round((c * (per - 1)) / 12)))];
    const mine = leaks.filter((x) => x.b === b && x.st !== 'fixed');
    const riserCls = (k) => {
      const xs = mine.filter((x) => Math.abs(((x.u - 1) % per) - ris[k]) <= 1);
      return xs.some((x) => x.st === 'active') ? 'alarm' : xs.length ? 'stop' : '';
    };
    let rows = '';
    for (let f = FL; f >= 1; f--) {
      let cells = '';
      if (f === FL)
        cells += ris
          .map(
            (c, k) =>
              '<span class="riser ' +
              riserCls(k) +
              '" style="left:calc(' +
              ((c + 1) / per) * 100 +
              '% - 2px)"></span>',
          )
          .join('');
      for (let k = 0; k < per; k++) {
        const u = (f - 1) * per + k + 1;
        if (u > B.units) break;
        const L = mine.find((x) => x.u === u);
        const below = mine.find((x) => x.st === 'active' && x.u === u + per);
        const cls = L ? 'lk-' + L.st : below ? 'lk-below' : '';
        cells +=
          '<div title="' +
          u +
          ' тоот · ' +
          (L ? L.room : below ? 'Дээд айлаас ус алдаж байна' : '2 чип хэвийн') +
          '" class="lk-cell ' +
          cls +
          '"><i class="chipd l"></i><i class="chipd r"></i>' +
          (L && L.st === 'active'
            ? '<span class="lk-rip">' +
              [0, 0.6, 1.2]
                .map((d) => '<i class="ripple" style="animation-delay:' + d + 's"></i>')
                .join('') +
              '</span><span class="stain flow"></span><span class="lk-tag bob">' +
              u +
              ' тоот</span>'
            : '') +
          '</div>';
      }
      rows +=
        '<div class="lk-row"><span class="lk-f num">' +
        f +
        'F</span><div class="lk-cells">' +
        cells +
        '</div></div>';
    }
    const act = mine.some((x) => x.st === 'active');
    return Nar.raw(
      '<div class="rel"><div class="rain" aria-hidden="true">' +
        RAIN.slice(0, storm ? 60 : 34)
          .map(
            (r) =>
              '<i style="left:' +
              r.left +
              ';height:' +
              r.h +
              'px;animation-duration:' +
              r.dur +
              's;animation-delay:' +
              r.delay +
              's;opacity:' +
              r.op +
              '"></i>',
          )
          .join('') +
        '</div>' +
        '<div class="lk-bld" style="--per:' +
        per +
        '">' +
        rows +
        '<div class="lk-base"><span class="spin"></span><span class="col"><span style="color:#fff">Подвал · ус өргөх насос</span><span class="num">Даралт ' +
        (act ? '3.2' : '4.2') +
        ' бар</span></span><span class="grow"></span><span class="chip c-ok">Подвалын 4 чип хэвийн</span></div></div></div>',
    );
  }

  const lerp = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a),
      B = p(b);
    return (
      '#' +
      A.map((x, i) =>
        Math.round(x + (B[i] - x) * t)
          .toString(16)
          .padStart(2, '0'),
      ).join('')
    );
  };
  /** Төлбөр төлөхгүй бол хатна, төлмөгц дахин цэцэглэнэ */
  function flower(wilt, paid, size = 170) {
    const w = paid ? 0 : wilt;
    const petal = lerp('#F2668B', '#9C8471', w),
      core = lerp('#F6B93B', '#6D5A45', w),
      leaf = lerp('#3FB56E', '#8C8452', w),
      stem = lerp('#2E9E5B', '#8A7A4A', w);
    const E = 'transition:transform 1.6s cubic-bezier(.3,1.25,.5,1),fill 1.6s;';
    return Nar.raw(
      '<svg class="flower no-shrink" width="' +
        size +
        '" height="' +
        size * 1.38 +
        '" viewBox="0 0 120 166" role="img" aria-label="' +
        (w < 0.2 ? 'Цэцэг цэцэглэж байна' : 'Цэцэг хатаж байна') +
        '">' +
        '<ellipse cx="60" cy="160" rx="34" ry="5" fill="rgba(15,27,45,.12)"/><path d="M36 128h48l-6 30H42z" fill="#C8693A"/><rect x="32" y="122" width="56" height="9" rx="3" fill="#D97A45"/>' +
        '<g style="' +
        E +
        'transform-origin:60px 124px;transform:rotate(' +
        w * 40 +
        'deg)"><path d="M60 124 C58 100 62 80 60 52" fill="none" stroke="' +
        stem +
        '" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M60 100 C44 94 38 84 36 76 C48 78 58 86 60 100z" fill="' +
        leaf +
        '" style="' +
        E +
        'transform-origin:60px 100px;transform:rotate(' +
        -w * 35 +
        'deg)"/>' +
        '<path d="M60 88 C76 82 82 72 84 64 C72 66 62 74 60 88z" fill="' +
        leaf +
        '" style="' +
        E +
        'transform-origin:60px 88px;transform:rotate(' +
        w * 35 +
        'deg)"/>' +
        '<g class="' +
        (paid ? 'bloom' : '') +
        '" style="' +
        E +
        'transform-origin:60px 46px;transform:rotate(' +
        w * 60 +
        'deg) scale(' +
        (1 - w * 0.25) +
        ')">' +
        [0, 60, 120, 180, 240, 300]
          .map(
            (a, i) =>
              '<ellipse cx="60" cy="32" rx="9" ry="15" fill="' +
              petal +
              '" style="transition:fill 1.6s,opacity 1.2s;transform-origin:60px 46px;transform:rotate(' +
              a +
              'deg);opacity:' +
              (w > 0.55 + i * 0.07 ? 0 : 1) +
              '"/>',
          )
          .join('') +
        '<circle cx="60" cy="46" r="9" fill="' +
        core +
        '"/></g></g>' +
        (w > 0.6
          ? [0, 1]
              .map(
                (i) =>
                  '<ellipse class="petal-fall" cx="' +
                  (50 + i * 22) +
                  '" cy="60" rx="6" ry="10" fill="' +
                  petal +
                  '" style="--dx:' +
                  (i ? 20 : -26) +
                  'px;animation-delay:' +
                  i * 0.8 +
                  's"/>',
              )
              .join('')
          : '') +
        '</svg>',
    );
  }

  function avatar(s = 78) {
    return Nar.raw(
      '<svg viewBox="0 0 78 92" width="' +
        s +
        '" height="' +
        s * 1.18 +
        '" aria-hidden="true"><ellipse cx="39" cy="88" rx="22" ry="4" fill="rgba(8,14,24,.18)"/><path d="M14 92c0-16 11-26 25-26s25 10 25 26z" fill="#2F6FD6"/><path d="M30 68l9 10 9-10" fill="#F5C542"/>' +
        '<rect x="33" y="58" width="12" height="10" rx="4" fill="#F2C7A5"/><circle cx="39" cy="38" r="22" fill="#F7D4B5"/><path d="M17 38c0-15 10-24 22-24s22 9 22 24c-4-8-11-12-22-12s-18 4-22 12z" fill="#2B2A3A"/><circle cx="39" cy="12" r="8" fill="#2B2A3A"/>' +
        '<circle cx="23" cy="44" r="4" fill="#F4A7A0" opacity=".6"/><circle cx="55" cy="44" r="4" fill="#F4A7A0" opacity=".6"/><ellipse class="gd-eye" cx="31" cy="39" rx="2.6" ry="3.4" fill="#2B2A3A"/><ellipse class="gd-eye" cx="47" cy="39" rx="2.6" ry="3.4" fill="#2B2A3A"/>' +
        '<path d="M33 48q6 5 12 0" fill="none" stroke="#B5523F" stroke-width="2.2" stroke-linecap="round"/><g class="gd-hand"><path d="M60 84c4-6 6-14 6-22" fill="none" stroke="#2F6FD6" stroke-width="7" stroke-linecap="round"/><circle cx="66" cy="60" r="5.5" fill="#F7D4B5"/></g></svg>',
    );
  }

  /* Шөнийн хотын skyline (login, landing hero): 3 давхар гүн (алс, ар эгнээ, урд эгнээ),
   * айл бүрийн гэрэл (2 цонх = 1 айл), дээврийн тоноглол, гудамжны гэрэл, бодит хэлбэртэй машинууд.
   * Seed-тэй PRNG → үр дүн тогтмол. ~4k элементтэй тул <sokh-skyline> нэг удаа parse хийнэ:
   * hero дахин render хийхэд morph нь component-ийн дотор хүрэхгүй, анимаци тасрахгүй. */
  function buildSkyline() {
    let seed = 20261102;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const between = (a, b) => a + rnd() * (b - a);
    const n = (v) => Math.round(v * 10) / 10;
    const rect = (x, y, w, h, a) =>
      '<rect x="' +
      n(x) +
      '" y="' +
      n(y) +
      '" width="' +
      n(w) +
      '" height="' +
      n(h) +
      '" ' +
      a +
      '/>';
    const circ = (x, y, r, a) =>
      '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(r) + '" ' + a + '/>';
    const pickW = (tbl) => {
      let r = rnd() * tbl.reduce((t, e) => t + e[1], 0);
      for (const e of tbl) if ((r -= e[1]) < 0) return e[0];
      return tbl[0][0];
    };
    const stops = (st) =>
      st
        .map(
          ([o, c, a]) =>
            '<stop offset="' +
            o +
            '" stop-color="' +
            c +
            '"' +
            (a == null ? '' : ' stop-opacity="' + a + '"') +
            '/>',
        )
        .join('');
    const lg = (id, st, h) =>
      '<linearGradient id="sk-' +
      id +
      '" x1="0" y1="0" x2="' +
      (h ? 1 : 0) +
      '" y2="' +
      (h ? 0 : 1) +
      '">' +
      stops(st) +
      '</linearGradient>';
    const rg = (id, st) => '<radialGradient id="sk-' + id + '">' + stops(st) + '</radialGradient>';
    const GROUND = 500;
    // айлын гэрлийн өнгө: дулаан шар, цайвар, улбар, хүйтэн LED, ТВ-ийн цэнхэр, улаавтар чийдэн
    const HOME = [
      ['w0', 34],
      ['w1', 24],
      ['w2', 18],
      ['w3', 12],
      ['w4', 8],
      ['w5', 2],
    ];
    const OFFICE = [
      ['w3', 50],
      ['w1', 30],
      ['w0', 12],
      ['w4', 8],
    ];

    // ---------- defs ----------
    const farPat = (id, pw, ph, p) => {
      let o =
        '<pattern id="sk-' +
        id +
        '" width="' +
        pw +
        '" height="' +
        ph +
        '" patternUnits="userSpaceOnUse">';
      for (let y = 1.5; y + 3 < ph; y += 6)
        for (let x = 1; x + 2 < pw; x += 4)
          if (rnd() < p)
            o += rect(
              x,
              y,
              2,
              2.6,
              'fill="#F3C97E" opacity="' + between(0.25, 0.75).toFixed(2) + '"',
            );
      return o + '</pattern>';
    };
    let s =
      '<svg class="skyline" viewBox="0 0 800 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>' +
      lg('sky', [
        [0, '#0B1626'],
        [0.45, '#0E1D33'],
        [0.78, '#172848'],
        [1, '#26304F'],
      ]) +
      lg('pol', [
        [0, '#E89A5A', 0],
        [1, '#E89A5A', 0.16],
      ]) +
      rg('moon', [
        [0, '#FFF1C6', 0.28],
        [0.35, '#FFF1C6', 0.08],
        [1, '#FFF1C6', 0],
      ]) +
      lg('haze', [
        [0, '#132440', 0],
        [1, '#1B2B48', 0.6],
      ]) +
      lg('haze2', [
        [0, '#132440', 0],
        [1, '#1B2B48', 0.35],
      ]) +
      lg('fac', [
        [0, '#8FB0E0', 0.08],
        [0.4, '#000', 0],
        [1, '#000', 0.25],
      ]) +
      lg('w0', [
        [0, '#FFE4A6'],
        [1, '#EFAE55'],
      ]) +
      lg('w1', [
        [0, '#FFF5DE'],
        [1, '#F1D6A0'],
      ]) +
      lg('w2', [
        [0, '#FFC27E'],
        [1, '#D98236'],
      ]) +
      lg('w3', [
        [0, '#EAF2FF'],
        [1, '#A9C4E8'],
      ]) +
      lg('w4', [
        [0, '#A6C4FF'],
        [1, '#5A7BCF'],
      ]) +
      lg('w5', [
        [0, '#FFB8A0'],
        [1, '#D2665A'],
      ]) +
      lg('wd', [
        [0, '#1E2F4B'],
        [1, '#09111E'],
      ]) +
      lg('shop', [
        [0, '#FFF0CF'],
        [1, '#E9A65A'],
      ]) +
      lg('road', [
        [0, '#141E2D'],
        [1, '#090F19'],
      ]) +
      lg('cone', [
        [0, '#FFD99A', 0.22],
        [1, '#FFD99A', 0],
      ]) +
      rg('pool', [
        [0, '#FFD99A', 0.3],
        [1, '#FFD99A', 0],
      ]) +
      lg(
        'beam',
        [
          [0, '#FFF4D6', 0.34],
          [1, '#FFF4D6', 0],
        ],
        1,
      ) +
      rg('spot', [
        [0, '#FFF0C8', 0.22],
        [1, '#FFF0C8', 0],
      ]) +
      rg('tail', [
        [0, '#FF2A1F', 0.5],
        [1, '#FF2A1F', 0],
      ]) +
      lg('glass', [
        [0, '#40526D'],
        [0.45, '#1A2433'],
        [1, '#0A0F17'],
      ]) +
      lg('car', [
        [0, '#FFF', 0.32],
        [0.3, '#FFF', 0.05],
        [0.6, '#000', 0.05],
        [1, '#000', 0.5],
      ]) +
      farPat('fw0', 48, 42, 0.42) +
      farPat('fw1', 44, 36, 0.36) +
      farPat('fw2', 52, 48, 0.48) +
      '</defs>';

    // ---------- тэнгэр ----------
    s += rect(0, 0, 800, 560, 'fill="url(#sk-sky)"');
    for (let i = 0; i < 60; i++) {
      const tw = rnd() < 0.15;
      s +=
        '<circle cx="' +
        n(rnd() * 800) +
        '" cy="' +
        n(rnd() * 260) +
        '" r="' +
        n(between(0.35, 0.95)) +
        '" fill="#fff" opacity="' +
        between(0.2, 0.7).toFixed(2) +
        '">' +
        (tw
          ? '<animate attributeName="opacity" values=".7;.15;.7" dur="' +
            between(2, 5).toFixed(1) +
            's" begin="-' +
            between(0, 4).toFixed(1) +
            's" repeatCount="indefinite"/>'
          : '') +
        '</circle>';
    }
    s +=
      circ(640, 120, 110, 'fill="url(#sk-moon)"') +
      circ(640, 120, 21, 'fill="#FFF3D4"') +
      circ(633, 114, 4.5, 'fill="#EADBB4" opacity=".55"') +
      circ(647, 127, 3, 'fill="#EADBB4" opacity=".5"') +
      circ(645, 111, 2, 'fill="#EADBB4" opacity=".45"') +
      rect(0, 260, 800, 240, 'fill="url(#sk-pol)"');

    // ---------- онгоцны анхааруулах улаан гэрэл ----------
    const blinker = (x, y) =>
      '<g><animate attributeName="opacity" values="1;.08;1" keyTimes="0;.45;1" calcMode="discrete" dur="' +
      between(1.6, 2.6).toFixed(1) +
      's" begin="-' +
      between(0, 3).toFixed(1) +
      's" repeatCount="indefinite"/>' +
      circ(x, y, 5, 'fill="#FF3B30" opacity=".22"') +
      circ(x, y, 1.4, 'fill="#FF5A4F"') +
      '</g>';

    // ---------- алсын барилгууд (pattern цонх, манан) ----------
    for (let x = -10, i = 0; x < 810; i++) {
      const w = between(22, 62),
        h = between(150, 300),
        top = GROUND - h;
      s +=
        rect(x, top, w, h, 'fill="#101C30"') +
        rect(x, top, w, h, 'fill="url(#sk-fw' + (i % 3) + ')"');
      if (h > 270)
        s +=
          '<path d="M' +
          n(x + w / 2) +
          ' ' +
          n(top) +
          'v-16" stroke="#1E2C44" stroke-width="1"/>' +
          blinker(x + w / 2, top - 16);
      x += w + between(1, 7);
    }
    s += rect(0, 190, 800, 310, 'fill="url(#sk-haze)"');

    // ---------- цонх ----------
    const win = (x, y, w, h, lit, fill, flick) => {
      let o = '';
      if (!lit || flick) o += rect(x, y, w, h, 'fill="url(#sk-wd)"');
      if (!lit && !flick) return o;
      const a = between(0.74, 1).toFixed(2);
      let anim = '';
      if (flick) {
        const d = between(6, 20).toFixed(1),
          t1 = between(0.2, 0.6);
        anim =
          '<animate attributeName="opacity" values="' +
          (lit ? a + ';0;' + a : '0;' + a + ';0') +
          '" keyTimes="0;' +
          t1.toFixed(2) +
          ';' +
          Math.min(0.95, t1 + between(0.15, 0.35)).toFixed(2) +
          '" calcMode="discrete" dur="' +
          d +
          's" begin="-' +
          between(0, +d).toFixed(1) +
          's" repeatCount="indefinite"/>';
      }
      o +=
        '<rect x="' +
        n(x) +
        '" y="' +
        n(y) +
        '" width="' +
        n(w) +
        '" height="' +
        n(h) +
        '" fill="url(#sk-' +
        fill +
        ')" opacity="' +
        (lit ? a : 0) +
        '">' +
        anim +
        '</rect>';
      if (lit && !flick) {
        const r = rnd();
        if (r < 0.2)
          o += rect(rnd() < 0.5 ? x : x + w * 0.55, y, w * 0.45, h, 'fill="#3A2414" opacity=".32"'); // хөшиг
        else if (r < 0.3)
          o += rect(x, y, w, h * 0.38, 'fill="#3A2A1C" opacity=".35"'); // хаалт
        else if (r < 0.36)
          o += rect(x + w * 0.25, y + h * 0.45, w * 0.3, h * 0.55, 'fill="#1A1410" opacity=".4"'); // хүний дүрс
      }
      return o;
    };
    const facade = (x, top, w, h, o) => {
      let out = '',
        slab = '',
        balc = '';
      const cols = Math.max(1, Math.floor((w - 5) / o.cw));
      const ox = x + (w - (cols - 1) * o.cw - o.ww) / 2;
      const rows = Math.floor((h - o.padT - o.padB) / o.fh);
      for (let r = 0; r < rows; r++) {
        const wy = top + o.padT + r * o.fh;
        let unitLit = false,
          unitFill = 'w0';
        for (let c = 0; c < cols; c++) {
          if (c % o.pair === 0) {
            unitLit = rnd() < o.p;
            unitFill = pickW(o.tbl);
            if (o.balc && (c / o.pair + r) % 2 === 0 && c + 1 < cols)
              balc +=
                'M' +
                n(ox + c * o.cw - 1.2) +
                ' ' +
                n(wy + o.wh + 0.9) +
                'h' +
                n(o.cw + o.ww + 2.4);
          }
          const lit = o.pair > 1 && rnd() < 0.18 ? !unitLit : unitLit;
          out += win(ox + c * o.cw, wy, o.ww, o.wh, lit, unitFill, rnd() < 0.045);
        }
        if (o.slabs) slab += 'M' + n(x) + ' ' + n(wy - (o.fh - o.wh) / 2) + 'h' + n(w);
      }
      if (slab)
        out += '<path d="' + slab + '" stroke="#fff" stroke-opacity=".045" stroke-width=".7"/>';
      if (balc)
        out += '<path d="' + balc + '" stroke="#2C3E5A" stroke-width="' + n(o.fh * 0.14) + '"/>';
      return out;
    };

    // ---------- барилга ----------
    const BASES = ['#162339', '#19283F', '#14213A', '#1B2A3E', '#172536', '#1A2436'];
    const building = (x, w, h, type, k, front) => {
      const top = GROUND - h,
        base = BASES[Math.floor(rnd() * BASES.length)];
      const sw = Math.round(w * between(0.09, 0.15)); // сүүдэрт хажуу хана
      let o = '';
      if (type === 'tower') {
        const cw = (w - sw) * between(0.45, 0.7),
          cx = x + sw + (w - sw - cw) / 2,
          ch = between(7, 16);
        const mx = cx + cw / 2,
          mh = between(14, 32);
        o +=
          rect(cx, top - ch, cw, ch, 'fill="' + base + '"') +
          rect(cx, top - ch, cw, 1.4, 'fill="#86B6FF" opacity=".4"') +
          '<path d="M' +
          n(mx) +
          ' ' +
          n(top - ch) +
          'v-' +
          n(mh) +
          '" stroke="#2A3B55" stroke-width="1.1"/>' +
          blinker(mx, top - ch - mh);
      } else {
        for (let i = 1 + Math.floor(rnd() * 2); i > 0; i--) {
          const bw = between(7, 15) * k,
            bh = between(5, 9) * k,
            bx = x + sw + between(2, Math.max(3, w - sw - bw - 2));
          o +=
            rect(bx, top - bh, bw, bh, 'fill="' + base + '"') +
            rect(bx, top - bh, bw, 1, 'fill="#2C3D58"');
        }
        if (rnd() < 0.65) {
          const ax = x + between(5, w - 5),
            ah = between(6, 13) * k;
          o +=
            '<path d="M' +
            n(ax) +
            ' ' +
            n(top) +
            'v-' +
            n(ah) +
            'm-3 3h6m-5 3h4" stroke="#2A3B55" stroke-width=".8" fill="none"/>';
        }
        if (rnd() < 0.35) {
          const tx = x + between(sw + 4, w - 12);
          o +=
            rect(tx, top - 9 * k, 7 * k, 6 * k, 'rx="1" fill="#1D2B42"') +
            '<path d="M' +
            n(tx + 1) +
            ' ' +
            n(top - 3 * k) +
            'v3m' +
            n(5 * k - 2) +
            ' -3v3" stroke="#2A3B55" stroke-width=".7"/>';
        }
      }
      o +=
        rect(x, top, w, h, 'fill="' + base + '"') +
        rect(x, top, w, h, 'fill="url(#sk-fac)"') +
        rect(x, top, sw, h, 'fill="#000" opacity=".32"') +
        rect(x - 0.5, top - 1.5, w + 1, 2, 'fill="#2C3D58"');
      const office = type === 'tower' && rnd() < 0.45;
      const spec =
        type === 'panel'
          ? {
              fh: 11,
              ww: 4.6,
              wh: 6,
              cw: 8,
              pair: 2,
              p: 0.76,
              tbl: HOME,
              padT: 6,
              padB: 12,
              slabs: 1,
              balc: 1,
            }
          : type === 'tower'
            ? office
              ? {
                  fh: 10,
                  ww: 6.6,
                  wh: 7.2,
                  cw: 8.4,
                  pair: 1,
                  p: 0.62,
                  tbl: OFFICE,
                  padT: 5,
                  padB: 13,
                  slabs: 1,
                }
              : {
                  fh: 10.5,
                  ww: 4.8,
                  wh: 6.2,
                  cw: 7.6,
                  pair: 2,
                  p: 0.74,
                  tbl: HOME,
                  padT: 5,
                  padB: 13,
                  balc: 1,
                }
            : {
                fh: 12,
                ww: 5.6,
                wh: 7,
                cw: 9.5,
                pair: 2,
                p: 0.74,
                tbl: HOME,
                padT: 6,
                padB: 17,
                slabs: 1,
              };
      ['fh', 'ww', 'wh', 'cw', 'padT', 'padB'].forEach((key) => (spec[key] *= k));
      o += facade(x + sw, top, w - sw, h, spec);
      if (!front) return o;
      // газрын давхар: орц эсвэл дэлгүүр
      const fx = x + sw,
        fw = w - sw;
      if (type === 'low') {
        const sc = ['#E8505B', '#3FB6A8', '#F2A93B', '#5B8DEF', '#C86DD7'][Math.floor(rnd() * 5)];
        o +=
          rect(fx + 3, GROUND - 11, fw - 6, 10.5, 'fill="url(#sk-shop)" opacity=".92"') +
          '<path d="M' +
          n(fx + 3 + (fw - 6) / 3) +
          ' ' +
          (GROUND - 11) +
          'v10.5M' +
          n(fx + 3 + ((fw - 6) * 2) / 3) +
          ' ' +
          (GROUND - 11) +
          'v10.5" stroke="#2A2E38" stroke-width=".8"/>' +
          rect(fx + fw * 0.2, GROUND - 15.5, fw * 0.6, 3.4, 'rx=".8" fill="' + sc + '"') +
          rect(
            fx + fw * 0.2 - 4,
            GROUND - 19,
            fw * 0.6 + 8,
            10,
            'fill="' + sc + '" opacity=".12"',
          ) +
          '<ellipse cx="' +
          n(fx + fw / 2) +
          '" cy="' +
          (GROUND + 3) +
          '" rx="' +
          n(fw * 0.55) +
          '" ry="3.5" fill="#FFD9A0" opacity=".14"/>';
      } else {
        for (let d = 0, nd = fw > 90 ? 2 : 1; d < nd; d++) {
          const dx = fx + (fw * (d + 1)) / (nd + 1) - 3.5;
          o +=
            rect(dx, GROUND - 9.5, 7, 9.5, 'fill="url(#sk-w1)" opacity=".9"') +
            rect(dx - 2.5, GROUND - 11.5, 12, 1.6, 'fill="#2C3D58"') +
            circ(dx + 3.5, GROUND - 13.2, 0.9, 'fill="#FFF0C8"') +
            '<ellipse cx="' +
            n(dx + 3.5) +
            '" cy="' +
            (GROUND + 2.5) +
            '" rx="14" ry="3" fill="#FFD9A0" opacity=".16"/>';
        }
      }
      return o;
    };

    // ар эгнээ: өндөр цамхаг, панель байр (жижиг масштаб)
    for (let x = -20; x < 820; ) {
      const tower = rnd() < 0.45;
      const w = tower ? between(30, 48) : between(60, 104);
      const h = tower ? between(215, 300) : between(150, 215);
      s += building(x, w, h, tower ? 'tower' : 'panel', 0.78, false);
      x += w + between(4, 14);
    }
    s += rect(0, 200, 800, 300, 'fill="url(#sk-haze2)"');
    // урд эгнээ: панель байр, намхан дэлгүүртэй байр, цамхаг
    for (let x = -12; x < 812; ) {
      const r = rnd(),
        type = r < 0.5 ? 'panel' : r < 0.8 ? 'low' : 'tower';
      const w =
        type === 'panel' ? between(82, 128) : type === 'low' ? between(52, 80) : between(38, 52);
      const h =
        type === 'panel' ? between(112, 168) : type === 'low' ? between(62, 92) : between(178, 228);
      s += building(x, w, h, type, 1, true);
      x += w + between(10, 38);
    }

    // ---------- мод ----------
    for (let i = 0; i < 9; i++) {
      const tx = between(10, 790),
        th = between(9, 15),
        cr = between(5, 8.5);
      s +=
        rect(tx - 0.8, GROUND - th, 1.6, th + 2, 'fill="#0A121E"') +
        circ(tx, GROUND - th - cr * 0.4, cr, 'fill="#0B1625"') +
        circ(tx - cr * 0.7, GROUND - th + cr * 0.2, cr * 0.72, 'fill="#0B1625"') +
        circ(tx + cr * 0.75, GROUND - th + cr * 0.15, cr * 0.7, 'fill="#0A1422"') +
        circ(tx + cr * 0.2, GROUND - th - cr * 0.9, cr * 0.55, 'fill="#13233A" opacity=".7"');
    }

    // ---------- явган зам, зам ----------
    s +=
      rect(0, GROUND, 800, 6, 'fill="#1C293C"') +
      rect(0, GROUND + 4.5, 800, 1.6, 'fill="#3A4C66"') +
      rect(0, GROUND + 6, 800, 54, 'fill="url(#sk-road)"') +
      '<path d="M0 509.5H800" stroke="#D9DEE6" stroke-opacity=".22" stroke-width=".8"/>' +
      '<path d="M0 535.5H800" stroke="#E9EEF5" stroke-opacity=".32" stroke-width="1.2" stroke-dasharray="18 14"/>';
    const LAMPS = [];
    for (let x = 60; x < 800; x += 165) LAMPS.push(x);
    LAMPS.forEach((x) => {
      s += '<ellipse cx="' + (x + 16) + '" cy="527" rx="56" ry="10" fill="url(#sk-pool)"/>';
      s +=
        '<ellipse cx="' +
        (x + 16) +
        '" cy="552" rx="46" ry="5" fill="url(#sk-pool)" opacity=".5"/>';
    });
    LAMPS.forEach((x) => {
      s +=
        rect(x - 1.6, GROUND + 2, 3.2, 3, 'fill="#22324A"') +
        '<path d="M' +
        x +
        ' ' +
        (GROUND + 3) +
        'V454q0 -5 6 -5h9" fill="none" stroke="#2C3D58" stroke-width="1.8"/>' +
        rect(x + 12, 447.4, 10, 2.8, 'rx="1.4" fill="#33465F"');
    });

    // ---------- машинууд ----------
    // хэлбэр бүр: урд тал +x, дугуйн суурь y=0. gt — шилний дээд ирмэг, belt — цонхны доод шугам.
    const CAR = {
      sedan: {
        L: 46,
        r: 3.7,
        wx: [9, 37.5],
        gt: -14.7,
        belt: -10,
        hl: -7.6,
        tl: -8.4,
        th: 2.2,
        body: 'M1 -4C1 -7.5 2 -9 5 -9.4L12 -10.2C15 -14.2 18 -15.4 22 -15.5L27 -15.5C30 -15.4 32 -13.5 35 -10.4L43 -9.4C45 -9 46 -7.6 46 -5.6L46 -3.4C46 -2.4 45.4 -2 44.6 -2L1.6 -2C1 -2 1 -2.6 1 -4Z',
        glass:
          'M13.6 -10.3C16 -13.5 18.6 -14.6 22 -14.7L26.8 -14.7C29.3 -14.6 31.2 -13 33.4 -10.4Z',
        pil: [[23, 1]],
        seams: [13.2, 23.6, 34.2],
        handles: [20.5, 31],
      },
      hatch: {
        L: 38,
        r: 3.4,
        wx: [8, 30.5],
        gt: -15.2,
        belt: -10.8,
        hl: -7.4,
        tl: -10.4,
        th: 3,
        body: 'M1 -4L1 -9.5C1 -10.5 1.6 -11 2.4 -11.4L5.5 -15.6C6 -16.2 6.8 -16.5 7.8 -16.5L20 -16.5C22 -16.5 23.4 -15.6 25 -14L28.6 -10.6L35 -9.6C37 -9.2 38 -8 38 -6L38 -3.4C38 -2.4 37.4 -2 36.6 -2L2 -2C1.4 -2 1 -2.6 1 -4Z',
        glass: 'M4.6 -11.4L7.3 -15.2L19.8 -15.2C21.3 -15.2 22.5 -14.6 23.7 -13.4L26.6 -10.7Z',
        pil: [[14.6, 1.1]],
        seams: [15, 27.4],
        handles: [12.5, 24.4],
      },
      suv: {
        L: 48,
        r: 4.3,
        wx: [10, 38.5],
        gt: -18.3,
        belt: -12.8,
        hl: -9.6,
        tl: -12.6,
        th: 4,
        body: 'M1 -4L1 -11C1 -12 1.8 -12.6 3 -12.8L6 -18.6C6.4 -19.3 7 -19.6 8 -19.6L31 -19.6C32.4 -19.6 33.4 -19 34.4 -17.8L38.4 -12.6L45 -11.4C47 -11 48 -9.8 48 -8L48 -3.6C48 -2.6 47.4 -2 46.4 -2L2 -2C1.4 -2 1 -2.6 1 -4Z',
        glass: 'M3.8 -13L6.9 -18.3L30.6 -18.3C31.5 -18.3 32.3 -17.8 33.1 -16.8L36.4 -12.9Z',
        pil: [
          [14.6, 1.3],
          [25.4, 1.5],
        ],
        seams: [14.8, 26, 37],
        handles: [22.6, 33.6],
        extra: () =>
          rect(8, -20.5, 22, 0.9, 'fill="#0B0F15"') +
          rect(9.5, -20.2, 0.8, 0.8, 'fill="#0B0F15"') +
          rect(27.5, -20.2, 0.8, 0.8, 'fill="#0B0F15"'),
      },
      van: {
        L: 54,
        r: 4.2,
        wx: [10.5, 44],
        gt: -19.8,
        belt: -13.8,
        hl: -9,
        tl: -14.4,
        th: 4.4,
        body: 'M1 -4L1 -20C1 -21.4 2 -22 3.4 -22L40 -22C42 -22 43 -21.4 44 -20L49 -13L52 -12.2C53.4 -11.8 54 -10.6 54 -9L54 -3.6C54 -2.6 53.4 -2 52.4 -2L2 -2C1.4 -2 1 -2.6 1 -4Z',
        glass:
          'M3 -19.8H12.6V-14H3ZM14.2 -19.8H26V-14H14.2ZM27.6 -19.8H39.4V-14H27.6ZM41 -19.8H42.4L47.4 -13.6H41Z',
        pil: [],
        seams: [27, 40.6],
        handles: [37.6],
      },
      bus: {
        L: 112,
        r: 5,
        wx: [20, 92],
        gt: -30,
        belt: -18,
        hl: -8,
        tl: -11,
        th: 6,
        body: 'M1 -4L1 -31C1 -33 2 -34 4 -34L106 -34C108.5 -34 110 -33 110.6 -31L112 -16L112 -3.6C112 -2.6 111.4 -2 110.4 -2L2 -2C1.4 -2 1 -2.6 1 -4Z',
        glass: 'M99 -31H108.6L110.3 -18.4H99Z',
        pil: [],
        seams: [],
        handles: [],
        extra: () => {
          let o =
            rect(28, -36.4, 30, 2.6, 'rx="1" fill="#9AA6B5"') +
            rect(1, -16.5, 111, 3, 'fill="#fff" opacity=".2"');
          for (let i = 0; i < 5; i++) {
            const wx = 4 + i * 16;
            o += rect(wx, -31, 14, 12.4, 'fill="#FFEFC6" opacity=".86"');
            if (rnd() < 0.7)
              o +=
                circ(wx + between(3, 11), -23.4, 1.9, 'fill="#2A2A30" opacity=".7"') +
                rect(wx + 1, -21.6, 12, 2.6, 'fill="#2A2A30" opacity=".35"');
          }
          return (
            o +
            rect(84, -31, 10, 27, 'fill="#FFEFC6" opacity=".8"') +
            '<path d="M89 -31V-4" stroke="#1B2330" stroke-width=".8"/>' +
            rect(99.6, -33.2, 8.4, 1.8, 'fill="#FFB020"')
          );
        },
      },
    };
    const vehicle = (t, color) => {
      const v = CAR[t],
        L = v.L,
        r = v.r;
      let o =
        '<ellipse cx="' +
        L / 2 +
        '" cy="0" rx="' +
        n(L * 0.56) +
        '" ry="2" fill="#000" opacity=".55"/>' +
        '<path d="M' +
        (L - 0.5) +
        ' ' +
        n(v.hl - 1.2) +
        'L' +
        (L + 92) +
        ' ' +
        n(v.hl - 10) +
        'L' +
        (L + 98) +
        ' 1L' +
        (L - 0.5) +
        ' ' +
        n(v.hl + 1.4) +
        'Z" fill="url(#sk-beam)"/>' +
        '<ellipse cx="' +
        (L + 44) +
        '" cy="-.4" rx="36" ry="2.8" fill="url(#sk-spot)"/>' +
        '<ellipse cx="-1" cy="' +
        v.tl +
        '" rx="8" ry="4.5" fill="url(#sk-tail)"/>' +
        '<path d="' +
        v.body +
        '" fill="' +
        color +
        '"/>' +
        (v.extra ? v.extra() : '') +
        '<path d="' +
        v.glass +
        '" fill="url(#sk-glass)"/>';
      v.pil.forEach(
        ([px, pw]) => (o += rect(px, v.gt - 0.3, pw, v.belt - v.gt + 0.6, 'fill="' + color + '"')),
      );
      o += '<path d="' + v.body + '" fill="url(#sk-car)"/>';
      if (v.seams.length)
        o +=
          '<path d="' +
          v.seams.map((x) => 'M' + x + ' ' + v.belt + 'V-3.4').join('') +
          '" stroke="#000" stroke-opacity=".38" stroke-width=".45"/>';
      v.handles.forEach((hx) => (o += rect(hx, v.belt + 1.3, 2, 0.6, 'fill="#fff" opacity=".28"')));
      o +=
        '<path d="M2.2 ' +
        v.belt +
        'H' +
        (L - 4) +
        '" stroke="#fff" stroke-opacity=".12" stroke-width=".4"/>' +
        '<path d="M3 -3.1H' +
        (L - 2) +
        '" stroke="#000" stroke-opacity=".4" stroke-width=".9"/>' +
        '<path d="M' +
        (L - 2.6) +
        ' ' +
        n(v.hl - 1.1) +
        'h2.3v2.3h-2.8z" fill="#FFF6DA"/>' +
        circ(L - 0.6, v.hl, 2.8, 'fill="#FFF2CC" opacity=".45"') +
        rect(0.5, v.tl - v.th / 2, 1.6, v.th, 'fill="#E8302A"');
      v.wx.forEach((cx) => {
        o +=
          circ(cx, -r, r + 0.9, 'fill="#05080D"') +
          circ(cx, -r, r, 'fill="#15181D"') +
          circ(cx, -r, r * 0.62, 'fill="#6E7886"') +
          circ(cx, -r, r * 0.44, 'fill="#3A424E"') +
          circ(cx, -r, r * 0.15, 'fill="#9AA3AF"');
      });
      return o;
    };
    // dir: 1 = баруун тийш; y = дугуйн суурь; k = масштаб (алс эгнээ жижиг)
    const lane = (dir, y, k, dur, list) =>
      list
        .map(([t, color, beg]) => {
          const from = dir > 0 ? -200 : 1000,
            to = dir > 0 ? 1000 : -200;
          return (
            '<g><animateTransform attributeName="transform" type="translate" from="' +
            from +
            ' ' +
            y +
            '" to="' +
            to +
            ' ' +
            y +
            '" dur="' +
            dur +
            's" begin="' +
            beg +
            's" repeatCount="indefinite"/><g transform="scale(' +
            dir * k +
            ' ' +
            k +
            ')">' +
            vehicle(t, color) +
            '</g></g>'
          );
        })
        .join('');
    s +=
      lane(1, 528, 0.68, 18, [
        ['sedan', '#9AA3AE', 0],
        ['hatch', '#7A2A33', -3],
        ['suv', '#1C2028', -6.2],
        ['sedan', '#D3D7DD', -9.1],
        ['van', '#5F6773', -12.4],
        ['sedan', '#2B4A6F', -15.3],
      ]) +
      lane(-1, 555, 0.86, 13, [
        ['bus', '#2F5F96', 0],
        ['sedan', '#1E2633', -2.5],
        ['suv', '#B8BEC6', -4.8],
        ['hatch', '#3E5C4A', -7.5],
        ['sedan', '#6B1E26', -10.2],
      ]);

    // ---------- гудамжны гэрлийн туяа (машин дээр тусна) ----------
    LAMPS.forEach((x) => {
      s +=
        '<path d="M' +
        (x + 13) +
        ' 450L' +
        (x + 21) +
        ' 450L' +
        (x + 64) +
        ' 560L' +
        (x - 32) +
        ' 560Z" fill="url(#sk-cone)" opacity=".5"/>' +
        rect(x + 13, 450, 8, 1.4, 'rx=".7" fill="#FFE7B3"') +
        '<ellipse cx="' +
        (x + 17) +
        '" cy="451" rx="9" ry="4" fill="#FFE2A8" opacity=".25"/>';
    });
    return s + '</svg>';
  }

  /** Тойрог прогресс (ажилтны өнөөдрийн гүйцэтгэл) */
  function ring(p, size = 90) {
    const C = 263.9;
    return Nar.raw(
      '<svg width="' +
        size +
        '" height="' +
        size +
        '" viewBox="0 0 100 100" style="transform:rotate(-90deg)"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface2)" stroke-width="10"/><circle cx="50" cy="50" r="42" fill="none" stroke="#2EAE68" stroke-width="10" stroke-linecap="round" stroke-dasharray="' +
        C +
        '" stroke-dashoffset="' +
        C * (1 - p) +
        '" style="transition:stroke-dashoffset .7s"/></svg>',
    );
  }

  /**
   * Хотхоны сангийн сав — зоосоор дүүрэх хэмжээ = сангийн хүрэлцээ (0..1).
   * Төлөөгүй бол дээрээс зоос унаж "та ч нэмээрэй" гэж урина, төлсөн бол зүрх гарна.
   */
  let jarN = 0;
  function fundJar(cover, paid, size = 120) {
    const id = 'jar' + ++jarN;
    const top = 40,
      bottom = 146,
      h = bottom - top;
    const lvl = bottom - h * Math.max(0.04, Math.min(1, cover));
    const col = cover >= 1 ? '#2EAE68' : cover >= 0.8 ? '#F0B03E' : '#E0525A';
    const coins = [];
    for (let y = bottom - 8, r = 0; y > lvl + 6; y -= 9, r++)
      for (let x = 30 + (r % 2) * 9; x < 92; x += 18)
        coins.push(
          '<ellipse cx="' +
            x +
            '" cy="' +
            y +
            '" rx="8" ry="3.2" fill="#F6C445" stroke="#C8941A" stroke-width="1"/>',
        );
    return Nar.raw(
      '<svg class="jar" width="' +
        size +
        '" height="' +
        size * 1.3 +
        '" viewBox="0 0 120 156" aria-hidden="true">' +
        '<defs><clipPath id="' +
        id +
        '"><path d="M24 44h72v92a12 12 0 0 1-12 12H36a12 12 0 0 1-12-12z"/></clipPath></defs>' +
        '<ellipse cx="60" cy="150" rx="40" ry="5" fill="#000" opacity=".12"/>' +
        '<g clip-path="url(#' +
        id +
        ')">' +
        '<rect x="20" y="40" width="80" height="112" fill="var(--surface2, #EEF2F6)"/>' +
        '<rect x="20" y="' +
        lvl +
        '" width="80" height="' +
        (bottom + 10 - lvl) +
        '" fill="#FBD873"/>' +
        coins.join('') +
        '<path class="jar-wave" d="M0 ' +
        lvl +
        ' q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v8 h-140z" fill="#FFE7A3" opacity=".9"/>' +
        '</g>' +
        // хэрэгцээт түвшин (100%)
        '<line x1="20" y1="' +
        top +
        '" x2="100" y2="' +
        top +
        '" stroke="' +
        col +
        '" stroke-width="2" stroke-dasharray="4 3"/>' +
        '<path d="M24 44h72v92a12 12 0 0 1-12 12H36a12 12 0 0 1-12-12z" fill="none" stroke="#9FB3C8" stroke-width="3"/>' +
        '<rect x="30" y="30" width="60" height="12" rx="4" fill="#9FB3C8"/>' +
        '<path d="M32 60v60" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>' +
        (paid
          ? '<g class="jar-heart"><path d="M60 22c-6-9-20-5-17 5 2 6 17 15 17 15s15-9 17-15c3-10-11-14-17-5z" fill="#E0525A"/></g>' +
            '<circle class="jar-spark" cx="98" cy="24" r="3" fill="#F6C445"/><circle class="jar-spark s2" cx="22" cy="30" r="2.5" fill="#F6C445"/>'
          : '<g class="jar-coin"><circle cx="60" cy="0" r="9" fill="#F6C445" stroke="#C8941A" stroke-width="1.6"/>' +
            '<text x="60" y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#8A5A00">₮</text></g>') +
        '</svg>',
    );
  }

  /* ======================================================================
     Web Component-ууд (Shadow DOM): SVG болон CSS нь бүрэн тусгаарлагдсан.
     CSS: css/components/<нэр>.css (өнгө нь nar.css-ийн --token-оор light/dark-д дагана)
     ====================================================================== */
  const C = 'css/components/';
  const { define } = Nar;

  /** <sokh-worker-scene kind="lift|pipe|light|gen|walk"> — засварын явцын анимаци */
  define('sokh-worker-scene', {
    attrs: ['kind'],
    shadow: true,
    styles: [C + 'worker-scene.css'],
    render: (el) => workerScene(el.str('kind', 'gen')),
  });

  /** <sokh-leak-building b="3" storm data='[...leaks]'> — байрны зүсэлт, бороо, ус алдалт */
  define('sokh-leak-building', {
    attrs: ['b', 'storm', 'data'],
    shadow: true,
    styles: [C + 'leak-building.css'],
    render: (el) => leakBuilding(el.num('b', 1), el.data('data', []), el.bool('storm')),
  });

  /** <sokh-flower wilt="0.4" paid size="130"> — төлбөр төлөхгүй бол хатна */
  define('sokh-flower', {
    attrs: ['wilt', 'paid', 'size'],
    shadow: true,
    styles: [C + 'flower.css'],
    css: ':host{display:inline-flex;flex-shrink:0}',
    render: (el) => flower(el.num('wilt'), el.bool('paid'), el.num('size', 170)),
  });

  /** <sokh-avatar size="50"> — хөтөч Сараа */
  define('sokh-avatar', {
    attrs: ['size'],
    shadow: true,
    styles: [C + 'avatar.css'],
    css: ':host{display:inline-flex}',
    render: (el) => avatar(el.num('size', 78)),
  });

  /** <sokh-ring value="0.6" size="90"> — тойрог прогресс */
  define('sokh-ring', {
    attrs: ['value', 'size'],
    shadow: true,
    css: ':host{display:inline-flex;flex-shrink:0}svg{display:block}',
    render: (el) => ring(el.num('value'), el.num('size', 90)),
  });

  /** <sokh-fund-jar cover="0.86" paid size="96"> — хотхоны сангийн сав */
  define('sokh-fund-jar', {
    attrs: ['cover', 'paid', 'size'],
    shadow: true,
    styles: [C + 'fund-jar.css'],
    css: ':host{display:inline-flex;flex-shrink:0}',
    render: (el) => fundJar(el.num('cover'), el.bool('paid'), el.num('size', 120)),
  });

  /** <sokh-skyline> — шөнийн хот. ~4k элементтэй тул SVG-г нэг л удаа үүсгээд clone хийнэ */
  let skyTpl = null;
  define('sokh-skyline', {
    shadow: true,
    css: ':host{display:block;pointer-events:none}svg{display:block;width:100%;height:100%}',
    init(el) {
      if (!skyTpl) {
        skyTpl = document.createElement('template');
        skyTpl.innerHTML = buildSkyline();
      }
      el.root.style.cssText = 'width:100%;height:100%';
      el.root.appendChild(skyTpl.content.cloneNode(true));
    },
  });

  window.W = { kindOf };
})();
