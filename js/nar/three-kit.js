/* ==========================================================================
   Nar3D — Three.js дээр өөрөө бичсэн туслах: камер эргүүлэх (orbit), HTML шошго,
   resize, дарсан объектыг олох (raycast), анимацийн давталт.
   Three.js-ийн зөвхөн core (three.min.js) ашиглана — нэмэлт addon байхгүй.
   ========================================================================== */
(function () {
  // өнгийг зөв (sRGB → linear) тооцоолох — үгүй бол бүх юм цайвар харагдана
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  /** Хулгана/хуруугаар чирж эргүүлэх, scroll/pinch-ээр томруулах камер */
  class OrbitCam {
    constructor(camera, dom, o) {
      this.camera = camera;
      this.dom = dom;
      this.target = new THREE.Vector3(...(o.target || [0, 0, 0]));
      this.min = o.min || 20;
      this.max = o.max || 200;
      this.maxPolar = o.maxPolar || Math.PI / 2.2;
      this.minPolar = 0.15;
      this.sph = new THREE.Spherical();
      this.goal = new THREE.Spherical();
      this.setFrom(camera.position);
      this.ptrs = new Map();
      this.pinch = 0;
      this.moved = 0;
      dom.addEventListener('pointerdown', (e) => {
        try {
          dom.setPointerCapture(e.pointerId);
        } catch (err) {} // зарим төхөөрөмж дэмжихгүй
        this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        this.moved = 0;
      });
      dom.addEventListener('pointermove', (e) => {
        const p = this.ptrs.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p[0],
          dy = e.clientY - p[1];
        p[0] = e.clientX;
        p[1] = e.clientY;
        this.moved += Math.abs(dx) + Math.abs(dy);
        if (this.ptrs.size === 1) {
          const h = dom.clientHeight || 500;
          this.goal.theta -= (dx / h) * Math.PI * 1.1;
          this.goal.phi -= (dy / h) * Math.PI * 1.1;
        } else if (this.ptrs.size === 2) {
          const [a, b] = [...this.ptrs.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (this.pinch) this.zoom(this.pinch / d);
          this.pinch = d;
        }
        this.clamp();
      });
      const up = (e) => {
        this.ptrs.delete(e.pointerId);
        this.pinch = 0;
      };
      dom.addEventListener('pointerup', up);
      dom.addEventListener('pointercancel', up);
      dom.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.zoom(Math.exp(e.deltaY * 0.0012));
        },
        { passive: false },
      );
    }
    setFrom(pos) {
      this.sph.setFromVector3(pos.clone().sub(this.target));
      this.goal.copy(this.sph);
      this.clamp();
    }
    zoom(k) {
      this.goal.radius = Math.min(this.max, Math.max(this.min, this.goal.radius * k));
    }
    clamp() {
      this.goal.phi = Math.min(this.maxPolar, Math.max(this.minPolar, this.goal.phi));
    }
    update() {
      // зөөлөн (damping) хөдөлгөөн
      const s = this.sph,
        g = this.goal,
        k = 0.16;
      s.radius += (g.radius - s.radius) * k;
      s.phi += (g.phi - s.phi) * k;
      s.theta += (g.theta - s.theta) * k;
      this.camera.position.setFromSpherical(s).add(this.target);
      this.camera.lookAt(this.target);
    }
  }

  /** 3D цэгт наалдсан HTML шошго — дэлгэц рүү проекц хийж байрлуулна */
  class Labels {
    constructor(host) {
      this.root = document.createElement('div');
      this.root.className = 'lbl-root';
      host.appendChild(this.root);
      this.items = new Set();
      this.v = new THREE.Vector3();
    }
    add(obj, html, cls = '') {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.innerHTML = '<div class="' + cls + '">' + html + '</div>';
      this.root.appendChild(el);
      const it = { obj, el };
      obj.userData.lbl = it;
      this.items.add(it);
      return it;
    }
    remove(it) {
      it.el.remove();
      this.items.delete(it);
    }
    render(camera, w, h) {
      this.items.forEach((it) => {
        it.obj.getWorldPosition(this.v);
        this.v.project(camera);
        const vis = this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2;
        it.el.style.display = vis ? '' : 'none';
        if (!vis) return;
        it.el.style.transform =
          'translate(' +
          ((this.v.x + 1) / 2) * w +
          'px,' +
          ((1 - this.v.y) / 2) * h +
          'px) translate(-50%,-50%)';
        it.el.style.zIndex = String(Math.round((1 - this.v.z) * 100000));
      });
    }
  }

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color }, o));
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  /**
   * Үзэгдлийн суурь: renderer, камер, orbit, шошго, resize, click.
   * cam: [x,y,z] эхлэх байрлал · o: { target, min, max, maxPolar }
   */
  function stage(host, cam, o) {
    host.classList.add('stage3d');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = true;
    renderer.domElement.className = 'stage3d-canvas';
    host.appendChild(renderer.domElement);
    const labels = new Labels(host);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
    camera.position.set(...cam);
    const orbit = new OrbitCam(camera, renderer.domElement, o);
    let W = 1,
      H = 1,
      lastK = 0,
      fogBase = null;
    function resize() {
      W = host.clientWidth || 1;
      H = host.clientHeight || 1;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      const k = W < 520 ? o.narrow || 1.7 : W < 760 ? 1.25 : 1; // нарийн дэлгэц дээр камерыг холдуулна
      if (k !== lastK) {
        lastK = k;
        if (scene.fog) {
          if (!fogBase) fogBase = [scene.fog.near, scene.fog.far];
          scene.fog.near = fogBase[0] * k;
          scene.fog.far = fogBase[1] * k;
        } // камер холдоход манан ч холдоно
        orbit.setFrom(new THREE.Vector3(cam[0] * k, cam[1] * k, cam[2] * k).add(orbit.target));
        orbit.sph.copy(orbit.goal);
      }
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    requestAnimationFrame(() => {
      lastK = 0;
      resize();
    });
    const ray = new THREE.Raycaster(),
      v2 = new THREE.Vector2(),
      clickables = [];
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v2, camera);
      const hit = ray.intersectObjects(clickables, true)[0];
      let x = hit && hit.object;
      while (x && !x.userData.click) x = x.parent;
      return x ? x.userData.click : null;
    };
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (orbit.moved < 8) api.onClick(pick(e));
    });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!orbit.ptrs.size) renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab';
    });
    const frames = [];
    const clock = new THREE.Clock();
    let dead = false;
    (function loop() {
      if (dead) return;
      requestAnimationFrame(loop);
      if (!host.isConnected) return; // хуудаснаас салсан үед зурахгүй (keep-alive)
      const t = clock.getElapsedTime();
      frames.forEach((f) => f(t));
      orbit.update();
      renderer.render(scene, camera);
      labels.render(camera, W, H);
    })();
    /** групп доторх бүх объект, шошгыг цэвэрлэнэ */
    function clear(g) {
      while (g.children.length) {
        const c = g.children.pop();
        c.traverse((x) => {
          if (x.geometry && !x.geometry.userData.keep) x.geometry.dispose();
          if (x.userData.lbl) labels.remove(x.userData.lbl);
        });
      }
    }
    /** obj дээр шошго наах: label(obj, html, cls, [x,y,z]) */
    function label(parent, html, cls, pos) {
      const a = new THREE.Object3D();
      a.position.set(...pos);
      parent.add(a);
      labels.add(a, html, cls);
      return a;
    }
    /** үзэгдлийг бүрэн устгана (WebGL context-ыг чөлөөлж, canvas, шошгыг хасна) */
    function dispose() {
      dead = true;
      ro.disconnect();
      clear(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.root.remove();
    }
    const api = {
      renderer,
      scene,
      camera,
      orbit,
      clickables,
      frames,
      clear,
      label,
      dispose,
      onClick() {},
    };
    return api;
  }

  /* ---------- орчин үеийн загварууд: машин, хүн, тэнгэр ---------- */
  // олон машин нэг геометрийг хуваалцана (keep → clear() үед устгахгүй)
  const keepGeo = (g) => ((g.userData.keep = true), g);
  const GEO = {};
  const matCache = new Map();
  const cmat = (key, make) => {
    if (!matCache.has(key)) matCache.set(key, make());
    return matCache.get(key);
  };
  function carGeo() {
    if (GEO.body) return GEO;
    // хажуугаас харсан их бие (урд талдаа намхан, ард өндөр) → өргөн рүү extrude
    const s = new THREE.Shape();
    s.moveTo(-1.38, 0.26);
    s.lineTo(1.38, 0.26);
    s.quadraticCurveTo(1.46, 0.27, 1.45, 0.42);
    s.lineTo(1.42, 0.6);
    s.quadraticCurveTo(1.38, 0.7, 1.15, 0.72);
    s.lineTo(-1.2, 0.76);
    s.quadraticCurveTo(-1.42, 0.75, -1.43, 0.58);
    s.lineTo(-1.43, 0.4);
    s.quadraticCurveTo(-1.43, 0.27, -1.38, 0.26);
    const ext = {
      depth: 1.26,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelSegments: 3,
      curveSegments: 6,
    };
    GEO.body = keepGeo(new THREE.ExtrudeGeometry(s, ext).translate(0, 0, -0.63));
    const c = new THREE.Shape();
    c.moveTo(-0.98, 0.72);
    c.lineTo(0.72, 0.72);
    c.quadraticCurveTo(0.42, 1.12, 0.22, 1.16);
    c.lineTo(-0.72, 1.17);
    c.quadraticCurveTo(-0.9, 1.15, -0.98, 0.72);
    GEO.cabin = keepGeo(
      new THREE.ExtrudeGeometry(c, {
        depth: 1.12,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2,
      }).translate(0, 0, -0.56),
    );
    GEO.roof = keepGeo(new THREE.BoxGeometry(0.98, 0.07, 1.14));
    GEO.wheel = keepGeo(new THREE.CylinderGeometry(0.29, 0.29, 0.22, 18).rotateX(Math.PI / 2));
    GEO.rim = keepGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 12).rotateX(Math.PI / 2));
    GEO.lamp = keepGeo(new THREE.BoxGeometry(0.05, 0.12, 0.34));
    GEO.shadow = keepGeo(new THREE.PlaneGeometry(3.1, 1.75).rotateX(-Math.PI / 2));
    return GEO;
  }
  let blobTex = null;
  function blob() {
    if (blobTex) return blobTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    r.addColorStop(0, 'rgba(0,0,0,.55)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return (blobTex = new THREE.CanvasTexture(c));
  }

  /** Орчин үеийн жижиг машин: гөлгөр их бие, шилэн кабин, дугуй, урд/хойд гэрэл. Урагшаа +x. */
  function carBody(color, scale = 1) {
    const G = carGeo();
    const g = new THREE.Group();
    g.scale.setScalar(scale);
    const paint = cmat('p' + color, () => mat(color, { roughness: 0.35, metalness: 0.12 }));
    const body = new THREE.Mesh(G.body, paint);
    body.castShadow = true;
    const glass = cmat('glass', () => mat('#2A3A4C', { roughness: 0.12, metalness: 0.2 }));
    const cab = new THREE.Mesh(G.cabin, glass);
    cab.castShadow = true;
    const roof = new THREE.Mesh(G.roof, paint);
    roof.position.set(-0.28, 1.25, 0);
    g.add(body, cab, roof);
    const tire = cmat('tire', () => mat('#15171B', { roughness: 0.9 }));
    const rim = cmat('rim', () => mat('#B8C0CC', { roughness: 0.3, metalness: 0.8 }));
    [0.86, -0.86].forEach((x) =>
      [0.62, -0.62].forEach((z) => {
        const w = new THREE.Mesh(G.wheel, tire);
        w.position.set(x, 0.29, z);
        const r = new THREE.Mesh(G.rim, rim);
        r.position.set(x, 0.29, z);
        g.add(w, r);
      }),
    );
    const head = cmat('head', () =>
      mat('#FFF6D8', { emissive: '#FFF0C0', emissiveIntensity: 1.6 }),
    );
    const tail = cmat('tail', () =>
      mat('#E0303A', { emissive: '#FF2A36', emissiveIntensity: 1.2 }),
    );
    [0.42, -0.42].forEach((z) => {
      const h = new THREE.Mesh(G.lamp, head);
      h.position.set(1.5, 0.55, z);
      const tl = new THREE.Mesh(G.lamp, tail);
      tl.position.set(-1.5, 0.6, z);
      g.add(h, tl);
    });
    // зөөлөн газрын сүүдэр (бодит сүүдрийн доор жаахан гүн өгнө)
    const sh = new THREE.Mesh(
      G.shadow,
      cmat(
        'blob',
        () => new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false }),
      ),
    );
    sh.position.y = 0.015;
    g.add(sh);
    return g;
  }

  /**
   * Бага полигонтой хүн (хөтөч). Урагшаа +x. walk(p, t, moving, point) — алхах / заах хөдөлгөөн.
   */
  function person(o = {}) {
    const { shirt = '#F28C28', pants = '#2F3B52', skin = '#F2C7A5', hat = '#F5D130' } = o;
    const g = new THREE.Group();
    const M = (c) => mat(c, { roughness: 0.75 });
    const limb = (w, h, d, m) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(0, -h / 2, 0);
      const me = new THREE.Mesh(geo, m);
      me.castShadow = true;
      return me;
    };
    const pm = M(pants),
      sm = M(shirt),
      km = M(skin);
    const legL = limb(0.2, 0.86, 0.22, pm),
      legR = limb(0.2, 0.86, 0.22, pm);
    legL.position.set(0, 0.88, 0.13);
    legR.position.set(0, 0.88, -0.13);
    const torso = box(0.32, 0.64, 0.5, sm);
    torso.position.y = 1.2;
    torso.castShadow = true;
    const band = box(
      0.33,
      0.07,
      0.51,
      mat('#EEF3F7', { emissive: '#ffffff', emissiveIntensity: 0.25 }),
    );
    band.position.y = 1.08;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), km);
    head.position.y = 1.72;
    head.castShadow = true;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.205, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      M(hat),
    );
    cap.position.y = 1.76;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 16), M(hat));
    brim.position.set(0.04, 1.77, 0);
    const armL = limb(0.14, 0.6, 0.14, sm),
      armR = limb(0.14, 0.6, 0.14, sm);
    armL.position.set(0, 1.5, 0.33);
    armR.position.set(0, 1.5, -0.33);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), km);
    handL.position.y = -0.62;
    armL.add(handL);
    const handR = handL.clone();
    armR.add(handR);
    g.add(legL, legR, torso, band, head, cap, brim, armL, armR);
    g.userData.rig = { legL, legR, armL, armR, body: [torso, band, head, cap, brim] };
    return g;
  }
  function walk(p, t, moving, point) {
    const r = p.userData.rig;
    const s = moving ? Math.sin(t * 9) * 0.65 : 0;
    r.legL.rotation.z = s;
    r.legR.rotation.z = -s;
    r.armL.rotation.z = -s * 0.8;
    // заахдаа баруун гараа урагш, дээш өргөнө
    const goal = point ? 2.3 + Math.sin(t * 4) * 0.12 : s * 0.8;
    r.armR.rotation.z += (goal - r.armR.rotation.z) * 0.18;
    const bob = moving ? Math.abs(Math.sin(t * 9)) * 0.06 : Math.sin(t * 2) * 0.015;
    r.body.forEach((m, i) => (m.position.y = [1.2, 1.08, 1.72, 1.76, 1.77][i] + bob));
    r.armL.position.y = r.armR.position.y = 1.5 + bob;
  }

  /** Босоо gradient (тэнгэр) — scene.background-д */
  function skyTexture(stops) {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    stops.forEach(([k, col]) => gr.addColorStop(k, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, 2, 256);
    const tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    return tx;
  }
  /** Асфальт, зүлэгний жижиг ширхэгтэй бүтэц */
  function grainTexture(base, amount = 18, repeat = 8) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) {
      const v = (Math.random() - 0.5) * amount;
      g.fillStyle = v > 0 ? 'rgba(255,255,255,' + v / 100 + ')' : 'rgba(0,0,0,' + -v / 100 + ')';
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const tx = new THREE.CanvasTexture(c);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(repeat, repeat);
    tx.encoding = THREE.sRGBEncoding;
    return tx;
  }

  window.Nar3D = {
    OrbitCam,
    Labels,
    stage,
    mat,
    box,
    carBody,
    person,
    walk,
    skyTexture,
    grainTexture,
  };
})();
