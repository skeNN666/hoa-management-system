/* СӨХ Platform — SVG/HTML widget: ажилтны засварын анимаци, ус алдалтын байрны зүсэлт, цэцэг, хөтөч Сараа, skyline. */
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
        '" data-key="ws-' +
        kind +
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

  /** 16 давхар × 13 айлын зүсэлт: бороо, босоо хоолойд урсах ус, алдсан айлын долгион */
  function leakBuilding(b, leaks, storm) {
    const mine = leaks.filter((x) => x.b === b && x.st !== 'fixed');
    const riserCls = (k) => {
      const xs = mine.filter((x) => Math.abs(((x.u - 1) % 13) - RISERS[k]) <= 1);
      return xs.some((x) => x.st === 'active') ? 'alarm' : xs.length ? 'stop' : '';
    };
    let rows = '';
    for (let f = 16; f >= 1; f--) {
      let cells = '';
      if (f === 16)
        cells += RISERS.map(
          (c, k) =>
            '<span class="riser ' +
            riserCls(k) +
            '" style="left:calc(' +
            ((c + 1) / 13) * 100 +
            '% - 2px)"></span>',
        ).join('');
      for (let k = 0; k < 13; k++) {
        const u = (f - 1) * 13 + k + 1;
        const L = mine.find((x) => x.u === u);
        const below = mine.find((x) => x.st === 'active' && x.u === u + 13);
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
        '<div class="lk-bld">' +
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

  function skyline() {
    const GROUND = 500;
    // Жижиг барилгууд — тогтмол (deterministic) өндөр, өргөн
    const B = [];
    for (let x = 0, i = 0; x < 800; i++) {
      const w = 34 + ((i * 37) % 4) * 6;
      const h = 80 + ((i * 53 + 17) % 9) * 17;
      B.push([x, w, h]);
      x += w + 4 + (i % 3) * 3;
    }
    let s =
      '<svg class="skyline" viewBox="0 0 800 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><circle cx="640" cy="150" r="24" fill="#FFF4C8" opacity=".9"/><circle cx="640" cy="150" r="66" fill="#FFF4C8" opacity=".08"/>';
    B.forEach(([x, w, h], i) => {
      const top = GROUND - h;
      s +=
        '<rect x="' +
        x +
        '" y="' +
        top +
        '" width="' +
        w +
        '" height="' +
        h +
        '" fill="' +
        (i % 2 ? '#16243A' : '#1A2B44') +
        '"/>';
      const cols = Math.floor((w - 6) / 10),
        rows = Math.floor((h - 10) / 13),
        ox = x + (w - cols * 10 + 4) / 2;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const k = (r * 7 + c * 13 + i * 5) % 11,
            on = k > 2,
            a = on ? 0.88 : 0.1,
            b = on ? 0.1 : 0.88;
          let win =
            '<rect x="' +
            (ox + c * 10) +
            '" y="' +
            (top + 8 + r * 13) +
            '" width="6" height="7" rx="1" fill="#F6C445" opacity="' +
            a +
            '">';
          // ~40% цонх асч/унтарна (discrete — гэнэт асах, унтрах)
          if ((r * 3 + c * 5 + i) % 5 < 2) {
            const dur = 5 + ((r + c * 2 + i) % 9),
              beg = -((r * 11 + c * 7 + i * 3) % dur),
              t = (0.3 + ((r + c + i) % 5) * 0.1).toFixed(2);
            win +=
              '<animate attributeName="opacity" values="' +
              a +
              ';' +
              b +
              ';' +
              a +
              '" keyTimes="0;' +
              t +
              ';' +
              Math.min(0.95, +t + 0.25).toFixed(2) +
              '" calcMode="discrete" dur="' +
              dur +
              's" begin="' +
              beg +
              's" repeatCount="indefinite"/>';
          }
          s += win + '</rect>';
        }
    });
    // Зам, явган хүний зам, гудамжны гэрэл
    s +=
      '<rect x="0" y="' +
      GROUND +
      '" width="800" height="4" fill="#22344F"/><rect x="0" y="504" width="800" height="56" fill="#0E1A2B"/>' +
      '<line x1="0" y1="526" x2="800" y2="526" stroke="#F6C445" stroke-width="1.5" stroke-dasharray="14 12" opacity=".55"/>';
    for (let x = 40; x < 800; x += 150)
      s +=
        '<rect x="' +
        x +
        '" y="' +
        (GROUND - 30) +
        '" width="2" height="30" fill="#2A3D58"/><rect x="' +
        (x - 4) +
        '" y="' +
        (GROUND - 32) +
        '" width="10" height="3" rx="1.5" fill="#2A3D58"/><circle cx="' +
        (x + 4) +
        '" cy="' +
        (GROUND - 28) +
        '" r="2" fill="#FFE9A8"/><ellipse cx="' +
        (x + 4) +
        '" cy="' +
        (GROUND + 2) +
        '" rx="22" ry="5" fill="#FFE9A8" opacity=".08"/>';
    // Машинууд: дээд эгнээ баруун тийш, доод эгнээ зүүн тийш
    const car = (dir, y, color, dur, beg) => {
      const body =
        '<path d="M30 -5 L60 -10 L60 1 Z" fill="#FFE9A8" opacity=".09"/>' +
        '<path d="M6 -8 L10 -13 H20 L25 -8 Z" fill="' +
        color +
        '"/><rect x="0" y="-8.5" width="31" height="7" rx="2.5" fill="' +
        color +
        '"/>' +
        '<rect x="11" y="-12" width="4.5" height="3.5" fill="#9FC3E8" opacity=".6"/><rect x="16.5" y="-12" width="4.5" height="3.5" fill="#9FC3E8" opacity=".6"/>' +
        '<rect x="29" y="-7" width="2.5" height="2" fill="#FFF4C8"/><rect x="-0.5" y="-7" width="2" height="2" fill="#FF4D4D"/>' +
        '<circle cx="7" cy="-1.5" r="2.4" fill="#05090F"/><circle cx="24" cy="-1.5" r="2.4" fill="#05090F"/>';
      const from = dir > 0 ? '-80 ' + y : '880 ' + y,
        to = dir > 0 ? '880 ' + y : '-80 ' + y;
      return (
        '<g><animateTransform attributeName="transform" type="translate" from="' +
        from +
        '" to="' +
        to +
        '" dur="' +
        dur +
        's" begin="' +
        beg +
        's" repeatCount="indefinite"/>' +
        (dir > 0 ? body : '<g transform="scale(-1 1)">' + body + '</g>') +
        '</g>'
      );
    };
    s +=
      car(1, 520, '#E2574C', 9, 0) +
      car(1, 520, '#3D8FD6', 9, -3) +
      car(1, 520, '#F2F2F2', 9, -6.5) +
      car(-1, 540, '#F6C445', 7.5, -1) +
      car(-1, 540, '#2EAE68', 7.5, -4) +
      car(-1, 540, '#8A6CD8', 11, -7);
    return Nar.raw(s + '</svg>');
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

  window.W = { kindOf, workerScene, leakBuilding, flower, avatar, skyline, ring, fundJar };
})();
