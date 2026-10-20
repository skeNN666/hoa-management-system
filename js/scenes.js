/*
 * СӨХ Platform — 3D үзэгдлүүд (Three.js core + өөрийн Nar3D).
 *   const sc = Scenes.complex(el, { onSelectB(i), onSelectLight(id) });
 *   sc.update({ lights, leaks, units, slots, mode, night, selB, selLight })
 *   const pk = Scenes.parking(el, { zone:'p', onPick(slot) });  pk.update({ slots, selected })
 *
 * Хотхоны map дээрх зогсоол болон "Зогсоол" хуудасны 3D нь нэг өгөгдлөөр (S.state.slots) ажиллаж,
 * машин орох/гарах хөдөлгөөн хоёр газар ижил хугацаатай (T_MOVE) явагдана:
 *   • машин зогсоолд орж зогсмогц тухайн зогсоол улаан (эзэлсэн) болно
 *   • машин гарч явмагц зогсоол ногоон болж хэдэн секунд анивчина
 */
(function () {
  const { mat, box, carBody } = Nar3D;
  const SC = 10;
  const px = (x) => (x - 380) / SC;
  const pz = (y) => (y - 280) / SC;
  const FLOOR_H = 1.15;
  const T_MOVE = 7; // орох / гарах хөдөлгөөний нийт хугацаа (сек) — хоёр үзэгдэлд ижил

  /* ======================================================================
     Машин зогсоол руу орох / гарах зам
     arrivePath: гарцаас эгнээгээр явж, 90° эргэж зогсоолд урдаараа орно.
     leavePath:  ухарч эгнээ рүү гараад, гарц руу урагшаа явна.
     ====================================================================== */
  const V3 = (x, z) => new THREE.Vector3(x, 0, z);
  const Ln = (a, b, rev) => ({
    c: new THREE.LineCurve3(V3(a[0], a[1]), V3(b[0], b[1])),
    rev: !!rev,
  });
  const Qd = (a, k, b, rev) => ({
    c: new THREE.QuadraticBezierCurve3(V3(a[0], a[1]), V3(k[0], k[1]), V3(b[0], b[1])),
    rev: !!rev,
  });
  const turnR = (z, az) => Math.min(3.2, Math.abs(z - az) * 0.6);
  function arrivePath(a, ex, pre) {
    const { x, z, az } = a;
    const sx = Math.sign(x - ex) || 1,
      d = Math.sign(z - az),
      R = turnR(z, az);
    return [
      ...pre,
      Ln([ex, az], [x - sx * R, az]),
      Qd([x - sx * R, az], [x, az], [x, az + d * R]),
      Ln([x, az + d * R], [x, z]),
    ];
  }
  function leavePath(a, xx, post) {
    const { x, z, az } = a;
    const e = Math.sign(xx - x) || 1,
      d = Math.sign(z - az),
      R = turnR(z, az);
    return [
      Ln([x, z], [x, az + d * R], 1),
      Qd([x, az + d * R], [x, az], [x - e * R, az], 1),
      Ln([x - e * R, az], [xx, az]),
      ...post,
    ];
  }
  const parkedRot = (a) => (-Math.sign(a.z - a.az) * Math.PI) / 2; // хамар нь зогсоолын гүн рүү

  /**
   * car-ыг segs замаар хөдөлгөнө. Урагш/ухрах үе шат бүр зөөлөн хурдасч, зогсоно.
   * o: { v (хурд) эсвэл T (нийт хугацаа), y(x,z), onPhase(i, last) }
   */
  function drive(car, segs, o) {
    const phases = [];
    segs.forEach((s) => {
      s.len = s.c.getLength();
      if (s.len < 1e-3) return;
      const p = phases[phases.length - 1];
      if (p && p.rev === s.rev) {
        p.segs.push(s);
        p.len += s.len;
      } else phases.push({ rev: s.rev, segs: [s], len: s.len });
    });
    const n = phases.length;
    const total = phases.reduce((a, p) => a + p.len, 0);
    const v = o.T ? total / Math.max(1, o.T - n * 0.6 - (n - 1) * 0.35) : o.v;
    let pi = 0,
      t = 0,
      pause = 0;
    const f = new THREE.Vector3();
    const put = (ph, dist) => {
      let i = 0;
      while (i < ph.segs.length - 1 && dist > ph.segs[i].len) {
        dist -= ph.segs[i].len;
        i++;
      }
      const s = ph.segs[i];
      const u = Math.min(1, Math.max(0, dist / s.len));
      const p = s.c.getPointAt(u);
      s.c.getTangentAt(u, f);
      if (ph.rev) f.negate();
      car.position.set(p.x, o.y ? o.y(p.x, p.z) : 0.02, p.z);
      car.rotation.y = Math.atan2(-f.z, f.x);
    };
    if (n) put(phases[0], 0);
    return (dt) => {
      if (pi >= n) return true;
      if (pause > 0) {
        pause -= dt;
        return false;
      }
      const ph = phases[pi];
      t += dt;
      const u = Math.min(1, t / (ph.len / v + 0.6));
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      put(ph, e * ph.len);
      if (u >= 1) {
        if (o.onPhase) o.onPhase(pi, pi === n - 1);
        pi++;
        t = 0;
        pause = 0.35;
      }
      return pi >= n;
    };
  }

  /** Машинуудыг хянана: sync(want: Map id→өнгө, animate) → { arr, dep } */
  function parker(B, group, o) {
    const cars = new Map(),
      moving = new Set();
    let last = 0;
    B.frames.push((t) => {
      const dt = Math.min(0.05, t - last);
      last = t;
      moving.forEach((m) => {
        if (m.step(dt)) {
          moving.delete(m);
          if (m.done) m.done();
        }
      });
    });
    const kill = (c) => {
      group.remove(c);
      c.traverse((x) => {
        if (x.geometry && !x.geometry.userData.keep) x.geometry.dispose();
      });
    };
    const stop = (c) =>
      moving.forEach((m) => {
        if (m.car === c) moving.delete(m);
      });
    const place = (c, a) => {
      c.position.set(a.x, o.y ? o.y(a.x, a.z) : 0.02, a.z);
      c.rotation.y = parkedRot(a);
    };
    function sync(want, animate) {
      const arr = new Set(),
        dep = new Set(),
        swapped = new Set();
      cars.forEach((c, id) => {
        if (want.get(id) === c.userData.look) return;
        cars.delete(id);
        stop(c);
        if (want.has(id) || !animate) {
          if (want.has(id)) swapped.add(id);
          kill(c);
          return;
        }
        c.userData.click = null;
        const a = o.at(id);
        dep.add(id);
        const step = drive(c, leavePath(a, o.xx, o.post ? o.post(a) : []), {
          v: o.v,
          T: o.T,
          y: o.y,
          onPhase: (i) => {
            if (i === 0 && o.onOut) o.onOut(id); // зогсоолоос бүрэн гарлаа
          },
        });
        moving.add({ car: c, step, done: () => kill(c) });
      });
      want.forEach((look, id) => {
        if (cars.has(id)) return;
        const c = o.make(id, look),
          a = o.at(id);
        c.userData.look = look;
        group.add(c);
        cars.set(id, c);
        if (animate && !swapped.has(id)) {
          arr.add(id);
          const step = drive(c, arrivePath(a, o.ex, o.pre ? o.pre(a) : []), {
            v: o.v,
            T: o.T,
            y: o.y,
            onPhase: (i, lastPh) => {
              if (lastPh && o.onParked) o.onParked(id); // зогсоолдоо зогслоо
            },
          });
          moving.add({ car: c, step });
        } else place(c, a);
      });
      return { arr, dep };
    }
    return { sync, cars };
  }

  /* ======================================================================
     Зогсоолын хянагч: зогсоол бүрийн өнгөт талбай + машин + харагдах төлөв.
     Машин ирж байхад зогсоол хуучин өнгөөрөө, зогсмогц улаан; гармагц ногоон болж анивчина.
     ====================================================================== */
  const ST_COL = {
    free: '#2EAE68',
    occ: '#E0525A',
    guest: '#F0B03E',
    res: '#7C5CFC',
    mine: '#2F8FE0',
  };
  const targetOf = (sl) =>
    sl.mine ? 'mine' : sl.st === 3 ? 'res' : sl.st === 1 ? 'occ' : sl.st === 2 ? 'guest' : 'free';
  function lotCtl(B, root, o) {
    const padG = new THREE.Group(),
      carG = new THREE.Group();
    root.add(padG, carG);
    const pads = {},
      disp = {},
      target = {},
      blink = {},
      busy = new Set();
    let now = 0;
    const padGeo = new THREE.PlaneGeometry(o.padW, o.padD).rotateX(-Math.PI / 2);
    padGeo.userData.keep = true;
    function pad(id) {
      if (pads[id]) return pads[id];
      const a = o.spots[id];
      const m = new THREE.MeshStandardMaterial({
        color: ST_COL.free,
        transparent: true,
        opacity: o.opacity,
        emissive: ST_COL.free,
        emissiveIntensity: 0.3,
        roughness: 0.8,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(padGeo, m);
      mesh.position.set(a.x, o.padY, a.z);
      mesh.receiveShadow = true;
      if (o.click) mesh.userData.click = ['s', id];
      padG.add(mesh);
      return (pads[id] = { mesh, m });
    }
    function paint(id, stt) {
      disp[id] = stt;
      const p = pad(id);
      const c = ST_COL[stt];
      p.m.color.set(c);
      p.m.emissive.set(c);
      p.m.emissiveIntensity = stt === 'occ' || stt === 'guest' ? 0.18 : 0.32;
      p.m.opacity = o.opacity;
      if (o.onPaint) o.onPaint(id, stt);
    }
    const pk = parker(B, carG, {
      T: T_MOVE,
      ex: o.ex,
      xx: o.xx,
      pre: o.pre,
      post: o.post,
      y: o.y,
      at: (id) => o.spots[id],
      make: (id, col) => {
        const c = carBody(col, o.carScale);
        if (o.click) c.userData.click = ['s', id];
        return c;
      },
      onParked: (id) => {
        busy.delete(id);
        paint(id, target[id]);
        blink[id] = { until: now + 1.2, red: true }; // зогсмогц улаан болж нэг гялсхийнэ
      },
      onOut: (id) => {
        busy.delete(id);
        paint(id, target[id]);
        if (target[id] === 'free') blink[id] = { until: now + 4.5 };
      },
    });
    B.frames.push((t) => {
      now = t;
      for (const id in blink) {
        const p = pads[id],
          b = blink[id];
        if (t > b.until) {
          delete blink[id];
          paint(id, disp[id]);
          continue;
        }
        const on = Math.sin(t * (b.red ? 18 : 11)) > 0;
        p.m.emissiveIntensity = on ? 1.5 : 0.12;
        p.m.opacity = on ? Math.min(1, o.opacity + 0.35) : o.opacity * 0.55;
      }
    });
    function sync(list, animate) {
      const want = new Map();
      list.forEach((sl) => {
        target[sl.id] = targetOf(sl);
        if (sl.st === 1 || sl.st === 2) want.set(sl.id, sl.mine ? '#0A72B8' : sl.color);
      });
      const r = pk.sync(want, animate);
      r.arr.forEach((id) => busy.add(id));
      r.dep.forEach((id) => busy.add(id));
      list.forEach((sl) => {
        if (!busy.has(sl.id) && disp[sl.id] !== target[sl.id]) paint(sl.id, target[sl.id]);
      });
    }
    return { sync, pads, disp, cars: pk.cars };
  }

  /* ======================================================================
     Хотхоны 3D map
     ====================================================================== */
  const TREES = [
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
  ];
  const WALLS = ['#EEE9E0', '#E3E8EE', '#F0E6DA', '#E6EBE3', '#EDE3E5', '#E2E7F0'];
  const shade = (hex, k) => {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, 0, k);
    return '#' + c.getHexString();
  };

  /** Орчин үеийн фасад: цонхны хүрээ, шилэнд тэнгэр тусна, шөнө зарим цонх асна */
  function facadeTexture(night, wall) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = wall;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const x0 = i * 64,
          y0 = j * 64;
        g.fillStyle = shade(wall, -0.06);
        g.fillRect(x0, y0 + 58, 64, 6); // давхар хоорондын зурвас
        g.fillStyle = night ? '#2A3048' : '#55606E';
        g.fillRect(x0 + 8, y0 + 9, 48, 44);
        const lit = night && Math.random() < 0.62;
        const gr = g.createLinearGradient(0, y0 + 10, 0, y0 + 52);
        if (night) {
          gr.addColorStop(0, lit ? '#FFE3A3' : '#1A2140');
          gr.addColorStop(1, lit ? '#F4A93E' : '#121833');
        } else {
          gr.addColorStop(0, '#CFE3F2');
          gr.addColorStop(0.55, '#86A9C8');
          gr.addColorStop(1, '#5E7FA0');
        }
        g.fillStyle = gr;
        g.fillRect(x0 + 10, y0 + 11, 44, 40);
        g.fillStyle = night ? '#2A3048' : '#55606E';
        g.fillRect(x0 + 31, y0 + 11, 2, 40);
        g.fillRect(x0 + 10, y0 + 36, 44, 2);
      }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  function complex(host, opts) {
    const B = Nar3D.stage(host, [62, 72, 84], {
      target: [0, 2, 2],
      min: 45,
      max: 180,
      maxPolar: Math.PI / 2.25,
    });
    const { scene } = B;
    const fogC = new THREE.Color();
    scene.fog = new THREE.Fog(fogC, 110, 220);
    const hemi = new THREE.HemisphereLight('#fff', '#C9BFA8', 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#FFF4E2', 1.7);
    sun.position.set(34, 52, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50 });
    scene.add(sun);
    const ground = new THREE.Group(),
      blds = new THREE.Group(),
      lightsG = new THREE.Group(),
      deco = new THREE.Group();
    scene.add(ground, blds, lightsG, deco);

    // мод — дугуй титэмтэй ба шилмүүст
    TREES.forEach(([x, y, pine], i) => {
      const g = new THREE.Group();
      g.position.set(px(x), 0.3, pz(y));
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), mat('#6E5038'));
      tr.position.y = 0.6;
      tr.castShadow = true;
      g.add(tr);
      if (pine) {
        [
          [1.15, 1.6, 1.5],
          [0.9, 1.3, 2.3],
          [0.6, 1.0, 3.0],
        ].forEach(([r, h, y2]) => {
          const c = new THREE.Mesh(
            new THREE.ConeGeometry(r, h, 8),
            mat('#2F7D4A', { flatShading: true }),
          );
          c.position.y = y2;
          c.castShadow = true;
          g.add(c);
        });
      } else {
        [
          [0, 2.1, 0, 1.05],
          [0.5, 1.8, 0.3, 0.75],
          [-0.45, 1.85, -0.25, 0.7],
        ].forEach(([ox, oy, oz, r], k) => {
          const c = new THREE.Mesh(
            new THREE.IcosahedronGeometry(r, 1),
            mat(k ? '#6DB054' : '#5C9E48', { flatShading: true, roughness: 0.9 }),
          );
          c.position.set(ox, oy, oz);
          c.castShadow = true;
          g.add(c);
        });
      }
      g.rotation.y = i * 1.3;
      deco.add(g);
    });

    /* ---------- зогсоол (бодит P01–P48-тэй sync) ---------- */
    const LOT_ROWS = [12.8, 17.2, 19.9, 24.3];
    const LOT_AISLE = [15.0, 22.1];
    const LANE = 1; // төв замын эгнээ (орцны гэрлийн шонг тойроно)
    const spots = {};
    const lot = lotCtl(B, deco, {
      spots,
      padW: 2.15,
      padD: 2.05,
      padY: 0.375,
      opacity: 0.8,
      carScale: 0.7,
      ex: 3.5,
      xx: 3.5,
      y: (x) => (x >= 4.4 ? 0.37 : x <= 2.2 ? 0.03 : 0.03 + ((x - 2.2) / 2.2) * 0.34),
      pre: (a) => [
        Ln([LANE, 31], [LANE, a.az + 2.5]),
        Qd([LANE, a.az + 2.5], [LANE, a.az], [3.5, a.az]),
      ],
      post: (a) => [
        Qd([3.5, a.az], [LANE, a.az], [LANE, a.az + 2.5]),
        Ln([LANE, a.az + 2.5], [LANE, 31]),
      ],
    });
    let lotInit = false;

    /* ---------- хөтөч: төлбөр төлөөгүй айлтай байр руу дагуулж явна ---------- */
    const guide = Nar3D.person({ shirt: '#0A72B8', pants: '#24324A', hat: '#F5D130' });
    guide.scale.setScalar(1.35);
    const gRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.72, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: '#4FB0F5',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    gRing.position.y = 0.04;
    guide.add(gRing);
    deco.add(guide);
    const bubble = B.label(guide, '', 'g3-bubble', [0, 2.75, 0]);
    let bubbleHtml = '';
    const say = (h, cls = '') => {
      const el = bubble.userData.lbl.el.firstChild;
      if (h + cls === bubbleHtml) return;
      bubbleHtml = h + cls;
      el.className = 'g3-bubble ' + cls;
      el.innerHTML = h;
    };
    // зорилтот байрыг тодруулах цагираг + гэрлийн багана
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.25, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: '#E0525A',
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 14, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#FF6B6B',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.visible = beam.visible = false;
    deco.add(halo, beam);

    const SIDE_N = -4.75,
      SIDE_S = 0.75,
      HOME = { x: 3.5, z: SIDE_S };
    const doorOf = (b) => {
      const w = b.w / SC,
        d = b.d / SC,
        x = px(b.x) + w / 2;
      const north = b.y < 260;
      return {
        x,
        z: north ? pz(b.y) + d + 0.9 : pz(b.y) - 0.9,
        side: north ? SIDE_N : SIDE_S,
        face: north ? Math.PI / 2 : -Math.PI / 2,
        cx: x,
        cz: pz(b.y) + d / 2,
        r: Math.max(w, d) / 2 + 1.2,
        h: b.fl * FLOOR_H + 0.6,
      };
    };
    const sideOf = (z) => (z < -2 ? SIDE_N : SIDE_S);
    function route(P, D) {
      const sp = sideOf(P.z);
      const pts = [
        [P.x, P.z],
        [P.x, sp],
        [D.x, sp],
      ];
      if (sp !== D.side) pts.push([D.x, D.side]);
      pts.push([D.x, D.z]);
      return pts.filter(
        (p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05,
      );
    }
    const G = { x: HOME.x, z: HOME.z, path: [], mode: 'idle', until: 0, bi: -1, q: -1, sel: null };
    let debtInfo = [];
    const M1 = (n) => '₮' + (n / 1e6).toFixed(1) + 'M';
    function goTo(bi) {
      G.bi = bi;
      const dest = bi < 0 ? { ...HOME, side: SIDE_S } : doorOf(D_B[bi]);
      G.path = route(G, dest).slice(1);
      G.mode = 'walk';
      halo.visible = beam.visible = false;
    }
    const D_B = D.BUILDINGS;
    function nextTarget() {
      if (G.sel != null) return goTo(G.sel);
      const list = (debtInfo.order || []).filter((x) => x.n > 0); // хамгийн олон өртэйгээс
      if (!list.length) return goTo(-1);
      G.q = (G.q + 1) % list.length;
      goTo(list[G.q].i);
    }
    function showInfo(night) {
      if (G.bi < 0)
        return say(
          '<b>Бүх айл төлбөрөө төлсөн</b><span>Хотхон бүрэн санхүүжиж байна ✓</span>',
          'ok' + (night ? ' n' : ''),
        );
      const info = debtInfo[G.bi];
      if (G.mode === 'walk')
        return say(
          '<b>' +
            D_B[G.bi].n +
            '-р байр руу дагуулж байна…</b><span>' +
            (info.n ? info.n + ' айл төлбөрөө төлөөгүй' : 'Сонгосон байр') +
            '</span>',
          night ? 'n' : '',
        );
      say(
        '<b>' +
          D_B[G.bi].n +
          '-р байр · энд!</b><span>' +
          (info.n ? info.n + ' айл төлөөгүй · ' + M1(info.amt) : 'Бүх айл төлсөн ✓') +
          '</span>',
        (info.n ? 'bad' : 'ok') + (night ? ' n' : ''),
      );
    }
    let gLast = 0,
      curNight = false;
    B.frames.push((t) => {
      const dt = Math.min(0.05, t - gLast);
      gLast = t;
      const moving = G.mode === 'walk' && G.path.length > 0;
      if (moving) {
        const [tx, tz] = G.path[0];
        const dx = tx - G.x,
          dz = tz - G.z,
          dist = Math.hypot(dx, dz),
          stepLen = 4.2 * dt;
        if (dist <= stepLen) {
          G.x = tx;
          G.z = tz;
          G.path.shift();
        } else {
          G.x += (dx / dist) * stepLen;
          G.z += (dz / dist) * stepLen;
        }
        const want = Math.atan2(-dz, dx);
        let dr = want - guide.rotation.y;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        guide.rotation.y += dr * 0.25;
        if (!G.path.length) {
          // хүрлээ — байр руу эргэж, зааж харуулна
          G.mode = 'show';
          G.until = t + 6.5;
          if (G.bi >= 0) {
            const d = doorOf(D_B[G.bi]);
            guide.rotation.y = d.face;
            const info = debtInfo[G.bi];
            const col = info && info.n ? '#E0525A' : '#2EAE68';
            halo.material.color.set(col);
            beam.material.color.set(col);
            halo.position.set(d.cx, 0.34, d.cz);
            halo.scale.setScalar(d.r);
            beam.position.set(d.cx, d.h + 7.5, d.cz);
            halo.visible = beam.visible = true;
          } else guide.rotation.y = -Math.PI / 2;
          showInfo(curNight);
        }
      } else if (G.mode === 'show' && t > G.until && (G.sel == null || G.sel !== G.bi)) {
        nextTarget();
        showInfo(curNight);
      } else if (G.mode === 'idle') {
        nextTarget();
        showInfo(curNight);
      }
      guide.position.set(G.x, 0.3, G.z);
      Nar3D.walk(guide, t, moving, G.mode === 'show' && G.bi >= 0);
      gRing.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
      if (halo.visible) {
        const k = (t * 0.8) % 1;
        halo.material.opacity = 0.9 * (1 - k);
        halo.scale.setScalar((doorOf(D_B[G.bi]).r || 4) * (0.85 + k * 0.35));
        beam.material.opacity = 0.16 + Math.sin(t * 5) * 0.08;
      }
    });

    let alarm = [],
      bulbs = [];
    const prev = {};
    B.frames.push((t) => {
      alarm.forEach((m) => m.scale.set(1, 1 + Math.sin(t * 7) * 0.04, 1));
      bulbs.forEach(([m, st]) => {
        m.emissiveIntensity =
          st === 'off' ? (Math.sin(t * 6) > 0 ? 2.2 : 0.1) : Math.sin(t * 9) > 0 ? 1.6 : 0.3;
      });
    });
    B.onClick = (c) => {
      if (!c) return opts.onSelectB(null);
      if (c[0] === 'b') opts.onSelectB(c[1]);
      if (c[0] === 'l') opts.onSelectLight(c[1]);
    };
    const refreshClickables = () => {
      B.clickables.length = 0;
      blds.children.forEach((g) => B.clickables.push(g));
      lightsG.children.forEach((g) => B.clickables.push(g));
    };

    function buildGround(night) {
      B.clear(ground);
      const add = (m, x, y, z, flat) => {
        m.position.set(x, y, z);
        if (flat) m.rotation.x = -Math.PI / 2;
        m.receiveShadow = true;
        ground.add(m);
        return m;
      };
      const lawn = Nar3D.grainTexture(night ? '#1F3A2E' : '#A8C98A', 22, 10);
      const asphalt = Nar3D.grainTexture(night ? '#262C44' : '#50566A', 26, 12);
      const concrete = Nar3D.grainTexture(night ? '#2C3352' : '#ECE8E0', 10, 6);
      const white = mat('#F7F7F2', { roughness: 0.6 });
      add(
        new THREE.Mesh(new THREE.PlaneGeometry(84, 64), mat('#fff', { map: lawn, roughness: 1 })),
        0,
        -0.01,
        0,
        1,
      );
      [
        [14, 14, 322, 212],
        [414, 14, 332, 212],
        [14, 298, 322, 248],
        [414, 298, 332, 248],
      ].forEach(([x, y, w, d]) =>
        add(
          box(w / SC, 0.3, d / SC, mat('#fff', { map: concrete, roughness: 0.95 })),
          px(x) + w / SC / 2,
          0.15,
          pz(y) + d / SC / 2,
        ),
      );
      // гол зам + төв зам
      add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(84, 4.8),
          mat('#fff', { map: asphalt, roughness: 0.9 }),
        ),
        0,
        0.02,
        pz(260),
        1,
      );
      add(
        new THREE.Mesh(
          new THREE.PlaneGeometry(5, 64),
          mat('#fff', { map: asphalt, roughness: 0.9 }),
        ),
        px(375),
        0.025,
        0,
        1,
      );
      for (let i = 0; i < 23; i++) {
        const x = -40 + i * 3.6;
        if (Math.abs(x - px(375)) < 3.4) continue;
        add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), white), x, 0.04, pz(260), 1);
      }
      for (let i = 0; i < 17; i++) {
        const z = -30 + i * 3.6;
        if (Math.abs(z - pz(260)) < 3.2) continue;
        add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.6), white), px(375), 0.045, z, 1);
      }
      // явган хүний гарц (уулзварын 4 талд)
      for (let k = 0; k < 6; k++) {
        add(
          new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.2), white),
          px(375) - 1.9 + k * 0.75,
          0.046,
          pz(260) - 4.2,
          1,
        );
        add(
          new THREE.Mesh(new THREE.PlaneGeometry(0.45, 2.2), white),
          px(375) - 1.9 + k * 0.75,
          0.046,
          pz(260) + 4.2,
          1,
        );
        add(
          new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.45), white),
          px(375) - 4.4,
          0.046,
          pz(260) - 1.9 + k * 0.75,
          1,
        );
        add(
          new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.45), white),
          px(375) + 4.4,
          0.046,
          pz(260) - 1.9 + k * 0.75,
          1,
        );
      }
      // тоглоомын талбай
      add(
        box(19, 0.05, 16.8, mat(night ? '#21392F' : '#B7D39A')),
        px(540) + 9.5,
        0.32,
        pz(40) + 8.4,
      );
      add(
        box(9.2, 0.1, 6.4, mat(night ? '#5A3A3A' : '#E39A6C', { roughness: 0.95 })),
        px(560) + 4.6,
        0.4,
        pz(60) + 3.2,
      );
      add(box(1.2, 1.8, 3, mat('#F5D130', { roughness: 0.5 })), px(578), 1.2, pz(85)).castShadow =
        true;
      add(box(3.4, 0.4, 0.8, mat('#E85A4F', { roughness: 0.5 })), px(616), 1.6, pz(84)).castShadow =
        true;
      add(
        new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 2.2, 0.3, 32),
          mat('#5FB8D6', {
            emissive: '#5FB8D6',
            emissiveIntensity: 0.3,
            roughness: 0.1,
            metalness: 0.2,
          }),
        ),
        px(690),
        0.45,
        pz(162),
      );
      // зогсоолын талбай: асфальт, хашлага (median), зураас
      add(box(30.8, 0.06, 14.5, mat('#fff', { map: asphalt, roughness: 0.9 })), 20, 0.33, 18.55);
      add(box(30.4, 0.12, 0.3, mat(night ? '#2F4A3A' : '#8DBA6F')), 20, 0.37, 18.55);
      for (let c = 0; c <= 12; c++) {
        const x = 5 + c * 2.5;
        [12.8, 17.2, 19.9, 24.3].forEach((z) =>
          add(new THREE.Mesh(new THREE.PlaneGeometry(0.08, 2.2), white), x, 0.37, z, 1),
        );
      }
    }

    function buildBuildings(s) {
      B.clear(blds);
      alarm = [];
      const leakB = new Set(s.leaks.filter((x) => x.st !== 'fixed').map((x) => x.b));
      const night = s.night;
      D.BUILDINGS.forEach((b, i) => {
        const L = s.units[b.n - 1] || [];
        const paid = L.length ? L.filter((u) => u.st === 0).length / L.length : 0.9;
        let color = night ? '#59648A' : WALLS[i % WALLS.length],
          sub = '',
          tone = '';
        if (s.mode === 'pay') {
          color = paid >= 0.85 ? '#BFE3C8' : paid >= 0.7 ? '#F4DDA4' : '#F2B8B1';
          sub = Math.round(paid * 100) + '% төлсөн';
          tone = paid >= 0.85 ? 'ok' : paid >= 0.7 ? 'warn' : 'bad';
        }
        if (s.mode === 'leak') {
          if (leakB.has(b.n)) {
            color = '#F07C74';
            sub = 'Ус алдалт';
            tone = 'bad';
          } else {
            sub = 'Хэвийн';
            tone = 'ok';
          }
        }
        const sel = s.selB === i;
        const h = b.fl * FLOOR_H + 0.6,
          w = b.w / SC,
          d = b.d / SC;
        const wall = sel ? '#F4C536' : color;
        const tx = facadeTexture(night, wall),
          tz = facadeTexture(night, wall);
        tx.repeat.set(Math.max(1, Math.round(d / 1.2)), b.fl / 2);
        tz.repeat.set(Math.max(1, Math.round(w / 1.2)), b.fl / 2);
        const side = (t) =>
          mat('#fff', {
            map: t,
            emissiveMap: night ? t : null,
            emissive: night ? '#fff' : '#000',
            emissiveIntensity: night ? 0.6 : 0,
            roughness: 0.55,
            metalness: 0.08,
          });
        const roofM = mat(night ? '#2E3555' : shade(wall, -0.18), { roughness: 0.9 });
        const g = new THREE.Group();
        g.position.set(px(b.x) + w / 2, 0.3, pz(b.y) + d / 2);
        g.userData.click = ['b', i];
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2, 0);
        const m = new THREE.Mesh(geo, [side(tx), side(tx), roofM, roofM, side(tz), side(tz)]);
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        // доод давхар — бараан шилэн суурь
        const pod = box(
          w + 0.4,
          1.25,
          d + 0.4,
          mat(night ? '#3A4468' : '#47505E', {
            roughness: 0.25,
            metalness: 0.4,
            emissive: night ? '#FFB860' : '#000',
            emissiveIntensity: night ? 0.12 : 0,
          }),
        );
        pod.position.y = 0.62;
        pod.castShadow = pod.receiveShadow = true;
        g.add(pod);
        // дээврийн хашлага, тоног төхөөрөмж, нарны хавтан
        const par = mat(night ? '#3A4266' : shade(wall, -0.1));
        [
          [w, 0.4, 0.16, 0, d / 2],
          [w, 0.4, 0.16, 0, -d / 2],
          [0.16, 0.4, d, w / 2, 0],
          [0.16, 0.4, d, -w / 2, 0],
        ].forEach(([a, bb, c, x, z]) => {
          const p = box(a, bb, c, par);
          p.position.set(x, h + 0.2, z);
          g.add(p);
        });
        const mech = box(
          Math.min(2.2, w * 0.3),
          0.9,
          Math.min(1.8, d * 0.35),
          mat('#B9BEC6', { roughness: 0.6, metalness: 0.3 }),
        );
        mech.position.set(-w * 0.2, h + 0.45, -d * 0.12);
        mech.castShadow = true;
        g.add(mech);
        const solarM = mat('#22406E', { roughness: 0.2, metalness: 0.5 });
        const nS = Math.max(1, Math.floor((w * 0.4) / 1.3));
        for (let k = 0; k < nS; k++) {
          const sp = box(1.1, 0.06, Math.min(1.6, d * 0.4), solarM);
          sp.position.set(w * 0.08 + k * 1.3 - (nS * 1.3) / 2 + w * 0.15, h + 0.35, d * 0.15);
          sp.rotation.x = -0.35;
          g.add(sp);
        }
        // орцны саравч + гэрэлтэй хаалга (зам руу харсан талд)
        const north = b.y < 260;
        const fz = north ? d / 2 : -d / 2;
        const can = box(2.6, 0.12, 1.3, mat('#F2F2EE', { roughness: 0.4 }));
        can.position.set(0, 1.5, fz + (north ? 0.85 : -0.85));
        can.castShadow = true;
        g.add(can);
        const door = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 1.1),
          mat('#FFE7B0', { emissive: '#FFD27A', emissiveIntensity: night ? 1.4 : 0.35 }),
        );
        door.position.set(0, 0.62, fz + (north ? 0.21 : -0.21));
        if (!north) door.rotation.y = Math.PI;
        g.add(door);
        if (s.mode === 'leak' && leakB.has(b.n)) {
          alarm.push(m);
          const pl = new THREE.PointLight('#FF5A4E', 30, 14);
          pl.position.set(0, h / 2, d / 2 + 1);
          g.add(pl);
        }
        blds.add(g);
        B.label(
          g,
          '<b class="b3-name' +
            (night ? ' n' : '') +
            (sel ? ' sel' : '') +
            '">' +
            b.n +
            '-р байр</b>' +
            (sub ? '<span class="b3-sub ' + tone + '">' + sub + '</span>' : ''),
          'b3-label',
          [0, h + 3.4, 0],
        );
      });
      refreshClickables();
    }

    function buildLights(s) {
      B.clear(lightsG);
      bulbs = [];
      s.lights.forEach((l) => {
        const x = px(l.x),
          z = pz(l.y);
        const g = new THREE.Group();
        g.position.set(x, 0.3, z);
        g.userData.click = ['l', l.id];
        const poleM = mat('#3A3F48', { roughness: 0.4, metalness: 0.6 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.4, 8), poleM);
        pole.position.y = 1.7;
        pole.castShadow = true;
        g.add(pole);
        // гар нь хамгийн ойрын зам руу харна
        const toMain = Math.abs(z - pz(260)) < Math.abs(x - px(375));
        const dir = toMain ? Math.sign(pz(260) - z) || 1 : Math.sign(px(375) - x) || 1;
        const arm = box(toMain ? 0.06 : 0.9, 0.06, toMain ? 0.9 : 0.06, poleM);
        arm.position.set(toMain ? 0 : dir * 0.45, 3.35, toMain ? dir * 0.45 : 0);
        g.add(arm);
        const col = l.st === 'on' ? '#FFF1C8' : l.st === 'off' ? '#E0525A' : '#F0B03E';
        const bm = mat(col, {
          emissive: col,
          emissiveIntensity: l.st === 'on' ? (s.night ? 3 : 0.9) : 1,
        });
        const r = s.selLight === l.id ? 0.36 : 0.24;
        const bulb = new THREE.Mesh(
          new THREE.BoxGeometry(toMain ? r * 1.4 : r * 2.2, 0.12, toMain ? r * 2.2 : r * 1.4),
          bm,
        );
        bulb.position.set(toMain ? 0 : dir * 0.9, 3.28, toMain ? dir * 0.9 : 0);
        g.add(bulb);
        if (s.selLight === l.id) {
          const sel = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.65, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: '#4FB0F5', transparent: true, opacity: 0.9 }),
          );
          sel.position.y = 0.02;
          g.add(sel);
        }
        const hit = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 4.2, 8),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        hit.position.y = 2;
        g.add(hit);
        if (l.st !== 'on') bulbs.push([bm, l.st]);
        if (s.night && l.st === 'on') {
          const pl = new THREE.PointLight('#FFD58A', 18, 9);
          pl.position.set(bulb.position.x, 3.0, bulb.position.z);
          g.add(pl);
        }
        lightsG.add(g);
        if (l.st === 'off') B.label(g, '!', 'b3-warn', [0, 4.4, 0]);
      });
      refreshClickables();
    }

    function update(s) {
      const night = !!s.night;
      if (prev.night !== night) {
        scene.background = Nar3D.skyTexture(
          night
            ? [
                [0, '#050A1F'],
                [0.6, '#14204A'],
                [1, '#2A2F55'],
              ]
            : [
                [0, '#8EC3EE'],
                [0.55, '#D7E9F5'],
                [1, '#F4F1EA'],
              ],
        );
        fogC.set(night ? '#1A2246' : '#E6EEF2');
        hemi.color.set(night ? '#3A4A80' : '#FFFFFF');
        hemi.groundColor.set(night ? '#101426' : '#C9BFA8');
        hemi.intensity = night ? 0.35 : 0.9;
        sun.color.set(night ? '#9DB4FF' : '#FFF4E2');
        sun.intensity = night ? 0.3 : 1.7;
        buildGround(night);
        curNight = night;
        bubbleHtml = ''; // хөтчийн бөмбөлгийг шөнө/өдрийн өнгөөр дахин зурна
        if (G.mode !== 'idle') showInfo(night);
      }
      const leakKey = s.leaks
        .filter((x) => x.st !== 'fixed')
        .map((x) => x.b)
        .join(',');
      const payKey = s.units.map((L) => L.filter((u) => u.st === 0).length).join(',');
      const bKey = [night, s.mode, s.selB, leakKey, s.mode === 'pay' ? payKey : ''].join('|');
      const lKey = [night, s.selLight, s.lights.map((l) => l.st).join('')].join('|');
      if (bKey !== prev.bKey) {
        prev.bKey = bKey;
        buildBuildings(s);
      }
      if (lKey !== prev.lKey) {
        prev.lKey = lKey;
        buildLights(s);
      }
      prev.night = night;
      // зогсоол — "Зогсоол" хуудастай ижил өгөгдөл
      if (s.slots) {
        const list = s.slots.filter((x) => x.zone === 'p');
        list.forEach((sl, i) => {
          const r = Math.floor(i / 12) % 4,
            c = i % 12;
          spots[sl.id] = { x: 6.25 + c * 2.5, z: LOT_ROWS[r], az: LOT_AISLE[r < 2 ? 0 : 1] };
        });
        lot.sync(list, lotInit);
        lotInit = true;
      }
      // хөтөч — төлбөр төлөөгүй айлтай байрнууд
      debtInfo = D.BUILDINGS.map((b, i) => {
        const L = (s.units[b.n - 1] || []).filter((u) => u.st !== 0);
        return { i, n: L.length, amt: L.reduce((a, u) => a + u.amt + u.prev, 0) };
      });
      debtInfo.order = debtInfo.slice().sort((a, b) => b.n - a.n);
      if (s.selB !== G.sel) {
        G.sel = s.selB;
        if (G.sel != null) goTo(G.sel);
        else if (G.mode === 'show') G.until = 0;
        showInfo(night);
      } else if (G.mode === 'show') showInfo(night);
    }
    return { update };
  }

  /* ======================================================================
     Зогсоол: зогсоол бүрийн мэдрэгч, машин, сул/захиалсан шошго
     ====================================================================== */
  function parking(host, opts) {
    const zone = opts.zone || 'p';
    const garage = zone === 'g';
    const B = Nar3D.stage(host, [40, 62, 72], {
      target: [0, 0, 0],
      min: 40,
      max: 190,
      maxPolar: Math.PI / 2.3,
      narrow: 2.05,
    });
    const { scene } = B;
    scene.background = Nar3D.skyTexture(
      garage
        ? [
            [0, '#1C2027'],
            [1, '#3A3F48'],
          ]
        : [
            [0, '#9CCBEE'],
            [0.6, '#DDEBF3'],
            [1, '#F1EEE6'],
          ],
    );
    scene.fog = new THREE.Fog(garage ? '#2E333B' : '#E9EEF0', 130, 280);
    scene.add(
      new THREE.HemisphereLight('#fff', garage ? '#22262C' : '#C9BFA8', garage ? 0.6 : 0.9),
    );
    const sun = new THREE.DirectionalLight(garage ? '#E8F0FF' : '#FFF4E2', garage ? 0.7 : 1.6);
    sun.position.set(20, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 });
    scene.add(sun);
    const cols = garage ? 10 : 12,
      sw = garage ? 5.4 : 4.6,
      sd = garage ? 7.2 : 6.6;
    const rowsZ = garage ? [-20, -6, 4, 18] : [-21, -8, 3, 16];
    const x0 = -(cols * sw) / 2;
    const aisleZ = [(rowsZ[0] + sd + rowsZ[1]) / 2, (rowsZ[2] + sd + rowsZ[3]) / 2];
    const add = (m, x, y, z, flat) => {
      m.position.set(x, y, z);
      if (flat) m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const floorTex = Nar3D.grainTexture(garage ? '#878B92' : '#5E636D', 24, 10);
    add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(74, 56),
        mat('#fff', { map: floorTex, roughness: 0.92 }),
      ),
      0,
      0,
      0,
      1,
    );
    const lineM = mat('#F4F4EE', { roughness: 0.6 });
    const yellowM = mat('#F2C23A', { roughness: 0.6 });
    // зогсоолын зураас + дугуй тогтоогч
    const stopM = mat(garage ? '#C9CDD2' : '#D8D4CA', { roughness: 0.8 });
    rowsZ.forEach((z0, r) => {
      const back = r % 2 === 0 ? z0 + 0.15 : z0 + sd - 0.15;
      for (let c = 0; c <= cols; c++)
        add(
          new THREE.Mesh(new THREE.PlaneGeometry(0.14, sd), lineM),
          x0 + c * sw,
          0.012,
          z0 + sd / 2,
          1,
        );
      add(new THREE.Mesh(new THREE.PlaneGeometry(cols * sw, 0.14), lineM), 0, 0.012, back, 1);
      for (let c = 0; c < cols; c++) {
        const s = box(sw * 0.42, 0.14, 0.26, stopM);
        s.position.set(x0 + c * sw + sw / 2, 0.07, back + (r % 2 === 0 ? 0.55 : -0.55));
        s.castShadow = true;
        scene.add(s);
      }
    });
    aisleZ.forEach((z) => {
      for (let k = 0; k < 18; k++)
        add(
          new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.2), garage ? yellowM : lineM),
          -34 + k * 4,
          0.012,
          z,
          1,
        );
      // гарц — "P" самбар, хаалт
      const post = box(0.25, 2.2, 0.25, mat('#3A3F48', { metalness: 0.5, roughness: 0.4 }));
      post.position.set(-36.2, 1.1, z - 2.4);
      post.castShadow = true;
      scene.add(post);
      const bar = box(0.12, 0.12, 4.2, mat('#E0525A'));
      bar.position.set(-36.2, 2.15, z - 0.3);
      bar.rotation.x = -1.2; // өргөгдсөн (нээлттэй) хаалт
      scene.add(bar);
    });
    if (garage) {
      const wallM = mat('#B9BDC3', { roughness: 0.85 });
      [
        [0, -27.5, 74, 1],
        [0, 27.5, 74, 1],
        [36.5, 0, 1, 56],
      ].forEach(([x, z, w, d]) => {
        const m = box(w, 3.6, d, wallM);
        m.position.set(x, 1.8, z);
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
        const st = box(w === 1 ? 1.02 : w, 0.4, d === 1 ? 1.02 : d, yellowM);
        st.position.set(x, 0.2, z);
        scene.add(st);
      });
      const mid = box(58, 2.8, 1, mat('#A5AAB1', { roughness: 0.85 }));
      mid.position.set(0, 1.4, (rowsZ[1] + sd + rowsZ[2]) / 2);
      mid.castShadow = true;
      scene.add(mid);
      rowsZ.forEach((z, r) => {
        for (let k = 0; k <= cols / 2; k++) {
          const p = box(0.8, 4.4, 0.8, mat('#C9CDD2', { roughness: 0.8 }));
          p.position.set(x0 + k * 2 * sw, 2.2, r % 2 === 0 ? z - 0.7 : z + sd + 0.7);
          p.castShadow = true;
          scene.add(p);
        }
      });
      aisleZ.forEach((z) => {
        for (let k = 0; k < 5; k++) {
          const pl = new THREE.PointLight('#DDE8FF', 14, 18);
          pl.position.set(-26 + k * 13, 4.2, z);
          scene.add(pl);
        }
      });
    } else {
      const midZ = (rowsZ[1] + sd + rowsZ[2]) / 2;
      const m = box(60, 0.5, 2.2, mat('#9CC47C', { roughness: 0.95 }));
      m.position.set(0, 0.25, midZ);
      m.receiveShadow = true;
      scene.add(m);
      for (let k = 0; k < 7; k++) {
        const x = -27 + k * 9;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), mat('#6E5038'));
        tr.position.set(x, 1, midZ);
        const top = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.95, 1),
          mat(k % 2 ? '#6DB054' : '#5C9E48', { flatShading: true }),
        );
        top.position.set(x, 2.1, midZ);
        tr.castShadow = top.castShadow = true;
        scene.add(tr, top);
      }
    }

    const spots = {},
      dots = {},
      senses = {};
    const dotGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const ctl = lotCtl(B, scene, {
      spots,
      padW: sw - 0.5,
      padD: sd - 0.5,
      padY: 0.02,
      opacity: 0.5,
      carScale: garage ? 1.15 : 1.05,
      ex: -40,
      xx: -40, // гарц зүүн талд — хотхоны map дээрхтэй адил нэг хаалгаар орж, гарна
      click: true,
      onPaint: (id, stt) => {
        const dm = dots[id];
        if (!dm) return;
        const sn = senses[id];
        const c =
          sn === 'off'
            ? '#64748B'
            : sn === 'low'
              ? '#F0B03E'
              : stt === 'free'
                ? '#3DDC84'
                : '#E0525A';
        dm.color.set(c);
        dm.emissive.set(c);
      },
    });
    const labelsG = new THREE.Group();
    scene.add(labelsG);
    const selFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(sw - 0.2, sd - 0.2).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    );
    selFrame.visible = false;
    scene.add(selFrame);
    B.frames.push((t) => {
      if (selFrame.visible) selFrame.scale.setScalar(1 + Math.sin(t * 5) * 0.015);
    });
    let key = '',
      cur = null,
      inited = false;
    B.onClick = (c) => {
      if (c && c[0] === 's') {
        const s = cur.slots.find((x) => x.id === c[1]);
        if (s) opts.onPick(s);
      }
    };
    function update(s) {
      cur = s;
      const list = s.slots.filter((x) => x.zone === zone);
      list.forEach((sl, i) => {
        const r = Math.floor(i / cols) % 4,
          c = i % cols,
          top = r % 2 === 0;
        const x = x0 + c * sw + sw / 2,
          z = rowsZ[r] + sd / 2;
        if (!spots[sl.id]) {
          spots[sl.id] = { x, z, az: aisleZ[r < 2 ? 0 : 1], top };
          const dm = mat('#3DDC84', { emissive: '#3DDC84', emissiveIntensity: 1.4 });
          const dot = new THREE.Mesh(dotGeo, dm);
          dot.position.set(x, 0.14, top ? z + sd / 2 - 0.5 : z - sd / 2 + 0.5);
          scene.add(dot);
          dots[sl.id] = dm;
        }
        senses[sl.id] = sl.sens;
      });
      ctl.sync(list, inited);
      inited = true;
      const k = list.map((x) => x.st + (x.mine ? 'm' : '') + x.sens).join('') + '|' + s.selected;
      if (k !== key) {
        key = k;
        B.clear(labelsG);
        list.forEach((sl, i) => {
          const a = spots[sl.id];
          const g = new THREE.Group();
          labelsG.add(g);
          if ((sl.st === 0 && i % 2 === 0) || sl.st === 3 || sl.mine) {
            const t = sl.mine
              ? sl.st === 1
                ? 'Таны машин'
                : 'Таны захиалга'
              : sl.st === 3
                ? '⏱'
                : 'P';
            B.label(g, t, 'p3-tag ' + (sl.mine ? 'mine' : sl.st === 3 ? 'res' : 'free'), [
              a.x,
              sl.st === 1 ? 3 : 1.6,
              a.z,
            ]);
          }
          B.label(g, sl.id, 'p3-id', [a.x, 0.05, a.top ? a.z - sd / 2 + 0.9 : a.z + sd / 2 - 0.9]);
          // мэдрэгчийн өнгө (харагдах төлөвөөр)
          const stt = ctl.disp[sl.id] || 'free';
          const dm = dots[sl.id];
          const c =
            sl.sens === 'off'
              ? '#64748B'
              : sl.sens === 'low'
                ? '#F0B03E'
                : stt === 'free'
                  ? '#3DDC84'
                  : '#E0525A';
          dm.color.set(c);
          dm.emissive.set(c);
        });
        const sel = s.selected && spots[s.selected];
        selFrame.visible = !!sel;
        if (sel) selFrame.position.set(sel.x, 0.06, sel.z);
      }
      B.clickables.length = 0;
      Object.values(ctl.pads).forEach((p) => B.clickables.push(p.mesh));
      ctl.cars.forEach((c) => B.clickables.push(c));
    }
    return { update };
  }

  window.Scenes = { complex, parking };
})();
