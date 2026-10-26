/* СӨХ Platform — Ажилтан (staff.html) */
(function () {
  const { html, cx } = Nar;
  const { ic, seg, prio } = Shell;
  const { REQ_STATUS, ME_STAFF, ago } = D;
  const ui = { filter: 'all', open: null, cele: false };
  const set = (p) => {
    Object.assign(ui, p);
    Shell.refresh(['ui']);
  };
  const mine = () => S.state.reqs.filter((q) => q.by === ME_STAFF.n);
  const workNote = (kind, going) =>
    html`<span class="accc t12 b"
      >${kind === 'walk'
        ? going
          ? 'Байршил руу явж байна'
          : 'Байршил руу явахад бэлэн'
        : 'Та засвар хийж байна · оршин суугчид явц шууд харагдаж байна'}</span
    >`;

  function today() {
    const m = mine();
    const active = m
      .filter((q) => q.st < 4)
      .sort((a, b) => b.st - a.st || (a.p === 'HIGH' ? -1 : 1));
    const done = m.filter((q) => q.st === 4).length + 3;
    const total = active.length + done;
    const next = active[0];
    const kind = next ? W.kindOf(next.cat, next.st) : null;
    return html`<div class="cols c1 xl-side" style="--sw:360px">
      <div class="col g4">
        <div class="cols gs c2 sm-c4">
          ${[
            ['Өнөөдөр', total, '#5FB4F0'],
            ['Яаралтай', active.filter((q) => q.p === 'HIGH').length, '#E0525A'],
            ['Дууссан', done, '#2EAE68'],
            ['Хүлээгдэж', active.filter((q) => q.st === 3).length, '#F0B03E'],
          ].map(
            ([l, n, c]) =>
              html`<div class="card p4">
                <b class="num t24 flex ic g2"
                  ><i class="dot" style="${'background:' + c}"></i>${n}</b
                ><span class="muted t12 b">${l}</span>
              </div>`,
          )}
        </div>
        ${next
          ? html`<a
              href="#/tasks"
              data-act="open"
              data-arg="${next.id}"
              class="card pad-l col g3 now-card"
            >
              <div class="flex jb">
                <span class="th accc">Одоо хийх</span
                ><span
                  class="${'chip ' +
                  (next.p === 'HIGH' ? 'c-bad' : next.p === 'MED' ? 'c-warn' : 'c-mute')}"
                  >Priority: ${next.p}</span
                >
              </div>
              <span class="num faint t12 b">#${next.id} · ${next.cat}</span
              ><b class="t24 tight">${next.title}</b
              ><span class="muted t14">${next.b}-р байр · ${next.u} тоот</span>
              ${kind ? W.workerScene(kind, 'max-xl') : ''}${kind ? workNote(kind) : ''}
              <span class="btn p self-start mt1"
                >${next.st === 1 ? 'Ажил эхлүүлэх' : 'Үргэлжлүүлэх'} ${ic('arrow-right', 16)}</span
              ></a
            >`
          : html`<div class="card empty">Одоогоор хийх ажил алга 🎉</div>`}
        <div class="flex jb ic">
          <b>Миний даалгавар</b><a href="#/tasks" class="link">Бүгд →</a>
        </div>
        ${active.slice(1, 5).map(
          (q) =>
            html`<a
              href="#/tasks"
              data-act="open"
              data-arg="${q.id}"
              class="card p4 flex ic g3"
              data-key="${q.id}"
              >${prio(q.p)}
              <div class="grow">
                <b class="block trunc t14">${q.title}</b
                ><span class="muted t12 num">#${q.id} · ${q.b}-р байр</span>
              </div>
              <span class="chip c-acc">${REQ_STATUS[q.st]}</span></a
            >`,
        )}
      </div>
      <aside class="col g4">
        <section class="card p4 flex ic g4">
          ${W.ring(done / Math.max(1, total))}
          <div>
            <b class="t18">${Math.round((done / Math.max(1, total)) * 100)}% дууссан</b>
            <p class="muted t13">Өнөөдөр хийх ажил: ${total}</p>
          </div>
        </section>
        <section class="card p4 col g1">
          <span class="th mb1">Засвар үйлчилгээний хуваарь</span>
          <div class="list">
            ${[
              ['10:30', 'Лифт #02 хөдөлгүүрийн засвар', '1-р байр'],
              ['14:00', 'Лифт #01 сарын үзлэг', '5-р байр'],
              ['16:30', 'Яаралтай дуудлагын туршилт', '4-р байр'],
            ].map(
              ([t, l, b]) =>
                html`<div class="flex ic g3 py2 t13">
                  <b class="num" style="width:44px">${t}</b><span class="grow">${l}</span
                  ><span class="chip c-mute">${b}</span>
                </div>`,
            )}
          </div>
        </section>
      </aside>
    </div>`;
  }

  const STEPS = ['Хүлээн авсан', 'Эхэлсэн', 'Хүлээгдэж', 'Шийдэгдсэн'];
  function tasks() {
    const m = mine();
    const f = ui.filter;
    const list = m.filter((q) =>
      f === 'all'
        ? q.st < 4
        : f === 'urgent'
          ? q.p === 'HIGH' && q.st < 4
          : f === 'wait'
            ? q.st === 3
            : q.st === 4,
    );
    const t = m.find((q) => q.id === ui.open);
    const kind = t ? W.kindOf(t.cat, t.st) : null;
    const step = t ? (t.st === 4 ? 3 : t.st === 3 ? 2 : t.st === 2 ? 1 : 0) : 0;
    return html`<div class="cols c1 lg-left">
      <div class="${cx('col g2', t && 'lg-up-hide')}">
        ${seg(
          [
            ['all', 'Бүгд'],
            ['urgent', 'Яаралтай'],
            ['wait', 'Хүлээгдэж'],
            ['done', 'Дууссан'],
          ],
          f,
          'filter',
        )}
        ${list.map(
          (q) =>
            html`<button
              class="${cx('card p4 col g1', ui.open === q.id && 'sel')}"
              data-act="open"
              data-arg="${q.id}"
              data-key="${q.id}"
            >
              <div class="flex jb"><span class="num faint t12 b">#${q.id}</span>${prio(q.p)}</div>
              <b class="t14">${q.title}</b>
              <div class="flex jb ic t12 muted">
                <span>${q.b}-р байр · ${q.u} тоот</span
                ><span class="chip c-acc">${REQ_STATUS[q.st]}</span>
              </div>
            </button>`,
        )}
        ${list.length ? '' : html`<p class="muted p4">Даалгавар алга</p>`}
      </div>
      ${t
        ? html`<section class="card pad-l col g4 rel ovh">
            <div class="flex jb is">
              <div>
                <span class="num faint t12 b">#${t.id} · ${t.cat}</span>
                <h2 class="t20 b">${t.title}</h2>
                <p class="muted t13">${t.b}-р байр · ${t.u} тоот</p>
              </div>
              <button class="btn s sq lg-down" data-act="open" data-arg="" aria-label="Хаах">
                ${ic('x', 16)}
              </button>
            </div>
            <div class="flex g2">
              <span
                class="${'chip ' +
                (t.p === 'HIGH' ? 'c-bad' : t.p === 'MED' ? 'c-warn' : 'c-mute')}"
                >Priority: ${t.p}</span
              ><span class="chip c-acc">${REQ_STATUS[t.st]}</span>
            </div>
            <div class="card flat p3 t13">${t.desc}</div>
            ${kind ? html`${W.workerScene(kind, 'max-xl')}${workNote(kind, true)}` : ''}
            <div class="hsteps">
              ${STEPS.map(
                (l, i) =>
                  html`<div
                    class="${cx('hs', i <= step && 'done', i === step && t.st < 4 && 'cur')}"
                  >
                    <span class="hs-dot"></span><span class="t11 b">${l}</span>
                  </div>`,
              )}
            </div>
            <div class="col g2">
              <div class="flex jb ic">
                <span class="th">Зураг</span
                ><button class="btn s" data-act="photo" data-arg="${t.id}">
                  ${ic('camera', 15)}Зураг оруулах
                </button>
              </div>
              <div class="photos">
                ${t.photos
                  ? Array.from(
                      { length: t.photos },
                      () => html`<span class="photo">${ic('camera', 18)}</span>`,
                    )
                  : html`<span class="faint t12" style="margin:auto"
                      >Өмнө / дараах зураг оруулна уу</span
                    >`}
              </div>
            </div>
            ${t.st < 4
              ? html`<div class="flex wrap g2 bt pt3">
                  ${t.st === 1
                    ? html`<button class="btn p grow" data-act="status" data-arg="${t.id}:2">
                        Ажил эхлүүлэх
                      </button>`
                    : ''}
                  ${t.st >= 2
                    ? html`<button
                        class="btn"
                        data-act="status"
                        data-arg="${t.id + ':' + (t.st === 3 ? 2 : 3)}"
                      >
                        ${t.st === 3 ? 'Үргэлжлүүлэх' : 'Хүлээлгэх'}
                      </button>`
                    : ''}
                  ${t.st >= 2
                    ? html`<button
                        class="${cx('btn grow', t.photos ? 'okb' : 'dim')}"
                        data-act="resolve"
                        data-arg="${t.id}"
                      >
                        ${t.photos ? 'Шийдэгдсэн гэж батлах' : 'Зураг оруулаад батална'}
                      </button>`
                    : ''}
                </div>`
              : ''}
            ${ui.cele
              ? html`<div class="cele view-in">
                  <div class="center">
                    <span class="cele-ic bob">${ic('party', 36)}</span
                    ><b class="block t20 mt1">Ажил шийдэгдлээ!</b>
                    <p class="muted t14">
                      Удирдлага, оршин суугчдад мэдэгдэл шууд очиж, сарын тайланд бүртгэгдлээ
                    </p>
                  </div>
                </div>`
              : ''}
          </section>`
        : html`<div class="card empty lg-up">Жагсаалтаас сонгоод ажлаа удирдана</div>`}
    </div>`;
  }

  function pool() {
    const p = S.state.reqs.filter((q) => q.st === 0);
    const now = Date.now();
    return html`<div class="col g3 max-3">
      <p class="muted t13 flex ic g2">
        ${ic('users', 15)}Шинэ хүсэлт тухайн ангиллын бүх ажилтанд зэрэг очдог — эхэлж хүлээн авсан
        хүн хариуцна.
      </p>
      ${p.map(
        (q) =>
          html`<section
            class="${cx('card p4 col g2 view-in', q.p === 'HIGH' && 'hot')}"
            data-key="${q.id}"
          >
            <div class="flex wrap g2 ic">
              <span class="num faint t12 b">#${q.id}</span>${prio(q.p)}<span class="chip c-acc"
                >${q.cat}</span
              >${ME_STAFF.cats.includes(q.cat)
                ? html`<span class="chip c-ok">Таны ангилал</span>`
                : ''}<span class="ml-auto num faint t12">${ago(now - q.createdAt)} өмнө</span>
            </div>
            <b class="t15">${q.title}</b
            ><span class="muted t13">${q.b}-р байр · ${q.u} тоот · ${q.desc}</span>
            <button class="btn p self-start" data-act="take" data-arg="${q.id}">Хүлээн авах</button>
          </section>`,
      )}
      ${p.length
        ? ''
        : html`<div class="card empty">Шинэ хүсэлт алга — ирмэгц энд гарч, мэдэгдэл очно.</div>`}
    </div>`;
  }

  Shell.boot({
    role: 'staff',
    brand: 'СӨХ Staff',
    sub: D.LAYOUT.n,
    mobile: 'bottom',
    profile: () =>
      html`<div class="side-profile">
        <span class="avatar">НА<i class="on"></i></span>
        <div>
          <b class="t14">${ME_STAFF.n}</b
          ><span class="block t12 side-mu">${ME_STAFF.role} · ээлжинд</span>
        </div>
      </div>`,
    nav: () => {
      const s = S.state;
      return [
        { h: '', label: 'Өнөөдөр', icon: 'home' },
        {
          h: 'tasks',
          label: 'Даалгавар',
          icon: 'list',
          badge: mine().filter((q) => q.st < 4).length,
        },
        {
          h: 'pool',
          label: 'Хүсэлт',
          icon: 'inbox',
          badge: s.reqs.filter((q) => q.st === 0).length,
        },
        {
          h: 'notifications',
          label: 'Мэдэгдэл',
          icon: 'bell',
          badge: s.notifs.staff.filter((n) => n.unread).length,
        },
      ];
    },
    routes: {
      '': { title: 'Өнөөдөр', topics: ['reqs'], view: today },
      tasks: { title: 'Миний даалгавар', topics: ['reqs'], view: tasks },
      pool: { title: 'Шинэ хүсэлтүүд', topics: ['reqs', 'tick'], view: pool },
    },
    actions: {
      open: (id) => {
        set({ open: id || null });
        if (id && Nar.router.path !== 'tasks') Nar.router.go('tasks');
      },
      filter: (f) => set({ filter: f }),
      photo: (id) => {
        S.addPhoto(id);
        S.toast('Зураг нэмэгдлээ', 'Өмнө / дараах зураг', 'acc');
      },
      status: (a) => {
        const [id, k] = a.split(':');
        S.setReqStatus(id, Number(k));
      },
      resolve: (id) => {
        const t = mine().find((q) => q.id === id);
        if (!t) return;
        if (!t.photos)
          return S.toast(
            'Зураг оруулна уу',
            'Шийдсэн ажлынхаа зургийг оруулсны дараа батална',
            'warn',
          );
        S.setReqStatus(id, 4, ME_STAFF.n);
        set({ cele: true });
        setTimeout(() => set({ cele: false }), 2600);
      },
      take: (id) => {
        S.takeRequest(id, ME_STAFF.n);
        S.toast('Хүсэлтийг хүлээн авлаа', '#' + id + ' · та хариуцна', 'acc');
        ui.open = id;
        Nar.router.go('tasks');
      },
    },
  });
})();
