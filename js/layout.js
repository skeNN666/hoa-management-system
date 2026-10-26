/*
 * СӨХ Platform — Хотхоны бүтцийн model (layout).
 * Хотхон бүр өөрийн map-тай: байр, зам, талбай, зогсоол, гэрэл, мод бүгд нэг JSON-д байна.
 * 3D map (scenes.js), зогсоол, айлын жагсаалт, гэрэл бүгд энэ model-оос уншина.
 *
 *   Layout.current()              → одоо сонгосон хотхоны layout
 *   Layout.parse('8 байр, 12-20 давхар, 60 зогсоол, тоглоомын талбай')  → spec
 *   Layout.generate(spec)         → бүрэн layout (байрлал, зам, зогсоол, гэрэл, мод)
 *   Layout.save(L) / reset(id) / get(id) / original(id) / setCurrent(id) — хотхон зөвхөн өөрийнхийгөө
 *   Layout.normalize(json)        → гаднаас оруулсан JSON-ыг шалгаж засна
 *   Layout.route(L, from, to)     → замын дагуух явган хүний зам
 *   Layout.svg(L)                 → дээрээс харсан 2D зураг (preview)
 *
 * Координат: метр биш "scene unit" (1 ≈ 10м-ийн 1/10), төв нь (0,0), x → зүүн, z → урд.
 * Тэгш өнцөгт бүр { x, z, w, d } — x,z нь баруун-хойд булан.
 *
 * Layout схем:
 * {
 *   id, n, sokh, d (дүүрэг), c (өнгө), size: [W, D],
 *   roads:     [{ x1, z1, x2, z2, w }]                      // зөвхөн хэвтээ / босоо
 *   pads:      [{ x, z, w, d }]                             // бетон талбай (өндөр 0.3)
 *   buildings: [{ n, x, z, w, d, fl, door: 'n'|'s'|'e'|'w', per, units }]
 *   parks:     [{ kind: 'play'|'sport', x, z, w, d }]
 *   lots:      [{ id, x, z, cols, aisles, n, entry: 'w'|'e', lane, gate }]
 *   garage:    40,                                          // газар доорх гаражийн зогсоол
 *   lights:    [{ x, z, loc }],  trees: [[x, z, pine]]
 * }
 */
