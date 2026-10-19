/*
 * СӨХ Platform — 3D үзэгдлүүд (Three.js core + өөрийн Nar3D).
 *   const sc = Scenes.complex(el, { onSelectB(i), onSelectLight(id) }); sc.update({ lights, leaks, units, mode, night, selB, selLight })
 *   const pk = Scenes.parking(el, { zone:'p', onPick(slot) });          pk.update({ slots, selected })
 * update() нь зөвхөн өөрчлөгдсөн хэсгийг дахин байгуулна.
 */
(function () {
  const { mat, box, carBody } = Nar3D;
  const SC = 10; const px = (x) => (x - 380) / SC; const pz = (y) => (y - 280) / SC; const FLOOR_H = 1.15;

  function windowTexture(night, wall) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = wall; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const lit = night && (i + j * 3 + Math.floor(Math.random() * 3)) % 3 !== 0;
      g.fillStyle = night ? (lit ? '#FFD27A' : '#1E2440') : '#3E4552'; g.fillRect(8 + i * 32, 10 + j * 32, 16, 18);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.magFilter = THREE.NearestFilter; return t;
  }
  const TREES = [[20, 30, 0], [160, 30, 1], [170, 150, 0], [24, 150, 1], [180, 210, 0], [330, 30, 0], [330, 120, 1], [520, 30, 0], [522, 120, 0], [740, 30, 1], [740, 210, 0], [560, 220, 0], [690, 212, 1], [24, 310, 0], [170, 312, 1], [170, 420, 0], [40, 520, 1], [130, 520, 0], [320, 320, 0], [320, 530, 1], [190, 530, 0], [736, 300, 0], [736, 400, 1], [430, 400, 0], [600, 300, 0], [520, 300, 1]];

  /* ---------- Машин зогсоол руу орох / гарах анимаци ----------
   * arrivePath: гарцаас эгнээгээр явж, 90° эргэж зогсоолд урдаараа орно.
   * leavePath: ухарч эгнээ рүү гараад, гарц руу урагшаа явна. */
  const V3 = (x, z) => new THREE.Vector3(x, 0, z);
  const Ln = (a, b, rev) => ({ c: new THREE.LineCurve3(V3(a[0], a[1]), V3(b[0], b[1])), rev: !!rev });
  const Qd = (a, k, b, rev) => ({ c: new THREE.QuadraticBezierCurve3(V3(a[0], a[1]), V3(k[0], k[1]), V3(b[0], b[1])), rev: !!rev });
  const turnR = (z, az) => Math.min(3.2, Math.abs(z - az) * 0.6);
  function arrivePath(a, ex, pre) {
    const { x, z, az } = a, sx = Math.sign(x - ex) || 1, d = Math.sign(z - az), R = turnR(z, az);
    return [...pre, Ln([ex, az], [x - sx * R, az]), Qd([x - sx * R, az], [x, az], [x, az + d * R]), Ln([x, az + d * R], [x, z])];
  }
  function leavePath(a, xx, post) {
    const { x, z, az } = a, e = Math.sign(xx - x) || 1, d = Math.sign(z - az), R = turnR(z, az);
    return [Ln([x, z], [x, az + d * R], 1), Qd([x, az + d * R], [x, az], [x - e * R, az], 1), Ln([x - e * R, az], [xx, az]), ...post];
  }
  const parkedRot = (a) => -Math.sign(a.z - a.az) * Math.PI / 2; // хамар нь зогсоолын гүн рүү
  /** car-ыг segs замаар хөдөлгөнө; урагш/ухрах үе шат бүр зөөлөн хурдасч, зогсоно */
  function drive(car, segs, v, yAt) {
    const phases = [];
    segs.forEach((s) => { s.len = s.c.getLength(); if (s.len < 1e-3) return; const p = phases[phases.length - 1]; if (p && p.rev === s.rev) { p.segs.push(s); p.len += s.len; } else phases.push({ rev: s.rev, segs: [s], len: s.len }); });
    let pi = 0, t = 0, pause = 0; const f = new THREE.Vector3();
    const put = (ph, dist) => {
      let i = 0; while (i < ph.segs.length - 1 && dist > ph.segs[i].len) { dist -= ph.segs[i].len; i++; }
      const s = ph.segs[i], u = Math.min(1, Math.max(0, dist / s.len)), p = s.c.getPointAt(u); s.c.getTangentAt(u, f); if (ph.rev) f.negate();
      car.position.set(p.x, yAt ? yAt(p.x, p.z) : 0.02, p.z); car.rotation.y = Math.atan2(-f.z, f.x);
    };
    if (phases.length) put(phases[0], 0);
    return (dt) => {
      if (pi >= phases.length) return true; if (pause > 0) { pause -= dt; return false; }
      const ph = phases[pi]; t += dt; const u = Math.min(1, t / (ph.len / v + 0.6)), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      put(ph, e * ph.len); if (u >= 1) { pi++; t = 0; pause = 0.35; } return pi >= phases.length;
    };
  }
  /** Зогсоолын машинуудыг хянана: sync(want: Map id→өнгө, animate) */
  function parker(B, group, o) {
    const cars = new Map(), moving = new Set(); let last = 0;
    B.frames.push((t) => { const dt = Math.min(0.05, t - last); last = t; moving.forEach((m) => { if (m.step(dt)) { moving.delete(m); if (m.done) m.done(); } }); });
    const kill = (c) => { group.remove(c); c.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); };
    const stop = (c) => moving.forEach((m) => { if (m.car === c) moving.delete(m); });
    const place = (c, a) => { c.position.set(a.x, o.y ? o.y(a.x, a.z) : 0.02, a.z); c.rotation.y = parkedRot(a); };
    function sync(want, animate) {
      const swapped = new Set();
      cars.forEach((c, id) => {
        if (want.get(id) === c.userData.look) return;
        cars.delete(id); stop(c);
        if (want.has(id) || !animate) { if (want.has(id)) swapped.add(id); kill(c); return; }
        c.userData.click = null; const a = o.at(id);
        moving.add({ car: c, step: drive(c, leavePath(a, o.xx, o.post ? o.post(a) : []), o.v, o.y), done: () => kill(c) });
      });
      want.forEach((look, id) => {
        if (cars.has(id)) return;
        const c = o.make(id, look), a = o.at(id); c.userData.look = look; group.add(c); cars.set(id, c);
        if (animate && !swapped.has(id)) moving.add({ car: c, step: drive(c, arrivePath(a, o.ex, o.pre ? o.pre(a) : []), o.v, o.y) }); else place(c, a);
      });
    }
    return { sync, cars };
  }

  /** Хотхоны 3D map: байр, мод, гудамжны гэрэл, хөдөлж буй машин */
  function complex(host, opts) {
    const B = Nar3D.stage(host, [62, 72, 84], { target: [0, 2, 2], min: 45, max: 180, maxPolar: Math.PI / 2.25 });
    const { scene } = B; const bg = new THREE.Color(); scene.background = bg; scene.fog = new THREE.Fog(bg, 90, 170);
    const hemi = new THREE.HemisphereLight('#fff', '#C9BFA8', 0.9); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff', 1.6); sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50 }); scene.add(sun);
    const ground = new THREE.Group(), blds = new THREE.Group(), lightsG = new THREE.Group(), deco = new THREE.Group(); scene.add(ground, blds, lightsG, deco);

    TREES.forEach(([x, y, pine]) => {
      const g = new THREE.Group(); g.position.set(px(x), 0, pz(y));
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), mat('#7A5A3A')); tr.position.y = 0.6; tr.castShadow = true; g.add(tr);
      const top = pine ? new THREE.Mesh(new THREE.ConeGeometry(1, 2.6, 7), mat('#3E8C3B', { flatShading: true })) : new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat('#5E9F44', { flatShading: true }));
      top.position.y = pine ? 2.1 : 2; top.castShadow = true; g.add(top); deco.add(g);
    });
    // Хотхоны зогсоол: машинууд төв замаас орж ирээд зогсож, хэсэг хугацааны дараа гарч явна
    const LOT_COL = ['#D9483B', '#2F6FD6', '#1F2937', '#E6A23C', '#3BA776', '#E5E7EB'];
    const lotAt = (i) => ({ x: px(458 + (i % 8) * 34), z: pz(i < 8 ? 430 : 506), az: i < 8 ? 18 : 26.1 });
    const LANE = 1; // төв замын хойд тийш явах эгнээ (орцны гэрлийн шонг тойроно)
    const lot = parker(B, deco, {
      v: 6, ex: 3.5, xx: 3.5, at: (id) => lotAt(+id), make: (id, col) => carBody(col, 0.8),
      y: (x, z) => (x > 3.4 && z > 1.8 && z < 26.6 ? 0.35 : 0.02),
      pre: (a) => [Ln([LANE, 31], [LANE, a.az + 2.5]), Qd([LANE, a.az + 2.5], [LANE, a.az], [3.5, a.az])],
      post: (a) => [Qd([3.5, a.az], [LANE, a.az], [LANE, a.az + 2.5]), Ln([LANE, a.az + 2.5], [LANE, 31])],
    });
    const lotOcc = Array.from({ length: 16 }, (_, i) => (i % 3 !== 0 ? LOT_COL[i % 6] : null)); let lotNext = 3, lotN = 0;
    const lotWant = () => new Map(lotOcc.map((c, i) => [String(i), c]).filter((x) => x[1]));
    lot.sync(lotWant(), false);
    B.frames.push((t) => {
      if (t < lotNext) return; lotNext = t + 3.2; lotN++;
      const i = (lotN * 7 + Math.floor(t * 13)) % 16; lotOcc[i] = lotOcc[i] ? null : LOT_COL[(lotN + i) % 6]; lot.sync(lotWant(), true);
    });
    [['#E85A4F', 'e', 6, 0], ['#2F6FD6', 'w', 5, 30], ['#F5D130', 's', 5.5, 10], ['#3BA776', 'n', 4.5, 50]].forEach(([col, p, sp, off]) => {
      const c = carBody(col); deco.add(c);
      B.frames.push((t) => { const k = ((t * sp + off) % 90) - 45;
        if (p === 'e') c.position.set(k, 0, pz(252)); if (p === 'w') { c.position.set(-k, 0, pz(270)); c.rotation.y = Math.PI; }
        if (p === 's') { c.position.set(px(366), 0, k * 0.7); c.rotation.y = -Math.PI / 2; } if (p === 'n') { c.position.set(px(386), 0, -k * 0.7); c.rotation.y = Math.PI / 2; } });
    });
    let alarm = [], bulbs = []; const prev = {};
    B.frames.push((t) => {
      alarm.forEach((m) => m.scale.set(1, 1 + Math.sin(t * 7) * 0.04, 1));
      bulbs.forEach(([m, st]) => { m.emissiveIntensity = st === 'off' ? (Math.sin(t * 6) > 0 ? 2.2 : 0.1) : Math.sin(t * 9) > 0 ? 1.6 : 0.3; });
    });
    B.onClick = (c) => { if (!c) return opts.onSelectB(null); if (c[0] === 'b') opts.onSelectB(c[1]); if (c[0] === 'l') opts.onSelectLight(c[1]); };
    const refreshClickables = () => { B.clickables.length = 0; blds.children.forEach((g) => B.clickables.push(g)); lightsG.children.forEach((g) => B.clickables.push(g)); };

    function buildGround(night) {
      B.clear(ground);
      const plot = night ? '#283057' : '#E8E2D5', road = night ? '#323A5E' : '#A9A59C', lawn = night ? '#21392F' : '#C8D3A2';
      const add = (m, x, y, z, flat) => { m.position.set(x, y, z); if (flat) m.rotation.x = -Math.PI / 2; m.receiveShadow = true; ground.add(m); return m; };
      add(new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat(night ? '#1E2541' : '#D9D2C1')), 0, -0.01, 0, 1);
      [[14, 14, 322, 212], [414, 14, 332, 212], [14, 298, 322, 248], [414, 298, 332, 248]].forEach(([x, y, w, d]) => add(box(w / SC, 0.3, d / SC, mat(plot)), px(x) + w / SC / 2, 0.15, pz(y) + d / SC / 2));
      add(box(19, 0.05, 16.8, mat(lawn)), px(540) + 9.5, 0.32, pz(40) + 8.4);
      add(new THREE.Mesh(new THREE.PlaneGeometry(80, 4.8), mat(road)), 0, 0.02, pz(260), 1);
      add(new THREE.Mesh(new THREE.PlaneGeometry(5, 60), mat(road)), px(375), 0.03, 0, 1);
      for (let i = 0; i < 22; i++) add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), mat('#fff', { transparent: true, opacity: 0.8 })), -38 + i * 3.6, 0.04, pz(260), 1);
      add(box(9.2, 0.1, 6.4, mat(night ? '#5A3A3A' : '#D98A5F')), px(560) + 4.6, 0.4, pz(60) + 3.2);
      add(box(1.2, 1.8, 3, mat('#F5D130')), px(578), 1.2, pz(85)).castShadow = true;
      add(box(3.4, 0.4, 0.8, mat('#E85A4F')), px(616), 1.6, pz(84)).castShadow = true;
      add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24), mat('#5FB8D6', { emissive: '#5FB8D6', emissiveIntensity: 0.25 })), px(690), 0.45, pz(162));
      add(box(28.8, 0.05, 12.4, mat(night ? '#2C3350' : '#9C988F')), px(440) + 14.4, 0.33, pz(408) + 6.2);
    }
    function buildBuildings(s) {
      B.clear(blds); alarm = [];
      const leakB = new Set(s.leaks.filter((x) => x.st !== 'fixed').map((x) => x.b)); const night = s.night;
      D.BUILDINGS.forEach((b, i) => {
        const L = s.units[b.n - 1] || []; const paid = L.length ? L.filter((u) => u.st === 0).length / L.length : 0.9;
        let color = night ? '#4D577C' : '#EFE9DC', roof = night ? '#2E3555' : '#B4AE9F', sub = '', tone = '';
        if (s.mode === 'pay') { color = paid >= 0.85 ? '#BFE3C8' : paid >= 0.7 ? '#F4DDA4' : '#F2B8B1'; sub = Math.round(paid * 100) + '% төлсөн'; tone = paid >= 0.85 ? 'ok' : paid >= 0.7 ? 'warn' : 'bad'; }
        if (s.mode === 'leak') { if (leakB.has(b.n)) { color = '#F07C74'; roof = '#C9504A'; sub = 'Ус алдалт'; tone = 'bad'; } else { sub = 'Хэвийн'; tone = 'ok'; } }
        const sel = s.selB === i; const h = b.fl * FLOOR_H + 0.6, w = b.w / SC, d = b.d / SC; const wall = sel ? '#F4C536' : color;
        const tx = windowTexture(night, wall), tz = windowTexture(night, wall); tx.repeat.set(Math.max(1, Math.round(d / 1.1)), b.fl / 2); tz.repeat.set(Math.max(1, Math.round(w / 1.1)), b.fl / 2);
        const side = (t) => mat('#fff', { map: t, emissiveMap: night ? t : null, emissive: night ? '#fff' : '#000', emissiveIntensity: night ? 0.55 : 0, roughness: 0.9 });
        const top = mat(sel ? '#E6B224' : roof, { roughness: 0.95 });
        const g = new THREE.Group(); g.position.set(px(b.x) + w / 2, 0, pz(b.y) + d / 2); g.userData.click = ['b', i];
        const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0);
        const m = new THREE.Mesh(geo, [side(tx), side(tx), top, top, side(tz), side(tz)]); m.castShadow = m.receiveShadow = true; g.add(m);
        const r = box(Math.max(1.4, w * 0.25), 1.2, Math.max(1.4, d * 0.3), mat(sel ? '#D9A41A' : roof)); r.position.y = h + 0.6; r.castShadow = true; g.add(r);
        if (s.mode === 'leak' && leakB.has(b.n)) { alarm.push(m); const pl = new THREE.PointLight('#FF5A4E', 30, 14); pl.position.set(0, h / 2, d / 2 + 1); g.add(pl); }
        blds.add(g);
        B.label(g, '<b class="b3-name' + (night ? ' n' : '') + (sel ? ' sel' : '') + '">' + b.n + '-р байр</b>' + (sub ? '<span class="b3-sub ' + tone + '">' + sub + '</span>' : ''), 'b3-label', [0, h + 3.2, 0]);
      });
      refreshClickables();
    }
    function buildLights(s) {
      B.clear(lightsG); bulbs = [];
      s.lights.forEach((l) => {
        const g = new THREE.Group(); g.position.set(px(l.x), 0, pz(l.y)); g.userData.click = ['l', l.id];
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), mat('#5E5A52')); pole.position.y = 1.6; g.add(pole);
        const col = l.st === 'on' ? '#FFE08A' : l.st === 'off' ? '#E0525A' : '#F0B03E';
        const bm = mat(col, { emissive: col, emissiveIntensity: l.st === 'on' ? (s.night ? 3 : 0.8) : 1 });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(s.selLight === l.id ? 0.42 : 0.3, 12, 12), bm); bulb.position.y = 3.3; g.add(bulb);
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2; g.add(hit); // том дарах талбай
        if (l.st !== 'on') bulbs.push([bm, l.st]);
        if (s.night && l.st === 'on') { const pl = new THREE.PointLight('#FFD58A', 18, 9); pl.position.y = 3.1; g.add(pl); }
        lightsG.add(g);
        if (l.st === 'off') B.label(g, '!', 'b3-warn', [0, 4.4, 0]);
      });
      refreshClickables();
    }
    function update(s) {
      const night = !!s.night;
      if (prev.night !== night) {
        bg.set(night ? '#151B36' : '#ECE6D8'); hemi.color.set(night ? '#3A4A80' : '#FFFFFF'); hemi.groundColor.set(night ? '#101426' : '#C9BFA8'); hemi.intensity = night ? 0.35 : 0.9; sun.intensity = night ? 0.25 : 1.6;
        buildGround(night);
      }
      const leakKey = s.leaks.filter((x) => x.st !== 'fixed').map((x) => x.b).join(',');
      const bKey = [night, s.mode, s.selB, leakKey, s.mode === 'pay' ? s.units.map((L) => L.filter((u) => u.st === 0).length).join(',') : ''].join('|');
      const lKey = [night, s.selLight, s.lights.map((l) => l.st).join('')].join('|');
      if (bKey !== prev.bKey) { prev.bKey = bKey; buildBuildings(s); }
      if (lKey !== prev.lKey) { prev.lKey = lKey; buildLights(s); }
      prev.night = night;
    }
    return { update };
  }

  /** Зогсоол: зогсоол бүрийн мэдрэгч, машин, сул/захиалсан шошго */
  const STATE_COL = ['#2EAE68', '#6E685C', '#F0B03E', '#7C5CFC'];
  function parking(host, opts) {
    const zone = opts.zone || 'p'; const garage = zone === 'g';
    const B = Nar3D.stage(host, [40, 62, 72], { target: [0, 0, 0], min: 40, max: 190, maxPolar: Math.PI / 2.3, narrow: 2.05 }); const { scene } = B;
    scene.background = new THREE.Color(garage ? '#3A3E46' : '#ECE6D8');
    scene.add(new THREE.HemisphereLight('#fff', garage ? '#22262C' : '#C9BFA8', garage ? 0.55 : 0.9));
    const sun = new THREE.DirectionalLight('#fff', garage ? 0.6 : 1.5); sun.position.set(20, 40, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 }); scene.add(sun);
    const cols = garage ? 10 : 12, sw = garage ? 5.4 : 4.6, sd = garage ? 7.2 : 6.6; const rowsZ = garage ? [-20, -6, 4, 18] : [-21, -8, 3, 16]; const x0 = -(cols * sw) / 2;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(74, 56), mat(garage ? '#7E8288' : '#A39F96')); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
    [(rowsZ[0] + sd + rowsZ[1]) / 2, (rowsZ[2] + sd + rowsZ[3]) / 2].forEach((z) => { for (let k = 0; k < 18; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.25), mat('#fff')); m.rotation.x = -Math.PI / 2; m.position.set(-34 + k * 4, 0.02, z); scene.add(m); } });
    if (garage) {
      [[0, -27.5, 74, 1], [0, 27.5, 74, 1], [36.5, 0, 1, 56]].forEach(([x, z, w, d]) => { const m = box(w, 3.6, d, mat('#B9BDC3')); m.position.set(x, 1.8, z); m.castShadow = m.receiveShadow = true; scene.add(m); });
      const mid = box(58, 2.8, 1, mat('#A5AAB1')); mid.position.set(0, 1.4, (rowsZ[1] + sd + rowsZ[2]) / 2); scene.add(mid);
      rowsZ.forEach((z, r) => { for (let k = 0; k <= cols / 2; k++) { const p = box(0.8, 4.4, 0.8, mat('#C9CDD2')); p.position.set(x0 + k * 2 * sw, 2.2, r % 2 === 0 ? z - 0.7 : z + sd + 0.7); p.castShadow = true; scene.add(p); } });
    } else { const m = box(60, 0.5, 2.2, mat('#C8D3A2')); m.position.set(0, 0.25, (rowsZ[1] + sd + rowsZ[2]) / 2); m.receiveShadow = true; scene.add(m); }
    const bays = new THREE.Group(), carsG = new THREE.Group(); scene.add(bays, carsG); let key = ''; let cur = null; let inited = false; const spot = {};
    const aisleZ = [(rowsZ[0] + sd + rowsZ[1]) / 2, (rowsZ[2] + sd + rowsZ[3]) / 2];
    // Гадна зогсоол: зүүнээс орж баруун тийш гарна · Гараж: зүүн талын хаалгаар орж, гарна
    const pk = parker(B, carsG, { v: 8, ex: -40, xx: garage ? -40 : 40, at: (id) => spot[id],
      make: (id, col) => { const c = carBody(col, garage ? 1.15 : 1.05); c.userData.click = ['s', id]; return c; } });
    B.onClick = (c) => { if (c && c[0] === 's') { const s = cur.slots.find((x) => x.id === c[1]); if (s) opts.onPick(s); } };
    function update(s) {
      cur = s; const list = s.slots.filter((x) => x.zone === zone);
      const k = list.map((x) => x.st + (x.mine ? 'm' : '') + x.sens).join('') + '|' + s.selected; if (k === key) return; key = k;
      B.clear(bays); B.clickables.length = 0;
      const want = new Map();
      list.forEach((sl, i) => {
        const r = Math.floor(i / cols) % 4, c = i % cols, top = r % 2 === 0; const x = x0 + c * sw + sw / 2, z = rowsZ[r] + sd / 2;
        spot[sl.id] = { x, z, az: aisleZ[r < 2 ? 0 : 1] };
        const col = sl.mine ? '#2F8FE0' : STATE_COL[sl.st]; const g = new THREE.Group(); g.userData.click = ['s', sl.id];
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(sw - 0.35, sd - 0.35), mat(col, { transparent: true, opacity: s.selected === sl.id ? 0.9 : 0.55, emissive: sl.st === 0 || sl.st === 3 ? col : '#000', emissiveIntensity: 0.25 }));
        pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.03, z); g.add(pad);
        const sc = sl.sens === 'off' ? '#64748B' : sl.sens === 'low' ? '#F0B03E' : sl.st === 0 ? '#3DDC84' : '#E0525A';
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat(sc, { emissive: sc, emissiveIntensity: 1.4 })); dot.position.set(x, 0.12, top ? z + sd / 2 - 0.5 : z - sd / 2 + 0.5); g.add(dot);
        if (sl.st === 1 || sl.st === 2) want.set(sl.id, sl.mine ? '#0A72B8' : sl.color);
        bays.add(g); B.clickables.push(g);
        if ((sl.st === 0 && i % 2 === 0) || sl.st === 3 || sl.mine) {
          const t = sl.mine ? (sl.st === 1 ? 'Таны машин' : 'Таны захиалга') : sl.st === 3 ? '⏱' : 'P';
          B.label(g, t, 'p3-tag ' + (sl.mine ? 'mine' : sl.st === 3 ? 'res' : 'free'), [x, sl.st === 1 ? 3 : 1.6, z]);
        }
        B.label(g, sl.id, 'p3-id', [x, 0.05, top ? z - sd / 2 + 0.9 : z + sd / 2 - 0.9]);
      });
      pk.sync(want, inited); inited = true; pk.cars.forEach((c) => B.clickables.push(c));
    }
    return { update };
  }

  window.Scenes = { complex, parking };
})();
