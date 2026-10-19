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
        dom.setPointerCapture(e.pointerId);
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
    new ResizeObserver(resize).observe(host);
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
    (function loop() {
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
          if (x.geometry) x.geometry.dispose();
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
    const api = { renderer, scene, camera, orbit, clickables, frames, clear, label, onClick() {} };
    return api;
  }

  function carBody(color, scale = 1) {
    const g = new THREE.Group();
    g.scale.setScalar(scale);
    const b = box(2.8, 0.7, 1.5, mat(color, { roughness: 0.5 }));
    b.position.y = 0.45;
    b.castShadow = true;
    g.add(b);
    const t = box(1.5, 0.55, 1.35, mat('#2E3440', { roughness: 0.3 }));
    t.position.set(-0.1, 1.05, 0);
    t.castShadow = true;
    g.add(t);
    [0.45, -0.45].forEach((z) => {
      const h = box(
        0.04,
        0.18,
        0.3,
        mat('#FFE38A', { emissive: '#FFE38A', emissiveIntensity: 1.2 }),
      );
      h.position.set(1.41, 0.5, z);
      g.add(h);
    });
    return g;
  }

  window.Nar3D = { OrbitCam, Labels, stage, mat, box, carBody };
})();