(function () {
  const KEY = 'sokh-layouts',
    CUR = 'sokh-cx';
  const SPOT_W = 2.5, // зогсоолын өргөн
    ROW = 4.4, // нэг эгнээний хоёр талын зогсоолын төв хоорондын зай
    UNIT = 7.1; // эгнээ + хоёр тал + хашлага
  const PAD_H = 0.3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = (v) => Math.round(v * 100) / 100;
  function rng(seed) {
    let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  const hash = (t) => {
    let h = 7;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 1e9;
    return h;
  };

  /* ---------- зогсоолын геометр ---------- */
  const lotSize = (l) => ({ w: l.cols * SPOT_W + 0.8, d: l.aisles * UNIT + 0.3 });
  /** Зогсоол бүрийн байрлал: { x, z, az (эгнээний z) }. Дараалал: эгнээ эгнээгээр. */
  function lotSpots(l) {
    const { w } = lotSize(l);
    const out = [];
    for (let i = 0; i < l.n; i++) {
      const r = Math.floor(i / l.cols),
        c = i % l.cols,
        u = Math.floor(r / 2);
      const x =
        l.entry === 'e'
          ? l.x + w - 0.4 - SPOT_W / 2 - c * SPOT_W
          : l.x + 0.4 + SPOT_W / 2 + c * SPOT_W;
      out.push({
        x,
        z: l.z + 1.5 + u * UNIT + (r % 2) * ROW,
        az: l.z + 1.5 + u * UNIT + ROW / 2,
      });
    }
    return out;
  }
  const lotEx = (l) => (l.entry === 'e' ? l.x + lotSize(l).w + 1.1 : l.x - 1.1);

  /* ======================================================================
     Нарны хотхон — гараар зурсан анхны map (хуучин пиксел координатаас хөрвүүлсэн)
     ====================================================================== */
  const P = (x, y) => [r1((x - 380) / 10), r1((y - 280) / 10)];
  const NARNY = {
    id: 'narny',
    n: 'Нарны хотхон',
    sokh: 'Нарны СӨХ',
    d: 'Хан-Уул',
    c: '#0A72B8',
    size: [84, 64],
    roads: [
      { x1: -42, z1: -2, x2: 42, z2: -2, w: 4.8 },
      { x1: -0.5, z1: -32, x2: -0.5, z2: 32, w: 5 },
    ],
    pads: [
      { x: -36.6, z: -26.6, w: 32.2, d: 21.2 },
      { x: 3.4, z: -26.6, w: 33.2, d: 21.2 },
      { x: -36.6, z: 1.8, w: 32.2, d: 24.8 },
      { x: 3.4, z: 1.8, w: 33.2, d: 24.8 },
    ],
    buildings: [
      [36, 56, 110, 70, 16, 's'],
      [192, 44, 118, 84, 14, 's'],
      [432, 36, 78, 78, 22, 's'],
      [40, 334, 110, 78, 12, 'n'],
      [204, 392, 104, 96, 16, 'n'],
      [440, 316, 280, 62, 9, 'n'],
    ].map(([x, y, w, d, fl, door], i) => {
      const [X, Z] = P(x, y);
      return { n: i + 1, x: X, z: Z, w: w / 10, d: d / 10, fl, door, per: 13, units: 208 };
    }),
    parks: [{ kind: 'play', x: 16, z: -24, w: 19, d: 16.8 }],
    lots: [{ id: 'p', x: 4.6, z: 11.3, cols: 12, aisles: 2, n: 48, entry: 'w', lane: 1, gate: 31 }],
    garage: 40,
    lights: [
      [40, 226, 'Гол зам · 1-р байр'],
      [130, 226, 'Гол зам · 1-р байр'],
      [220, 226, 'Гол зам · 2-р байр'],
      [310, 226, 'Гол зам · 2-р байр'],
      [440, 226, 'Гол зам · 3-р байр'],
      [540, 226, 'Гол зам · тоглоомын талбай'],
      [640, 226, 'Гол зам · тоглоомын талбай'],
      [730, 226, 'Гол зам · зүүн хэсэг'],
      [90, 292, 'Гол зам · 4-р байр'],
      [220, 292, 'Гол зам · 4-р байр'],
      [470, 292, 'Гол зам · 6-р байр'],
      [660, 292, 'Гол зам · 6-р байр'],
      [342, 60, 'Төв зам · хойд'],
      [408, 140, 'Төв зам · 3-р байр'],
      [342, 190, 'Төв зам · 2-р байр'],
      [408, 340, 'Төв зам · 6-р байр'],
      [342, 420, 'Төв зам · 5-р байр'],
      [408, 500, 'Төв зам · урд'],
      [530, 170, 'Тоглоомын талбай · баруун'],
      [620, 170, 'Тоглоомын талбай · зүүн'],
      [470, 465.5, 'Зогсоол · баруун'],
      [575, 465.5, 'Зогсоол · төв'],
      [690, 465.5, 'Зогсоол · зүүн'],
      [375, 520, 'Орцны хаалга'],
    ].map(([x, y, loc]) => {
      const [X, Z] = P(x, y);
      return { x: X, z: Z, loc };
    }),
    trees: [
      [20, 30, 0],
      [160, 30, 1],
      [170, 150, 0],
      [24, 150, 1],
      [180, 210, 0],
      [330, 30, 0],
      [330, 120, 1],
      [520, 30, 0],
      [522, 120, 0],
      [740, 30, 1],
      [740, 210, 0],
      [560, 220, 0],
      [690, 212, 1],
      [24, 310, 0],
      [170, 312, 1],
      [170, 420, 0],
      [40, 520, 1],
      [130, 520, 0],
      [320, 320, 0],
      [320, 530, 1],
      [190, 530, 0],
      [736, 300, 0],
      [600, 300, 0],
      [520, 300, 1],
    ].map(([x, y, p]) => [...P(x, y), p]),
    spec: {
      text: 'Гараар зурсан анхны map',
      manual: true,
      buildings: 6,
      floors: [9, 22],
      per: 13,
      slots: 48,
      garage: 40,
      play: true,
    },
  };

  /** Бусад жишээ хотхонууд — spec-ээс автоматаар үүснэ */
  const DEMO = [
    {
      id: 'altan',
      n: 'Алтан гадас хотхон',
      sokh: 'Алтан гадас СӨХ',
      d: 'Баянгол',
      c: '#B5651E',
      buildings: 8,
      floors: [12, 20],
      slots: 64,
      garage: 30,
      play: true,
      sport: true,
      style: 'grid',
      seed: 31,
    },
    {
      id: 'khangai',
      n: 'Хангай хотхон',
      sokh: 'Хангай-Өргөө СӨХ',
      d: 'Баянзүрх',
      c: '#0E7268',
      buildings: 6,
      floors: [9, 14],
      slots: 40,
      garage: 0,
      play: true,
      sport: false,
      style: 'row',
      seed: 7,
    },
    {
      id: 'od',
      n: 'Од хотхон',
      sokh: 'Од-Эрдэм СӨХ',
      d: 'Баянзүрх',
      c: '#6D3FD6',
      buildings: 4,
      floors: [16, 24],
      slots: 32,
      garage: 24,
      play: true,
      sport: false,
      style: 'grid',
      seed: 12,
    },
    {
      id: 'tsetseg',
      n: 'Цэцэг хотхон',
      sokh: 'Цэцэг СӨХ',
      d: 'Сүхбаатар',
      c: '#2E8B57',
      buildings: 5,
      floors: [5, 9],
      slots: 36,
      garage: 0,
      play: true,
      sport: true,
      style: 'row',
      seed: 5,
    },
  ];

  /* ======================================================================
     "Model": текстээс хотхоны spec ойлгох (кирилл болон латин галиг)
     ====================================================================== */
  const DISTRICTS = [
    ['Хан-Уул', /хан[- ]?уул|han[- ]?uul|khan[- ]?uul/],
    ['Баянгол', /баянгол|bayangol/],
    ['Баянзүрх', /баянзүрх|bayanzurh|bayanzurkh/],
    ['Сүхбаатар', /сүхбаатар|suhbaatar|sukhbaatar/],
    ['Чингэлтэй', /чингэлтэй|chingeltei/],
    ['Сонгинохайрхан', /сонгинохайрхан|songino/],
    ['Налайх', /налайх|nalaih/],
    ['Багануур', /багануур|baganuur/],
  ];
  const DEF = {
    n: 'Шинэ хотхон',
    d: 'Хан-Уул',
    buildings: 6,
    floors: [9, 16],
    per: 0,
    slots: 48,
    garage: 0,
    play: true,
    sport: false,
    style: 'grid',
    seed: 1,
  };
  function parse(text, base) {
    const t = String(text || '').toLowerCase();
    const sp = Object.assign({}, DEF, base || {}, { text: String(text || '') });
    const got = [];
    const num = (re) => {
      const m = t.match(re);
      return m ? Number(m[1] || m[2]) : null;
    };
    const nm = String(text || '').match(
      /([A-Za-zА-ЯЁӨҮа-яёөү][A-Za-zА-ЯЁӨҮа-яёөү-]+)\s+(?:хотхон|hothon|xotxon|khotkhon)/i,
    );
    if (nm) {
      const w = nm[1];
      sp.n = w[0].toUpperCase() + w.slice(1) + ' хотхон';
      got.push(sp.n);
    }
    const dist = DISTRICTS.find(([, re]) => re.test(t));
    if (dist) {
      sp.d = dist[0];
      got.push(dist[0] + ' дүүрэг');
    }
    const b = num(/(\d+)\s*(?:ш\.?\s*)?(?:байр|блок|барилга|bair|block|building|корпус)/);
    if (b) {
      sp.buildings = clamp(b, 1, 24);
      got.push(sp.buildings + ' байр');
    }
    const fm = t.match(
      /(\d+)\s*(?:[-–~]|аас|ээс|оос|-?с)?\s*(\d+)?\s*(?:давхар|davhar|davxar|floor)/,
    );
    if (fm) {
      const a = Number(fm[1]),
        z = fm[2] ? Number(fm[2]) : null;
      sp.floors = z
        ? [clamp(Math.min(a, z), 2, 40), clamp(Math.max(a, z), 2, 40)]
        : [clamp(a - 2, 2, 40), clamp(a + 2, 2, 40)];
      if (!z && a <= 5) sp.floors = [a, a];
      got.push(
        sp.floors[0] === sp.floors[1] ? sp.floors[0] + ' давхар' : sp.floors.join('–') + ' давхар',
      );
    }
    const per = num(/давхартаа\s*(\d+)|(\d+)\s*айл\s*(?:\/|нэг)?\s*давхар/);
    if (per) {
      sp.per = clamp(per, 2, 24);
      got.push('давхартаа ' + sp.per + ' айл');
    }
    if (/зогсоолгүй|zogsoolgui/.test(t)) {
      sp.slots = 0;
      got.push('гадна зогсоолгүй');
    } else {
      const s = num(
        /(\d+)\s*(?:машины\s*|mashiny\s*)?(?:зогсоол|zogsool|parking)|(?:зогсоол|zogsool|parking)\D{0,12}(\d+)/,
      );
      if (s != null) {
        sp.slots = clamp(s, 0, 160);
        got.push(sp.slots + ' зогсоол');
      }
    }
    if (/гаражгүй|garajgui/.test(t)) sp.garage = 0;
    else if (/гараж|garaj|garage|газар доорх|gazar doorh/.test(t)) {
      const g = num(
        /(\d+)\s*(?:машины\s*)?(?:гараж|garaj|garage)|(?:гараж|garaj|garage|газар доорх|gazar doorh)\D{0,16}(\d+)/,
      );
      sp.garage = clamp(g || 40, 4, 120);
      got.push('гараж ' + sp.garage);
    }
    if (/талбайгүй|talbaigui/.test(t)) sp.play = false;
    else if (/тоглоомын|хүүхдийн|playground|togloom|huuhdiin/.test(t)) {
      sp.play = true;
      got.push('тоглоомын талбай');
    }
    if (/спорт|сагс|sport|sags|баскет/.test(t)) {
      sp.sport = true;
      got.push('спорт талбай');
    }
    if (/эгнээ|нэг шугам|egnee|row|урт/.test(t)) {
      sp.style = 'row';
      got.push('нэг эгнээ');
    } else if (/хоёр тал|тор|grid|блок блокоор/.test(t)) {
      sp.style = 'grid';
      got.push('хоёр талдаа');
    }
    sp.seed = (base && base.seed) || hash(t) % 997 || 1;
    sp.got = got;
    return sp;
  }

  /* ======================================================================
     Map үүсгэгч: spec → бүрэн layout
     Бүтэц: хэвтээ гол зам(ууд) + төвийн босоо зам. Гол зам бүрийн хойд, урд талд
     "эгнээ" (band) байх ба байрнууд хаалгаараа зам руу харна. Зогсоол төв замын
     хажууд байрлаж машин төв замаар орж ирнэ.
     ====================================================================== */
  const RW = 4.8, // гол замын өргөн
    VW = 5, // төв замын өргөн
    GAP = 4.2;
  function generate(spec0) {
    const sp = Object.assign({}, DEF, spec0);
    const r = rng(sp.seed * 7919 + sp.buildings * 31 + (sp.slots || 0));
    const [f0, f1] = sp.floors;
    const items = [];
    for (let i = 0; i < sp.buildings; i++) {
      const fl = Math.round(f0 + r() * (f1 - f0));
      let w, d;
      if (fl >= 18)
        w = d = 7.4 + r() * 1.4; // цамхаг
      else if (fl <= 12 && r() < 0.28) {
        w = 18 + r() * 9; // урт байр
        d = 5.8 + r() * 0.8;
      } else {
        w = 9.6 + r() * 2.8;
        d = 6.8 + r() * 1.8;
      }
      const per = sp.per || clamp(Math.round((w * d) / 7), 4, 16);
      items.push({ k: 'b', w: r1(w), d: r1(d), fl, per });
    }
    if (sp.play) items.push({ k: 'play', w: r1(15 + r() * 4), d: r1(13 + r() * 3) });
    if (sp.sport) items.push({ k: 'sport', w: 15, d: 9 });
    let lot = null;
    if (sp.slots > 0) {
      const aisles = sp.slots <= 24 ? 1 : sp.slots <= 84 ? 2 : 3;
      const cols = Math.ceil(sp.slots / (2 * aisles));
      lot = { k: 'lot', cols, aisles, n: sp.slots, ...lotSize({ cols, aisles }) };
    }

    // эгнээнүүдэд хуваарилах
    const total = items.reduce((a, x) => a + x.w + GAP, 0) + (lot ? lot.w + GAP : 0);
    const nRoads = sp.style === 'row' ? 1 : clamp(Math.ceil(total / 150), 1, 3);
    const bands = Array.from({ length: nRoads * 2 }, (_, i) => ({
      road: Math.floor(i / 2),
      south: i % 2 === 1,
      W: [],
      E: [],
      len: [0, 0],
    }));
    const put = (bd, it, side) => {
      const s = side || (bd.len[0] <= bd.len[1] ? 0 : 1);
      (s ? bd.E : bd.W).push(it);
      bd.len[s] += it.w + GAP;
    };
    if (lot) put(bands[1], lot, 1); // зогсоол: 1-р гол замын урд, төв замын зүүн талд
    const order = items.slice().sort((a, b) => b.w - a.w);
    order.forEach((it) => {
      let cand = bands;
      if (sp.style === 'row' && nRoads === 1) cand = it.k === 'b' ? [bands[0]] : [bands[1]];
      const bd = cand.reduce((m, x) => (x.len[0] + x.len[1] < m.len[0] + m.len[1] ? x : m));
      put(bd, it);
    });
    // эгнээ бүрт санамсаргүй дараалал (зогсоол төв замын хажууд үлдэнэ)
    bands.forEach((bd) => {
      [bd.W, bd.E].forEach((L) => {
        const fixed = L[0] && L[0].k === 'lot' ? L.shift() : null;
        for (let i = L.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [L[i], L[j]] = [L[j], L[i]];
        }
        if (fixed) L.unshift(fixed);
      });
    });

    // z байрлал: гол зам бүрийн хоорондох зай = урд эгнээ + ногоон зурвас + хойд эгнээ
    const SET = 3.2;
    const depth = (bd) => Math.max(0, ...bd.W.concat(bd.E).map((x) => x.d));
    const roadZ = [0];
    for (let k = 1; k < nRoads; k++)
      roadZ.push(roadZ[k - 1] + RW + 2 * SET + depth(bands[2 * k - 1]) + 7 + depth(bands[2 * k]));
    const placed = [];
    bands.forEach((bd) => {
      const zr = roadZ[bd.road];
      const zOf = (it) => {
        const set = it.k === 'b' ? SET + r() * 1.6 : SET + 0.6;
        return bd.south ? zr + RW / 2 + set : zr - RW / 2 - set - it.d;
      };
      let cx = VW / 2 + 2.6;
      bd.E.forEach((it) => {
        placed.push({ ...it, x: cx, z: zOf(it), south: bd.south, road: bd.road, side: 'E' });
        cx += it.w + GAP + r() * 1.2;
      });
      cx = -VW / 2 - 2.6;
      bd.W.forEach((it) => {
        placed.push({ ...it, x: cx - it.w, z: zOf(it), south: bd.south, road: bd.road, side: 'W' });
        cx -= it.w + GAP + r() * 1.2;
      });
    });

    // хүрээ → төвд шилжүүлэх
    const M = 6;
    const minX = Math.min(...placed.map((p) => p.x)) - M,
      maxX = Math.max(...placed.map((p) => p.x + p.w)) + M;
    const minZ = Math.min(roadZ[0] - 8, ...placed.map((p) => p.z)) - M,
      maxZ = Math.max(roadZ[nRoads - 1] + 8, ...placed.map((p) => p.z + p.d)) + M;
    const ox = (minX + maxX) / 2,
      oz = (minZ + maxZ) / 2;
    const W = Math.ceil(maxX - minX),
      Dp = Math.ceil(maxZ - minZ);
    placed.forEach((p) => {
      p.x = r1(p.x - ox);
      p.z = r1(p.z - oz);
    });
    const vx = r1(-ox);
    const rz = roadZ.map((z) => r1(z - oz));

    const L = {
      id: sp.id || 'cx-' + Date.now().toString(36),
      n: sp.n,
      sokh: sp.sokh || sp.n.replace(/\s*хотхон$/, '') + ' СӨХ',
      d: sp.d,
      c: sp.c || '#0A72B8',
      size: [W, Dp],
      roads: rz
        .map((z) => ({ x1: -W / 2, z1: z, x2: W / 2, z2: z, w: RW }))
        .concat([{ x1: vx, z1: -Dp / 2, x2: vx, z2: Dp / 2, w: VW }]),
      pads: [],
      buildings: [],
      parks: [],
      lots: [],
      garage: sp.garage || 0,
      lights: [],
      trees: [],
    };

    // бетон талбайнууд: эгнээ, тал бүрт
    bands.forEach((bd, bi) => {
      ['W', 'E'].forEach((side) => {
        const ps = placed.filter(
          (p) => p.road === bd.road && p.south === bd.south && p.side === side,
        );
        if (!ps.length) return;
        const zr = rz[bd.road];
        const x0 = side === 'E' ? vx + VW / 2 + 0.6 : Math.min(...ps.map((p) => p.x)) - 1.8;
        const x1 = side === 'E' ? Math.max(...ps.map((p) => p.x + p.w)) + 1.8 : vx - VW / 2 - 0.6;
        const z0 = bd.south ? zr + RW / 2 + 0.6 : Math.min(...ps.map((p) => p.z)) - 1.8;
        const z1 = bd.south ? Math.max(...ps.map((p) => p.z + p.d)) + 1.8 : zr - RW / 2 - 0.6;
        L.pads.push({ x: r1(x0), z: r1(z0), w: r1(x1 - x0), d: r1(z1 - z0) });
      });
    });

    // байр: хойд эгнээ баруунаас зүүн, дараа нь урд эгнээ
    placed
      .filter((p) => p.k === 'b')
      .sort((a, b) => a.road - b.road || a.south - b.south || a.x - b.x)
      .forEach((p, i) =>
        L.buildings.push({
          n: i + 1,
          x: p.x,
          z: p.z,
          w: p.w,
          d: p.d,
          fl: p.fl,
          door: p.south ? 'n' : 's',
          per: p.per,
          units: p.per * p.fl,
        }),
      );
    placed
      .filter((p) => p.k === 'play' || p.k === 'sport')
      .forEach((p) => L.parks.push({ kind: p.k, x: p.x, z: p.z, w: p.w, d: p.d }));
    const pl = placed.find((p) => p.k === 'lot');
    if (pl)
      L.lots.push({
        id: 'p',
        x: pl.x,
        z: pl.z,
        cols: pl.cols,
        aisles: pl.aisles,
        n: pl.n,
        entry: 'w',
        lane: r1(vx + 1.5),
        gate: r1(Dp / 2 - 1),
      });

    decorate(L, r);
    L.spec = Object.assign({}, sp, { id: undefined, got: undefined });
    return L;
  }

  /* ---------- гэрэл, мод автоматаар ---------- */
  const rectsOf = (L) =>
    L.buildings.concat(L.parks).concat(L.lots.map((l) => ({ ...l, ...lotSize(l) })));
  const inRect = (x, z, q, m) =>
    x > q.x - m && x < q.x + q.w + m && z > q.z - m && z < q.z + q.d + m;
  const isH = (rd) => rd.z1 === rd.z2;
  function nearName(L, x, z) {
    let best = null,
      bd = 1e9;
    L.buildings.forEach((b) => {
      const d = Math.hypot(b.x + b.w / 2 - x, b.z + b.d / 2 - z);
      if (d < bd) [bd, best] = [d, b.n + '-р байр'];
    });
    L.parks.forEach((p) => {
      const d = Math.hypot(p.x + p.w / 2 - x, p.z + p.d / 2 - z);
      if (d < bd) [bd, best] = [d, p.kind === 'play' ? 'тоглоомын талбай' : 'спорт талбай'];
    });
    return best || 'төв';
  }
  function decorate(L, r) {
    const [W, Dp] = L.size;
    const R = rectsOf(L);
    const free = (x, z, m) => !R.some((q) => inRect(x, z, q, m));
    const hs = L.roads.filter(isH),
      vs = L.roads.filter((x) => !isH(x));
    const lights = [];
    hs.forEach((rd) => {
      let k = 0;
      for (let x = -W / 2 + 5; x < W / 2 - 4; x += 9.5) {
        const z = rd.z1 + (k++ % 2 ? 3.3 : -3.3);
        if (vs.some((v) => Math.abs(x - v.x1) < 4)) continue;
        if (free(x, z, 0.8)) lights.push({ x, z, loc: 'Гол зам · ' + nearName(L, x, z) });
      }
    });
    vs.forEach((rd) => {
      let k = 0;
      for (let z = -Dp / 2 + 5; z < Dp / 2 - 4; z += 8.5) {
        const x = rd.x1 + (k++ % 2 ? 3.2 : -3.2);
        if (hs.some((h) => Math.abs(z - h.z1) < 4.5)) continue;
        if (free(x, z, 0.8))
          lights.push({ x, z, loc: 'Төв зам · ' + (hs[0] && z < hs[0].z1 ? 'хойд' : 'урд') });
      }
      lights.push({ x: rd.x1 + 3.2, z: Dp / 2 - 2.5, loc: 'Орцны хаалга' });
    });
    L.parks.forEach((p) => {
      const nm = p.kind === 'play' ? 'Тоглоомын талбай' : 'Спорт талбай';
      lights.push({ x: p.x + p.w * 0.18, z: p.z + p.d * 0.78, loc: nm + ' · баруун' });
      lights.push({ x: p.x + p.w * 0.66, z: p.z + p.d * 0.78, loc: nm + ' · зүүн' });
    });
    L.lots.forEach((l) => {
      const { w, d } = lotSize(l);
      const z = l.aisles > 1 ? l.z + 1.5 + ROW + 1.35 : l.z + d + 0.8;
      ['баруун', 'төв', 'зүүн'].forEach((nm, k) =>
        lights.push({ x: l.x + w * (0.14 + k * 0.36), z, loc: 'Зогсоол · ' + nm }),
      );
    });
    L.lights = lights.slice(0, 48).map((l) => ({ ...l, x: r1(l.x), z: r1(l.z) }));
    // мод
    const trees = [];
    const want = Math.round((W * Dp) / 70);
    for (let a = 0; a < want * 12 && trees.length < want; a++) {
      const x = (r() - 0.5) * (W - 4),
        z = (r() - 0.5) * (Dp - 4);
      if (hs.some((h) => Math.abs(z - h.z1) < 3.6)) continue;
      if (vs.some((v) => Math.abs(x - v.x1) < 3.8)) continue;
      if (!free(x, z, 1.8)) continue;
      if (L.lights.some((l) => Math.hypot(l.x - x, l.z - z) < 1.6)) continue;
      if (trees.some((t) => Math.hypot(t[0] - x, t[1] - z) < 3.2)) continue;
      trees.push([r1(x), r1(z), r() < 0.4 ? 1 : 0]);
    }
    L.trees = trees;
  }

  /* ======================================================================
     Гаднаас оруулсан / хадгалсан layout-ыг шалгах
     ====================================================================== */
  function normalize(j) {
    if (!j || typeof j !== 'object') throw new Error('JSON биш байна');
    if (!Array.isArray(j.buildings) || !j.buildings.length) throw new Error('buildings хоосон');
    const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const L = {
      id: String(j.id || 'cx-' + Date.now().toString(36)).replace(/[^\w-]/g, ''),
      n: String(j.n || j.name || 'Шинэ хотхон'),
      sokh: String(j.sokh || ''),
      d: String(j.d || j.district || ''),
      c: /^#[0-9a-f]{6}$/i.test(j.c) ? j.c : '#0A72B8',
      size: Array.isArray(j.size) ? [n(j.size[0], 84), n(j.size[1], 64)] : [84, 64],
      roads: (j.roads || []).map((x) => ({
        x1: n(x.x1, 0),
        z1: n(x.z1, 0),
        x2: n(x.x2, 0),
        z2: n(x.z2, 0),
        w: n(x.w, 4.8),
      })),
      pads: (j.pads || []).map((x) => ({ x: n(x.x, 0), z: n(x.z, 0), w: n(x.w, 1), d: n(x.d, 1) })),
      buildings: j.buildings.map((b, i) => {
        const fl = clamp(Math.round(n(b.fl, 9)), 1, 40),
          per = clamp(Math.round(n(b.per, 8)), 1, 30);
        return {
          n: i + 1,
          x: n(b.x, 0),
          z: n(b.z, 0),
          w: n(b.w, 10),
          d: n(b.d, 7),
          fl,
          per,
          units: clamp(Math.round(n(b.units, fl * per)), 1, 2000),
          door: 'nsew'.includes(b.door) && b.door ? b.door : 's',
          shape: ['L', 'U'].includes(b.shape) ? b.shape : 'rect',
          rot: clamp(Math.round(n(b.rot, 0)), 0, 3),
          entr: clamp(Math.round(n(b.entr, 1)), 1, 4),
        };
      }),
      parks: (j.parks || []).map((p) => ({
        kind: p.kind === 'sport' ? 'sport' : 'play',
        x: n(p.x, 0),
        z: n(p.z, 0),
        w: n(p.w, 16),
        d: n(p.d, 14),
      })),
      lots: (j.lots || []).map((l, i) => ({
        id: l.id || (i ? 'p' + i : 'p'),
        x: n(l.x, 0),
        z: n(l.z, 0),
        cols: clamp(Math.round(n(l.cols, 10)), 1, 40),
        aisles: clamp(Math.round(n(l.aisles, 1)), 1, 4),
        n: 0,
        entry: l.entry === 'e' ? 'e' : 'w',
        lane: n(l.lane, 0),
        gate: n(l.gate, 30),
      })),
      garage: clamp(Math.round(n(j.garage, 0)), 0, 120),
      lights: (j.lights || []).map((l) => ({
        x: n(l.x, 0),
        z: n(l.z, 0),
        loc: String(l.loc || ''),
      })),
      trees: (j.trees || []).map((t) => [n(t[0], 0), n(t[1], 0), t[2] ? 1 : 0]),
      spec: j.spec || { text: 'Гаднаас оруулсан JSON' },
      bg:
        j.bg && /^data:image\//.test(j.bg.src)
          ? {
              src: j.bg.src,
              x: n(j.bg.x, 0),
              z: n(j.bg.z, 0),
              w: n(j.bg.w, 84),
              d: n(j.bg.d, 64),
              op: n(j.bg.op, 0.6),
            }
          : undefined,
    };
    if (!L.sokh) L.sokh = L.n.replace(/\s*хотхон$/, '') + ' СӨХ';
    (j.lots || []).forEach((l, i) => {
      const cap = L.lots[i].cols * L.lots[i].aisles * 2;
      L.lots[i].n = clamp(Math.round(n(l.n, cap)), 1, cap);
    });
    if (!L.roads.length)
      L.roads.push({ x1: -L.size[0] / 2, z1: 0, x2: L.size[0] / 2, z2: 0, w: 4.8 });
    if (!L.lights.length && !L.trees.length) decorate(L, rng(hash(L.id)));
    return L;
  }

  /* ======================================================================
     Явган хүний зам: замын шугамын граф дээр Dijkstra
     ====================================================================== */
  function project(L, p, dir) {
    let best = null;
    L.roads.forEach((rd, ri) => {
      const h = isH(rd);
      const q = h
        ? { x: clamp(p.x, Math.min(rd.x1, rd.x2), Math.max(rd.x1, rd.x2)), z: rd.z1 }
        : { x: rd.x1, z: clamp(p.z, Math.min(rd.z1, rd.z2), Math.max(rd.z1, rd.z2)) };
      let d = Math.hypot(q.x - p.x, q.z - p.z);
      // хаалга харсан чиглэлийн зам (≈60° конус) давуу
      if (dir && (q.x - p.x) * dir[0] + (q.z - p.z) * dir[1] < d * 0.5) d += 1000;
      if (!best || d < best.d) best = { ri, x: q.x, z: q.z, d };
    });
    return best;
  }
  function route(L, A, B, dirA, dirB) {
    if (!L.roads.length) return [[B.x, B.z]];
    const pa = project(L, A, dirA),
      pb = project(L, B, dirB);
    const pts = L.roads.map((rd) => [
      [rd.x1, rd.z1],
      [rd.x2, rd.z2],
    ]);
    L.roads.forEach((a, i) =>
      L.roads.forEach((b, j) => {
        if (j <= i || isH(a) === isH(b)) return;
        const h = isH(a) ? a : b,
          v = isH(a) ? b : a;
        const x = v.x1,
          z = h.z1;
        if (
          x >= Math.min(h.x1, h.x2) &&
          x <= Math.max(h.x1, h.x2) &&
          z >= Math.min(v.z1, v.z2) &&
          z <= Math.max(v.z1, v.z2)
        ) {
          pts[i].push([x, z]);
          pts[j].push([x, z]);
        }
      }),
    );
    pts[pa.ri].push([pa.x, pa.z]);
    pts[pb.ri].push([pb.x, pb.z]);
    const key = (p) => p[0].toFixed(2) + ',' + p[1].toFixed(2);
    const adj = new Map(),
      pos = new Map();
    pts.forEach((list, ri) => {
      const h = isH(L.roads[ri]);
      list.sort((a, b) => (h ? a[0] - b[0] : a[1] - b[1]));
      list.forEach((p, k) => {
        pos.set(key(p), p);
        if (!adj.has(key(p))) adj.set(key(p), []);
        if (k) {
          const q = list[k - 1],
            w = Math.hypot(p[0] - q[0], p[1] - q[1]);
          adj.get(key(p)).push([key(q), w]);
          adj.get(key(q)).push([key(p), w]);
        }
      });
    });
    const s = key([pa.x, pa.z]),
      g = key([pb.x, pb.z]);
    const dist = new Map([[s, 0]]),
      prev = new Map(),
      done = new Set();
    while (true) {
      let u = null;
      dist.forEach((d, k) => {
        if (!done.has(k) && (u == null || d < dist.get(u))) u = k;
      });
      if (u == null || u === g) break;
      done.add(u);
      (adj.get(u) || []).forEach(([v, w]) => {
        const nd = dist.get(u) + w;
        if (!dist.has(v) || nd < dist.get(v)) {
          dist.set(v, nd);
          prev.set(v, u);
        }
      });
    }
    const mid = [];
    for (let k = g; k; k = prev.get(k)) {
      mid.unshift(pos.get(k));
      if (k === s) break;
    }
    const out = [[A.x, A.z], ...mid, [B.x, B.z]];
    return out.filter(
      (p, i) => !i || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 0.05,
    );
  }
  /** Байрны хаалганы өмнөх цэг ба зам руу харах чиглэл */
  function doorOf(b) {
    const cx = b.x + b.w / 2,
      cz = b.z + b.d / 2;
    const o = {
      n: [cx, b.z - 0.9, [0, -1]],
      s: [cx, b.z + b.d + 0.9, [0, 1]],
      w: [b.x - 0.9, cz, [-1, 0]],
      e: [b.x + b.w + 0.9, cz, [1, 0]],
    }[b.door || 's'];
    return { x: o[0], z: o[1], dir: o[2], cx, cz };
  }

  /* ======================================================================
     Хэсэгчилсэн засвар: зөвхөн өөрчилсөн зүйл өөрчлөгдөж, бусад бүх зүйл
     (байр, зам, талбай, мод) байрандаа үлдэнэ. Map-ыг бүхэлд нь шинээр
     үүсгэх нь зөвхөн generate()-ээр (хэрэглэгч өөрөө дарахад) болно.
     Функц бүр { ok, msg } буцаана.
     ====================================================================== */
  const lotRect = (l) => ({ x: l.x, z: l.z, ...lotSize(l) });
  const hit = (a, b, m = 0) =>
    a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.z < b.z + b.d + m && b.z < a.z + a.d + m;
  const roadRect = (rd) =>
    isH(rd)
      ? { x: Math.min(rd.x1, rd.x2), z: rd.z1 - rd.w / 2, w: Math.abs(rd.x2 - rd.x1), d: rd.w }
      : { x: rd.x1 - rd.w / 2, z: Math.min(rd.z1, rd.z2), w: rd.w, d: Math.abs(rd.z2 - rd.z1) };
  /** r-ийн байрлах газар чөлөөтэй эсэх (skip — өөрчилж буй объект өөрөө) */
  function isFree(L, r, skip) {
    const others = L.buildings
      .filter((b) => b !== skip)
      .concat(L.parks.filter((p) => p !== skip))
      .concat(L.lots.filter((l) => l !== skip).map(lotRect));
    if (others.some((q) => hit(r, q, 1.5))) return false;
    return !L.roads.some((rd) => hit(r, roadRect(rd), 0.8));
  }
  const nearestH = (L, z) =>
    L.roads
      .filter(isH)
      .reduce((m, rd) => (!m || Math.abs(rd.z1 - z) < Math.abs(m.z1 - z) ? rd : m), null);
  /** Шинэ тэгш өнцөгтийг одоо байгаа зүйлсийн хажууд, төвд хамгийн ойр чөлөөтэй газар байрлуулна */
  /** r-ийг багтаахад map-ын талбай хэр болох (бага нь сайн — map аль болох томрохгүй) */
  const grownArea = (L, r) =>
    Math.max(L.size[0], 2 * Math.max(Math.abs(r.x), Math.abs(r.x + r.w)) + 10) *
    Math.max(L.size[1], 2 * Math.max(Math.abs(r.z), Math.abs(r.z + r.d)) + 10);
  function placeRect(L, w, d, roadOnly) {
    const cands = [];
    const anchors = L.buildings.concat(L.parks).concat(L.lots.map(lotRect));
    anchors.forEach((R) => {
      const rd = nearestH(L, R.z + R.d / 2);
      const north = rd ? R.z + R.d / 2 < rd.z1 : false;
      const z = north ? R.z + R.d - d : R.z; // замын талын ирмэгээр тэгшилнэ
      if (!roadOnly) cands.push({ x: R.x + R.w + GAP, z, north }, { x: R.x - GAP - w, z, north });
    });
    L.roads.filter(isH).forEach((rd) =>
      L.roads
        .filter((v) => !isH(v))
        .forEach((v) =>
          [true, false].forEach((north) =>
            [v.x1 + v.w / 2 + 2.6, v.x1 - v.w / 2 - 2.6 - w].forEach((x) => {
              // төв замын хажуугаар гол замаас холдон эхний чөлөөтэй газрыг хайна
              for (let k = 0; k < 120; k++) {
                const z = north
                  ? rd.z1 - rd.w / 2 - 3.6 - d - k * 0.5
                  : rd.z1 + rd.w / 2 + 3.6 + k * 0.5;
                if (isFree(L, { x, z, w, d })) {
                  cands.push({ x, z, north, road: v });
                  break;
                }
              }
            }),
          ),
        ),
    );
    const ok = cands
      .map((c) => ({ ...c, w, d, x: r1(c.x), z: r1(c.z) }))
      .filter((c) => isFree(L, c))
      .sort(
        (a, b) =>
          grownArea(L, a) - grownArea(L, b) ||
          Math.hypot(a.x + w / 2, a.z + d / 2) - Math.hypot(b.x + w / 2, b.z + d / 2),
      );
    if (ok.length) return ok[0];
    // багтахгүй бол хамгийн зүүн талын объектын цаана (map томорно)
    const right = Math.max(...anchors.map((R) => R.x + R.w), 0);
    const rd = L.roads.find(isH);
    return { x: r1(right + GAP), z: rd ? r1(rd.z1 + rd.w / 2 + 3.6) : 0, w, d, north: false };
  }
  /** Бетон талбай: объектыг хамарч, зам хүртэл сунана (зам дээр гарахгүй) */
  function padFor(L, r) {
    const p = { x0: r.x - 1.8, x1: r.x + r.w + 1.8, z0: r.z - 1.8, z1: r.z + r.d + 1.8 };
    const rd = nearestH(L, r.z + r.d / 2);
    if (rd) {
      if (r.z + r.d / 2 < rd.z1) p.z1 = rd.z1 - rd.w / 2 - 0.6;
      else p.z0 = rd.z1 + rd.w / 2 + 0.6;
    }
    L.roads
      .filter((v) => !isH(v))
      .forEach((v) => {
        const q = { x: p.x0, z: p.z0, w: p.x1 - p.x0, d: p.z1 - p.z0 };
        if (!hit(q, roadRect(v))) return;
        if (r.x + r.w / 2 > v.x1) p.x0 = Math.max(p.x0, v.x1 + v.w / 2 + 0.6);
        else p.x1 = Math.min(p.x1, v.x1 - v.w / 2 - 0.6);
      });
    return { x: r1(p.x0), z: r1(p.z0), w: r1(p.x1 - p.x0), d: r1(p.z1 - p.z0) };
  }
  /** Шинэ объектын доорх мод, гэрлийг цэвэрлэж, талбай нэмнэ */
  function clearUnder(L, r) {
    L.trees = L.trees.filter((t) => !inRect(t[0], t[1], r, 1.6));
    L.lights = L.lights.filter((l) => !inRect(l.x, l.z, r, 0.6));
    const pd = padFor(L, r);
    const pads = L.pads.filter((p) => hit(p, r, 0.5));
    if (!pads.length) return L.pads.push(pd);
    // одоо байгаа талбайг томруулна
    const p = pads[0];
    const x0 = Math.min(p.x, pd.x),
      z0 = Math.min(p.z, pd.z);
    Object.assign(p, {
      x: x0,
      z: z0,
      w: r1(Math.max(p.x + p.w, pd.x + pd.w) - x0),
      d: r1(Math.max(p.z + p.d, pd.z + pd.d) - z0),
    });
  }
  /** Хоосон болсон бетон талбайг хасна */
  function dropEmptyPads(L) {
    const R = L.buildings.concat(L.parks).concat(L.lots.map(lotRect));
    L.pads = L.pads.filter((p) => R.some((r) => hit(p, r)));
  }
  /** Map-аас хальсан бол хүрээг томруулж, зам, хаалгыг сунгана (бусад зүйл хөдлөхгүй) */
  function fitBounds(L) {
    const [W, Dp] = L.size;
    let hw = W / 2,
      hd = Dp / 2;
    L.buildings
      .concat(L.parks)
      .concat(L.lots.map(lotRect))
      .concat(L.pads)
      .forEach((r) => {
        hw = Math.max(hw, Math.abs(r.x) + 5, Math.abs(r.x + r.w) + 5);
        hd = Math.max(hd, Math.abs(r.z) + 5, Math.abs(r.z + r.d) + 5);
      });
    const nW = Math.ceil(hw * 2),
      nD = Math.ceil(hd * 2);
    if (nW === W && nD === Dp) return;
    const ext = (v, old, nw) =>
      Math.abs(Math.abs(v) - old / 2) < 0.6 ? (Math.sign(v) * nw) / 2 : v;
    L.roads.forEach((rd) => {
      if (isH(rd)) {
        rd.x1 = ext(rd.x1, W, nW);
        rd.x2 = ext(rd.x2, W, nW);
      } else {
        rd.z1 = ext(rd.z1, Dp, nD);
        rd.z2 = ext(rd.z2, Dp, nD);
      }
    });
    L.lots.forEach((l) => {
      if (Math.abs(l.gate - (Dp / 2 - 1)) < 0.6) l.gate = nD / 2 - 1;
    });
    L.lights.forEach((l) => {
      if (l.loc === 'Орцны хаалга' && Math.abs(l.z - (Dp / 2 - 2.5)) < 0.6) l.z = nD / 2 - 2.5;
    });
    L.size = [nW, nD];
  }
  function lotLights(L, l, old) {
    const zone = old || lotRect(l);
    L.lights = L.lights.filter(
      (x) => !(x.loc.startsWith('Зогсоол') && inRect(x.x, x.z, zone, 2.5)),
    );
    const { w, d } = lotSize(l);
    const z = l.aisles > 1 ? l.z + 1.5 + ROW + 1.35 : l.z + d + 0.8;
    ['баруун', 'төв', 'зүүн'].forEach((nm, k) =>
      L.lights.push({ x: r1(l.x + w * (0.14 + k * 0.36)), z: r1(z), loc: 'Зогсоол · ' + nm }),
    );
  }
  const spec = (L) => (L.spec = Object.assign({}, DEF, L.spec || {}, { manual: false }));

  /** Зогсоолын тоо: зөвхөн зогсоолын талбай томорч / жижгэрнэ (замын талын ирмэг нь хөдлөхгүй) */
  function setSlots(L, n) {
    n = clamp(Math.round(n), 0, 160);
    spec(L).slots = n;
    const l = L.lots[0];
    if (!n) {
      if (l) {
        L.lights = L.lights.filter(
          (x) => !(x.loc.startsWith('Зогсоол') && inRect(x.x, x.z, lotRect(l), 2.5)),
        );
        L.lots = L.lots.filter((x) => x !== l);
        dropEmptyPads(L);
      }
      return { ok: true, msg: 'Гадна зогсоолыг хаслаа' };
    }
    const ideal = n <= 24 ? 1 : n <= 84 ? 2 : 3;
    const order = [ideal, 1, 2, 3, 4].filter((a, i, A) => A.indexOf(a) === i);
    if (!l) {
      // шинэ зогсоол: төв замын хажууд чөлөөтэй газар
      let best = null;
      for (const a of order) {
        const cols = Math.ceil(n / (2 * a)),
          sz = lotSize({ cols, aisles: a });
        const c = placeRect(L, sz.w, sz.d, true); // машин орохын тулд төв замын хажууд
        const sc = grownArea(L, { ...c, ...sz });
        if (!best || sc < best.sc) best = { a, cols, sz, c, sc };
      }
      {
        const { a, cols, sz, c } = best;
        const v = c.road || L.roads.find((x) => !isH(x));
        const entry = v && c.x + sz.w / 2 < v.x1 ? 'e' : 'w';
        const nl = {
          id: 'p',
          x: c.x,
          z: c.z,
          cols,
          aisles: a,
          n,
          entry,
          lane: v ? r1(v.x1 + (entry === 'w' ? 1.5 : -1.5)) : r1(c.x - 2.6),
          gate: r1(L.size[1] / 2 - 1),
        };
        L.lots.push(nl);
        clearUnder(L, lotRect(nl));
        lotLights(L, nl);
        fitBounds(L);
        return { ok: true, msg: n + ' зогсоолтой талбай нэмлээ' };
      }
    }
    const old = lotRect(l);
    const rd = nearestH(L, old.z + old.d / 2);
    const north = rd ? old.z + old.d / 2 < rd.z1 : false;
    // эгнээний тоо бүрээр оролдож, чөлөөтэй бөгөөд map хамгийн бага томрохыг сонгоно
    let pick = null;
    for (const a of order) {
      const cols = Math.ceil(n / (2 * a)),
        sz = lotSize({ cols, aisles: a });
      const r = {
        x: l.entry === 'e' ? old.x + old.w - sz.w : old.x, // орох талын ирмэг хөдлөхгүй
        z: north ? old.z + old.d - sz.d : old.z, // замын талын ирмэг хөдлөхгүй
        ...sz,
      };
      const sc = grownArea(L, r) + (cols > 30 ? 1e6 : 0);
      if (isFree(L, r, l) && (!pick || sc < pick.sc)) pick = { a, cols, r, sc };
    }
    const ok = !!pick;
    if (!pick) {
      const cols = Math.ceil(n / (2 * ideal)),
        sz = lotSize({ cols, aisles: ideal });
      pick = {
        a: ideal,
        cols,
        r: {
          x: l.entry === 'e' ? old.x + old.w - sz.w : old.x,
          z: north ? old.z + old.d - sz.d : old.z,
          ...sz,
        },
      };
    }
    Object.assign(l, { x: r1(pick.r.x), z: r1(pick.r.z), cols: pick.cols, aisles: pick.a, n });
    clearUnder(L, pick.r);
    lotLights(L, l, old);
    dropEmptyPads(L);
    fitBounds(L);
    return ok
      ? { ok, msg: n + ' зогсоол · ' + pick.a + ' эгнээ × ' + pick.cols + ' багана' }
      : { ok, msg: 'Зай хүрэлцэхгүй тул хажуугийн объекттой давхцаж байна — тоог багасгана уу' };
  }

  /** Байрны тоо: шинэ байр чөлөөтэй газарт нэмэгдэж, хасахад сүүлийнх нь хасагдана */
  function setBuildings(L, k) {
    k = clamp(Math.round(k), 1, 24);
    const sp = spec(L);
    sp.buildings = k;
    const had = L.buildings.length;
    if (k < had) {
      L.buildings = L.buildings.slice(0, k);
      dropEmptyPads(L);
      return { ok: true, msg: had - k + ' байр хаслаа' };
    }
    for (let i = had; i < k; i++) {
      const t = L.buildings[i % Math.max(1, had)] || { w: 10.5, d: 7.4, per: 8 };
      const fl = Math.round(sp.floors[0] + Math.random() * (sp.floors[1] - sp.floors[0]));
      const per = sp.per || t.per;
      const c = placeRect(L, t.w, t.d);
      const b = {
        n: i + 1,
        x: c.x,
        z: c.z,
        w: t.w,
        d: t.d,
        fl,
        door: c.north ? 's' : 'n',
        per,
        units: fl * per,
      };
      L.buildings.push(b);
      clearUnder(L, b);
    }
    fitBounds(L);
    return { ok: true, msg: k - had + ' байр нэмлээ' };
  }

  /** Давхрын хүрээ: байр бүрийн давхрыг хүрээнд нь багтаана (байрлал хөдлөхгүй) */
  function setFloors(L, f0, f1) {
    const a = clamp(Math.min(f0, f1), 1, 40),
      b = clamp(Math.max(f0, f1), 1, 40);
    spec(L).floors = [a, b];
    L.buildings.forEach((x) => {
      x.fl = clamp(x.fl, a, b);
      x.units = x.fl * x.per;
    });
    return { ok: true, msg: 'Давхар ' + a + '–' + b };
  }
  function setPer(L, per) {
    per = clamp(Math.round(per), 0, 24);
    spec(L).per = per;
    if (per)
      L.buildings.forEach((x) => {
        x.per = per;
        x.units = x.fl * per;
      });
    return { ok: true, msg: per ? 'Давхартаа ' + per + ' айл' : 'Айлын тоо байр бүрээр' };
  }
  function setGarage(L, n) {
    L.garage = clamp(Math.round(n), 0, 120);
    spec(L).garage = L.garage;
    return { ok: true, msg: L.garage ? 'Гараж ' + L.garage : 'Гаражгүй' };
  }
  /** Тоглоом / спорт талбай нэмэх, хасах */
  function setPark(L, kind, on) {
    spec(L)[kind] = on;
    const nm = kind === 'play' ? 'Тоглоомын талбай' : 'Спорт талбай';
    if (!on) {
      const gone = L.parks.filter((p) => p.kind === kind);
      L.parks = L.parks.filter((p) => p.kind !== kind);
      L.lights = L.lights.filter(
        (l) => !(l.loc.startsWith(nm) && gone.some((p) => inRect(l.x, l.z, p, 1))),
      );
      dropEmptyPads(L);
      return { ok: true, msg: nm + ' хаслаа' };
    }
    if (L.parks.some((p) => p.kind === kind)) return { ok: true, msg: nm + ' байна' };
    const [w, d] = kind === 'play' ? [17, 14.5] : [15, 9];
    const c = placeRect(L, w, d);
    const p = { kind, x: c.x, z: c.z, w, d };
    L.parks.push(p);
    clearUnder(L, p);
    L.lights.push(
      { x: r1(p.x + w * 0.18), z: r1(p.z + d * 0.78), loc: nm + ' · баруун' },
      { x: r1(p.x + w * 0.66), z: r1(p.z + d * 0.78), loc: nm + ' · зүүн' },
    );
    fitBounds(L);
    return { ok: true, msg: nm + ' нэмлээ' };
  }

  /* ======================================================================
     Builder (drag & drop): объектыг зөөх, нэмэх, эргүүлэх, устгах.
     key: 'b:i' байр, 'p:i' тоглоом/спорт талбай, 'l:i' зогсоол
     ====================================================================== */
  const snap = (v) => Math.round(v * 2) / 2; // 0.5 нэгжийн тор
  function itemOf(L, key) {
    const [t, i] = String(key).split(':');
    const arr = { b: L.buildings, p: L.parks, l: L.lots, r: L.roads }[t];
    const it = arr && arr[Number(i)];
    if (!it) return null;
    return {
      t,
      i: Number(i),
      it,
      r:
        t === 'l' ? lotRect(it) : t === 'r' ? roadRect(it) : { x: it.x, z: it.z, w: it.w, d: it.d },
    };
  }
  /** x,z-д байрлуулж болох эсэх (бусад объект, замтай давхцахгүй) */
  function canPlace(L, key, x, z) {
    const o = itemOf(L, key);
    if (o && o.t === 'r') {
      const rd = o.it,
        pos = snap(isH(rd) ? z + rd.w / 2 : x + rd.w / 2);
      return roadFree(L, isH(rd) ? { ...rd, z1: pos, z2: pos } : { ...rd, x1: pos, x2: pos }, rd);
    }
    return !!o && isFree(L, { x: snap(x), z: snap(z), w: o.r.w, d: o.r.d }, o.it);
  }
  /** Зогсоолын орох эгнээг хамгийн ойрын төв зам руу тааруулна */
  function fixLot(L, l) {
    const { w } = lotSize(l);
    const vs = L.roads.filter((x) => !isH(x));
    if (!vs.length) return;
    const cx = l.x + w / 2;
    const v = vs.reduce((m, x) => (Math.abs(x.x1 - cx) < Math.abs(m.x1 - cx) ? x : m));
    l.entry = cx > v.x1 ? 'w' : 'e';
    l.lane = r1(v.x1 + (l.entry === 'w' ? 1.5 : -1.5));
  }
  function moveItem(L, key, x, z) {
    const o = itemOf(L, key);
    if (!o) return { ok: false, msg: 'Объект олдсонгүй' };
    if (o.t === 'r') return moveRoad(L, o.i, isH(o.it) ? z + o.it.w / 2 : x + o.it.w / 2);
    x = snap(x);
    z = snap(z);
    const nr = { x, z, w: o.r.w, d: o.r.d };
    if (!isFree(L, nr, o.it))
      return { ok: false, msg: 'Энд байрлуулах боломжгүй — өөр объект эсвэл зам давхцаж байна' };
    const dx = x - o.r.x,
      dz = z - o.r.z;
    // зогсоол, талбайн гэрэл объекттойгоо хамт зөөгдөнө
    if (o.t !== 'b')
      L.lights.forEach((l) => {
        if (inRect(l.x, l.z, o.r, o.t === 'l' ? 2.5 : 1)) {
          l.x = r1(l.x + dx);
          l.z = r1(l.z + dz);
        }
      });
    o.it.x = x;
    o.it.z = z;
    if (o.t === 'l') fixLot(L, o.it);
    if (o.t === 'b' && (o.it.door === 'n' || o.it.door === 's')) {
      // орц хамгийн ойрын гол зам руу харна
      const rd = nearestH(L, z + o.r.d / 2);
      if (rd) o.it.door = z + o.r.d / 2 < rd.z1 ? 's' : 'n';
    }
    clearUnder(L, nr);
    dropEmptyPads(L);
    fitBounds(L);
    return { ok: true };
  }
  const LOT0 = lotSize({ cols: 12, aisles: 1 });
  const NEW = { b: [10.5, 7.4], play: [17, 14.5], sport: [15, 9], lot: [LOT0.w, LOT0.d] };
  const KIND_N = {
    b: 'Байр',
    play: 'Тоглоомын талбай',
    sport: 'Спорт талбай',
    lot: 'Зогсоол',
  };
  /** Шинэ объект нэмнэ. x,z (төв) өгвөл тэнд, үгүй бол чөлөөтэй газар автоматаар */
  function addItem(L, kind, x, z) {
    const sp = spec(L);
    const [w, d] = NEW[kind];
    let r;
    if (x != null) {
      r = { x: snap(x - w / 2), z: snap(z - d / 2), w, d };
      if (!isFree(L, r)) return { ok: false, msg: 'Энд зай алга — хоосон газар руу чирнэ үү' };
    } else r = placeRect(L, w, d, kind === 'lot');
    let key;
    if (kind === 'b') {
      const fl = Math.round((sp.floors[0] + sp.floors[1]) / 2),
        per = sp.per || 8;
      const rd = nearestH(L, r.z + d / 2);
      L.buildings.push({
        n: L.buildings.length + 1,
        x: r.x,
        z: r.z,
        w,
        d,
        fl,
        per,
        units: fl * per,
        door: rd && r.z + d / 2 > rd.z1 ? 'n' : 's',
      });
      key = 'b:' + (L.buildings.length - 1);
    } else if (kind === 'lot') {
      const l = {
        id: L.lots.length ? 'p' + (L.lots.length + 1) : 'p',
        x: r.x,
        z: r.z,
        cols: 12,
        aisles: 1,
        n: 24,
        gate: r1(L.size[1] / 2 - 1),
      };
      fixLot(L, l);
      L.lots.push(l);
      lotLights(L, l);
      key = 'l:' + (L.lots.length - 1);
    } else {
      L.parks.push({ kind, x: r.x, z: r.z, w, d });
      key = 'p:' + (L.parks.length - 1);
    }
    clearUnder(L, r);
    fitBounds(L);
    syncSpec(L);
    return { ok: true, key, msg: KIND_N[kind] + ' нэмлээ' };
  }
  function removeItem(L, key) {
    const o = itemOf(L, key);
    if (!o) return { ok: false };
    if (o.t === 'r') return removeRoad(L, o.i);
    L.lights = L.lights.filter((l) => !inRect(l.x, l.z, o.r, o.t === 'l' ? 2.5 : 0.5));
    if (o.t === 'b') {
      L.buildings.splice(o.i, 1);
      L.buildings.forEach((b, k) => (b.n = k + 1)); // дугаарыг дахин дараалуулна
    } else if (o.t === 'p') L.parks.splice(o.i, 1);
    else L.lots.splice(o.i, 1);
    dropEmptyPads(L);
    syncSpec(L);
    return { ok: true, msg: 'Устгалаа' };
  }
  /** 90° эргүүлэх (өргөн ↔ гүн); байрны орц ч дагаж эргэнэ */
  function rotateItem(L, key) {
    const o = itemOf(L, key);
    if (!o || o.t === 'l' || o.t === 'r')
      return { ok: false, msg: 'Зогсоол, замыг эргүүлэх боломжгүй' };
    const cx = o.r.x + o.r.w / 2,
      cz = o.r.z + o.r.d / 2;
    const nr = { x: snap(cx - o.r.d / 2), z: snap(cz - o.r.w / 2), w: o.r.d, d: o.r.w };
    if (!isFree(L, nr, o.it)) return { ok: false, msg: 'Эргүүлэхэд зай хүрэлцэхгүй' };
    Object.assign(o.it, nr);
    if (o.t === 'b') {
      o.it.door = { n: 'e', e: 's', s: 'w', w: 'n' }[o.it.door] || 's';
      if (o.it.shape && o.it.shape !== 'rect') o.it.rot = ((o.it.rot || 0) + 1) % 4;
    }
    clearUnder(L, nr);
    fitBounds(L);
    return { ok: true };
  }
  /** Нэг зогсоолын талбайн зогсоолын тоо (+/-) */
  function setLotSlots(L, i, n) {
    const l = L.lots[i];
    if (!l) return { ok: false };
    const rest = L.lots.filter((x, k) => k !== i);
    L.lots = [l, ...rest]; // setSlots нь lots[0] дээр ажилладаг
    const r = setSlots(L, n);
    if (L.lots[0] === l) L.lots = [...rest.slice(0, i), l, ...rest.slice(i)];
    syncSpec(L);
    return r;
  }
  /** spec-ийн тоонуудыг map-тай тааруулна (нарийн тохируулгын талбарт зөв тоо харагдана) */
  function syncSpec(L) {
    const sp = spec(L);
    sp.buildings = L.buildings.length;
    sp.slots = slots(L);
    sp.play = L.parks.some((p) => p.kind === 'play');
    sp.sport = L.parks.some((p) => p.kind === 'sport');
  }

  /* ======================================================================
     Байрны хэлбэр (тэгш өнцөгт / L / U), олон орц, хэмжээ өөрчлөх
     shape: 'rect' | 'L' | 'U', rot: 0–3 (хэлбэрийн чиглэл), entr: орцны тоо 1–4
     ====================================================================== */
  /** Байрны барилгын хэсгүүд (тэгш өнцөгтүүд) — 2D, 3D хоёулаа үүнээс зурна */
  function partsOf(b) {
    const { x, z, w, d } = b;
    if (!b.shape || b.shape === 'rect') return [{ x, z, w, d }];
    const t = r1(Math.max(3, Math.min(w, d) * 0.42)); // далавчийн зузаан
    const top = { x, z, w, d: t },
      bottom = { x, z: z + d - t, w, d: t },
      left = { x, z, w: t, d },
      right = { x: x + w - t, z, w: t, d };
    const rot = (b.rot || 0) % 4;
    // L: бүтэн нэг далавч + түүнд перпендикуляр богино далавч (давхцахгүй)
    if (b.shape === 'L')
      return [
        [bottom, { x, z, w: t, d: d - t }],
        [left, { x: x + t, z, w: w - t, d: t }],
        [top, { x: x + w - t, z: z + t, w: t, d: d - t }],
        [right, { x, z: z + d - t, w: w - t, d: t }],
      ][rot];
    // U: хоёр далавч + суурь; rot нь задгай талын чиглэл (0 хойд, 1 зүүн, 2 урд, 3 баруун)
    return [
      [bottom, { x, z, w: t, d: d - t }, { x: x + w - t, z, w: t, d: d - t }],
      [left, { x: x + t, z, w: w - t, d: t }, { x: x + t, z: z + d - t, w: w - t, d: t }],
      [top, { x, z: z + t, w: t, d: d - t }, { x: x + w - t, z: z + t, w: t, d: d - t }],
      [right, { x, z, w: w - t, d: t }, { x, z: z + d - t, w: w - t, d: t }],
    ][rot];
  }
  /** Орц бүрийн цэг (хаалганы талд жигд хуваарилна) */
  function doorsOf(b) {
    const n = clamp(b.entr || 1, 1, 4);
    const D0 = doorOf(b);
    const along = D0.dir[0] === 0; // хойд/урд талд бол x-ийн дагуу
    const len = along ? b.w : b.d;
    return Array.from({ length: n }, (_, k) => {
      const o = ((k + 0.5) / n - 0.5) * len;
      return { ...D0, x: along ? D0.cx + o : D0.x, z: along ? D0.z : D0.cz + o };
    });
  }
  function setShape(L, key, shape) {
    const o = itemOf(L, key);
    if (!o || o.t !== 'b') return { ok: false };
    if (shape !== 'rect' && Math.min(o.it.w, o.it.d) < 8) {
      // L, U хэлбэрт хангалттай том талбай хэрэгтэй — эхлээд томруулна, болохгүй бол хэвээр
      const r = resizeItem(L, key, Math.max(o.it.w, 12), Math.max(o.it.d, 12));
      if (!r.ok)
        return { ok: false, msg: 'L / U хэлбэрт зай хүрэлцэхгүй — байрыг чөлөөтэй газар зөөнө үү' };
    }
    o.it.shape = shape;
    o.it.rot = o.it.rot || 0;
    return { ok: true, msg: { rect: 'Тэгш өнцөгт', L: 'L хэлбэр', U: 'U хэлбэр' }[shape] };
  }
  function setEntr(L, key, n) {
    const o = itemOf(L, key);
    if (!o || o.t !== 'b') return { ok: false };
    o.it.entr = clamp(Math.round(n), 1, 4);
    return { ok: true };
  }
  /** Хэмжээ өөрчлөх (баруун-хойд булан хөдлөхгүй) */
  function resizeItem(L, key, w, d) {
    const o = itemOf(L, key);
    if (!o || o.t === 'l' || o.t === 'r')
      return { ok: false, msg: 'Энэ объектын хэмжээг өөрчлөх боломжгүй' };
    const min = o.t === 'b' ? 4 : 6;
    w = Math.max(min, snap(w));
    d = Math.max(min, snap(d));
    const nr = { x: o.r.x, z: o.r.z, w, d };
    if (!isFree(L, nr, o.it)) return { ok: false, msg: 'Томруулахад зай хүрэлцэхгүй' };
    Object.assign(o.it, { w, d });
    clearUnder(L, nr);
    dropEmptyPads(L);
    fitBounds(L);
    return { ok: true };
  }

  /* ======================================================================
     Зам: нэмэх, зөөх (перпендикуляр чиглэлд), устгах. key 'r:i'
     ====================================================================== */
  /** Бетон талбайнуудыг объект бүрээр шинээр байгуулна (зам өөрчлөгдсөний дараа) */
  function rebuildPads(L) {
    L.pads = [];
    L.buildings
      .concat(L.parks)
      .concat(L.lots.map(lotRect))
      .forEach((r) => L.pads.push(padFor(L, r)));
  }
  /** Зам r-ийн байрлалд объект, зэрэгцээ замтай давхцахгүй эсэх */
  function roadFree(L, rd, skip) {
    const rr = roadRect(rd);
    const R = L.buildings.concat(L.parks).concat(L.lots.map(lotRect));
    if (R.some((q) => hit(rr, q, 0.8))) return false;
    return !L.roads.some(
      (o) =>
        o !== skip && isH(o) === isH(rd) && Math.abs(isH(rd) ? o.z1 - rd.z1 : o.x1 - rd.x1) < 7,
    );
  }
  function afterRoads(L) {
    L.trees = L.trees.filter((t) => !L.roads.some((rd) => inRect(t[0], t[1], roadRect(rd), 1.2)));
    L.lights = L.lights.filter((l) => !L.roads.some((rd) => inRect(l.x, l.z, roadRect(rd), 0.4)));
    L.lots.forEach((l) => fixLot(L, l));
    rebuildPads(L);
    fitBounds(L);
  }
  function roadLights(L, rd) {
    const [W, Dp] = L.size;
    const h = isH(rd);
    let k = 0;
    for (let u = (h ? -W : -Dp) / 2 + 5; u < (h ? W : Dp) / 2 - 4; u += 9.5) {
      const off = k++ % 2 ? 3.3 : -3.3;
      const p = h ? { x: u, z: rd.z1 + off } : { x: rd.x1 + off, z: u };
      if (L.roads.some((o) => o !== rd && inRect(p.x, p.z, roadRect(o), 1.5))) continue;
      const R = L.buildings.concat(L.parks).concat(L.lots.map(lotRect));
      if (R.some((q) => inRect(p.x, p.z, q, 0.8))) continue;
      L.lights.push({
        x: r1(p.x),
        z: r1(p.z),
        loc: (h ? 'Гол зам · ' : 'Төв зам · ') + nearName(L, p.x, p.z),
      });
    }
  }
  function addRoad(L, dir, pos) {
    const [W, Dp] = L.size;
    const h = dir === 'h';
    if (pos == null) {
      // хоосон шугамыг төвөөс эхлэн хайна
      const lim = (h ? Dp : W) / 2;
      for (let k = 0; k < lim * 4; k++) {
        const p = ((k % 2 ? 1 : -1) * Math.ceil(k / 2)) / 2;
        const rd = h
          ? { x1: -W / 2, z1: p, x2: W / 2, z2: p, w: RW }
          : { x1: p, z1: -Dp / 2, x2: p, z2: Dp / 2, w: VW };
        if (roadFree(L, rd)) {
          pos = p;
          break;
        }
      }
      if (pos == null) {
        // map дотор зай алга → захын объектын цаана (map томорно)
        const R = L.buildings.concat(L.parks).concat(L.lots.map(lotRect));
        pos = h
          ? Math.max(...R.map((q) => q.z + q.d)) + RW / 2 + 3.5
          : Math.max(...R.map((q) => q.x + q.w)) + VW / 2 + 3.5;
      }
    }
    pos = snap(pos);
    const rd = h
      ? { x1: -W / 2, z1: pos, x2: W / 2, z2: pos, w: RW }
      : { x1: pos, z1: -Dp / 2, x2: pos, z2: Dp / 2, w: VW };
    if (!roadFree(L, rd))
      return { ok: false, msg: 'Зам байр, талбай эсвэл өөр замтай давхцаж байна' };
    L.roads.push(rd);
    afterRoads(L);
    roadLights(L, rd);
    return {
      ok: true,
      key: 'r:' + (L.roads.length - 1),
      msg: (h ? 'Хэвтээ' : 'Босоо') + ' зам нэмлээ',
    };
  }
  /** Замыг перпендикуляр чиглэлд зөөнө (хэвтээ → z, босоо → x) */
  function moveRoad(L, i, pos) {
    const rd = L.roads[i];
    if (!rd) return { ok: false };
    pos = snap(pos);
    const h = isH(rd);
    const old = h ? rd.z1 : rd.x1;
    const nr = h ? { ...rd, z1: pos, z2: pos } : { ...rd, x1: pos, x2: pos };
    if (!roadFree(L, nr, rd))
      return { ok: false, msg: 'Зам объект эсвэл өөр замтай давхцаж байна' };
    // замын гэрэл замтайгаа хамт
    const band = roadRect(rd);
    L.lights.forEach((l) => {
      if (inRect(l.x, l.z, band, 4.2)) {
        if (h) l.z = r1(l.z + pos - old);
        else l.x = r1(l.x + pos - old);
      }
    });
    Object.assign(rd, nr);
    L.lots.forEach((l) => {
      if (!h && Math.abs(l.lane - old) < 2) l.lane = r1(l.lane + pos - old);
    });
    afterRoads(L);
    return { ok: true };
  }
  function removeRoad(L, i) {
    if (L.roads.length <= 1) return { ok: false, msg: 'Дор хаяж нэг зам үлдэх ёстой' };
    const rd = L.roads[i];
    const band = roadRect(rd);
    L.lights = L.lights.filter((l) => !inRect(l.x, l.z, band, 4.2) || !/зам/.test(l.loc));
    L.roads.splice(i, 1);
    afterRoads(L);
    return { ok: true, msg: 'Зам устгалаа' };
  }

  /* ======================================================================
     Дэвсгэр зураг (зураг төсөл, хиймэл дагуулын зураг) — 2D builder-т
     bg: { src (dataURL), x, z, w, d, op }
     ====================================================================== */
  function setBg(L, src, aspect) {
    if (!src) {
      delete L.bg;
      return { ok: true, msg: 'Дэвсгэр зургийг хаслаа' };
    }
    const [W, Dp] = L.size;
    let w = W,
      d = W / aspect;
    if (d > Dp) {
      d = Dp;
      w = Dp * aspect;
    }
    L.bg = { src, x: r1(-w / 2), z: r1(-d / 2), w: r1(w), d: r1(d), op: 0.6 };
    return { ok: true, msg: 'Дэвсгэр зураг нэмлээ' };
  }
  /** Дэвсгэрийн хэмжээ (төвөөрөө), байрлал, тунгалаг байдал */
  function bgAdjust(L, p) {
    const b = L.bg;
    if (!b) return { ok: false };
    if (p.scale) {
      const cx = b.x + b.w / 2,
        cz = b.z + b.d / 2;
      b.w = r1(b.w * p.scale);
      b.d = r1(b.d * p.scale);
      b.x = r1(cx - b.w / 2);
      b.z = r1(cz - b.d / 2);
    }
    if (p.dx) b.x = r1(b.x + p.dx);
    if (p.dz) b.z = r1(b.z + p.dz);
    if (p.op != null) b.op = clamp(p.op, 0.05, 1);
    return { ok: true };
  }

  /* ======================================================================
     Бүртгэл
     ====================================================================== */
  const cache = {};
  const readCustom = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  };
  /** Кодонд байгаа анхны map (хотхон засаагүй үеийнх) */
  function original(id) {
    if (id === 'narny') return NARNY;
    if (cache[id]) return cache[id];
    const dm = DEMO.find((d) => d.id === id);
    if (!dm) return null;
    return (cache[id] = Object.assign(generate(dm), {
      id: dm.id,
      n: dm.n,
      sokh: dm.sokh,
      c: dm.c,
      d: dm.d,
    }));
  }
  /** Хотхон өөрийн map-аа засаж хадгалсан бол тэр нь, үгүй бол анхных */
  function get(id) {
    return readCustom().find((x) => x.id === id) || original(id);
  }
  function all() {
    const ids = ['narny', ...DEMO.map((d) => d.id)];
    readCustom().forEach((x) => ids.includes(x.id) || ids.push(x.id));
    return ids.map(get);
  }
  function currentId() {
    try {
      return localStorage.getItem(CUR) || 'narny';
    } catch (e) {
      return 'narny';
    }
  }
  function current() {
    return get(currentId()) || NARNY;
  }
  function setCurrent(id) {
    try {
      localStorage.setItem(CUR, id);
    } catch (e) {}
  }
  /** Хотхон зөвхөн өөрийн id дээр map-аа хадгална (бусад хотхоны map-д хүрэхгүй) */
  // server байвал эхлээд серверт (js/api.js), амжилттай бол localStorage-д. Promise<{ ok, msg }>
  function save(L) {
    const local = () => {
      const list = readCustom().filter((x) => x.id !== L.id);
      list.push(L);
      localStorage.setItem(KEY, JSON.stringify(list));
    };
    if (!window.Api) return local(), Promise.resolve({ ok: true });
    return window.Api.saveLayout(L).then((r) => (r.ok && local(), r));
  }
  /** Засварыг устгаж анхны map руу буцаана */
  function reset(id) {
    const local = () =>
      localStorage.setItem(KEY, JSON.stringify(readCustom().filter((x) => x.id !== id)));
    if (!window.Api) return local(), Promise.resolve({ ok: true });
    return window.Api.resetLayout(id).then((r) => (r.ok && local(), r));
  }
  const isEdited = (id) => !!original(id) && readCustom().some((x) => x.id === id);
  const units = (L) => L.buildings.reduce((a, b) => a + b.units, 0);
  const slots = (L) => L.lots.reduce((a, l) => a + l.n, 0);
  /** layout өөрчлөгдвөл store-ын өгөгдлийг шинэчлэхэд хэрэглэнэ */
  const rev = (L) =>
    L.id + ':' + (hash(JSON.stringify([L.buildings, L.lots, L.lights.length, L.garage])) % 1e6);

  /* ======================================================================
     2D preview (SVG)
     ====================================================================== */
  function svg(L, o = {}) {
    const [W, Dp] = L.size;
    const e = (s) =>
      String(s).replace(
        /[&<>"]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
      );
    const R = (q, cls, rx = 0.4) =>
      '<rect class="' +
      cls +
      '" x="' +
      q.x +
      '" y="' +
      q.z +
      '" width="' +
      q.w +
      '" height="' +
      q.d +
      '" rx="' +
      rx +
      '"/>';
    const vb = o.vb || { x: -W / 2, z: -Dp / 2, w: W, d: Dp }; // томруулах / гүйлгэх
    let s =
      '<svg class="ly-svg' +
      (L.bg ? ' has-bg' : '') + // дэвсгэр зурагтай үед талбай тунгалаг
      '" viewBox="' +
      vb.x +
      ' ' +
      vb.z +
      ' ' +
      vb.w +
      ' ' +
      vb.d +
      '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      e(L.n) +
      ' map">';
    s +=
      '<rect class="ly-lawn" x="' +
      -W / 2 +
      '" y="' +
      -Dp / 2 +
      '" width="' +
      W +
      '" height="' +
      Dp +
      '"/>';
    if (L.bg)
      s +=
        '<image class="ly-bg" href="' +
        e(L.bg.src) +
        '" x="' +
        L.bg.x +
        '" y="' +
        L.bg.z +
        '" width="' +
        L.bg.w +
        '" height="' +
        L.bg.d +
        '" opacity="' +
        L.bg.op +
        '" preserveAspectRatio="none"/>';
    L.pads.forEach((p) => (s += R(p, 'ly-pad', 0.6)));
    // o.drag → builder: объект бүрийг чирж зөөх, дарж сонгох (data-drag="b:0", "p:1", "l:0", "r:0")
    const G = (key, cls = '') =>
      o.drag
        ? '<g class="ly-dr' + cls + (o.sel === key ? ' on' : '') + '" data-drag="' + key + '">'
        : '<g>';
    const on = (key) => (o.sel === key ? ' sel' : '');
    L.roads.forEach((rd, ri) => {
      s += G('r:' + ri, isH(rd) ? ' rh' : ' rv');
      const h = isH(rd);
      const q = h
        ? { x: Math.min(rd.x1, rd.x2), z: rd.z1 - rd.w / 2, w: Math.abs(rd.x2 - rd.x1), d: rd.w }
        : { x: rd.x1 - rd.w / 2, z: Math.min(rd.z1, rd.z2), w: rd.w, d: Math.abs(rd.z2 - rd.z1) };
      s += R(q, 'ly-road' + on('r:' + ri), 0);
      s += h
        ? '<line class="ly-dash" x1="' +
          rd.x1 +
          '" y1="' +
          rd.z1 +
          '" x2="' +
          rd.x2 +
          '" y2="' +
          rd.z2 +
          '"/>'
        : '<line class="ly-dash" x1="' +
          rd.x1 +
          '" y1="' +
          rd.z1 +
          '" x2="' +
          rd.x2 +
          '" y2="' +
          rd.z2 +
          '"/>';
      s += '</g>';
    });
    L.trees.forEach(
      (t) =>
        (s +=
          '<circle class="ly-tree" cx="' +
          t[0] +
          '" cy="' +
          t[1] +
          '" r="' +
          (t[2] ? 0.9 : 1.1) +
          '"/>'),
    );
    L.lights.forEach(
      (l) => (s += '<circle class="ly-light" cx="' + l.x + '" cy="' + l.z + '" r="0.45"/>'),
    );
    L.parks.forEach((p, i) => {
      s += G('p:' + i) + R(p, (p.kind === 'play' ? 'ly-play' : 'ly-sport') + on('p:' + i), 1);
      s +=
        '<text class="ly-t sm" x="' +
        (p.x + p.w / 2) +
        '" y="' +
        (p.z + p.d / 2 + 0.8) +
        '">' +
        (p.kind === 'play' ? 'Тоглоом' : 'Спорт') +
        '</text></g>';
    });
    L.lots.forEach((l, i) => {
      const { w, d } = lotSize(l);
      s += G('l:' + i) + R({ x: l.x, z: l.z, w, d }, 'ly-lot' + on('l:' + i), 0.4);
      lotSpots(l).forEach(
        (p) =>
          (s +=
            '<rect class="ly-spot" x="' +
            (p.x - 1.05) +
            '" y="' +
            (p.z - 1) +
            '" width="2.1" height="2"/>'),
      );
      s +=
        '<text class="ly-t lot" x="' +
        (l.x + w / 2) +
        '" y="' +
        (l.z + d / 2 + 0.6) +
        '">P · ' +
        l.n +
        '</text></g>';
    });
    L.buildings.forEach((b, i) => {
      const dr = doorOf(b);
      s += G('b:' + i);
      partsOf(b).forEach((q) => (s += R(q, 'ly-b' + on('b:' + i), 0.5)));
      doorsOf(b).forEach(
        (q) => (s += '<circle class="ly-door" cx="' + q.x + '" cy="' + q.z + '" r="0.55"/>'),
      );
      s += '<text class="ly-t" x="' + dr.cx + '" y="' + (dr.cz + 0.6) + '">' + b.n + '</text>';
      s +=
        '<text class="ly-t sm fl" x="' +
        dr.cx +
        '" y="' +
        (dr.cz + 2.4) +
        '">' +
        b.fl +
        'д</text></g>';
    });
    // сонгосон байр / талбайн баруун-урд буланд хэмжээ өөрчлөх бариул
    const so = o.drag && o.sel && itemOf(L, o.sel);
    if (so && (so.t === 'b' || so.t === 'p'))
      s +=
        '<rect class="ly-rz" data-resize="' +
        o.sel +
        '" x="' +
        (so.r.x + so.r.w - 0.9) +
        '" y="' +
        (so.r.z + so.r.d - 0.9) +
        '" width="1.8" height="1.8" rx="0.3"/>';
    return s + '</svg>';
  }

  window.Layout = {
    NARNY,
    DEF,
    PAD_H,
    SPOT_W,
    parse,
    generate,
    normalize,
    decorate,
    all,
    get,
    current,
    currentId,
    setCurrent,
    save,
    setSlots,
    setBuildings,
    setFloors,
    setPer,
    setGarage,
    setPark,
    itemOf,
    canPlace,
    moveItem,
    addItem,
    removeItem,
    rotateItem,
    setLotSlots,
    partsOf,
    doorsOf,
    setShape,
    setEntr,
    resizeItem,
    addRoad,
    moveRoad,
    removeRoad,
    setBg,
    bgAdjust,
    reset,
    original,
    isEdited,
    units,
    slots,
    rev,
    lotSize,
    lotSpots,
    lotEx,
    route,
    doorOf,
    svg,
    rng,
  };
})();
