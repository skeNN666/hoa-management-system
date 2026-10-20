/* СӨХ Platform — Оршин суугч (resident.html) */
(function () {
  const { html, cx } = Nar;
  const { ic, seg } = Shell;
  const { ME, REQ_STATUS } = D;
  const ROOMS = ['Угаалгын өрөө', 'Гал тогоо', 'Бойлер'];
  const ui = { guide: 'hello', mini: true, gk: 0, repM: D.CUR_MONTH };
  const set = (p) => {
    Object.assign(ui, p);
    Shell.refresh(['ui']);
  };
  const st = () => S.state;

  /* ------------------------------ Нүүр ------------------------------ */
  function home() {
    const s = st();
    const mine = s.reqs.filter((q) => q.b === ME.b && q.u === ME.n);
    const cur =
      mine.find((q) => q.st < 4) || mine.find((q) => q.st === 4 && Date.now() - q.stAt < 45000);
    const kind = cur ? W.kindOf(cur.cat, cur.st) : null;
    const pslots = s.slots.filter((x) => x.zone === 'p');
    const free = pslots.filter((x) => x.st === 0).length;
    const myLeak = s.leaks.find((x) => x.b === ME.b && x.u === ME.n && x.st !== 'fixed');
    const life = Math.round((1 - (s.paid ? 0 : s.wilt)) * 100);
    const park = s.park;
    const curMsg = cur
      ? [
          `Хүсэлт СӨХ-д илгээгдлээ, хүлээн авахыг хүлээж байна`,
          `${cur.by} хүлээн авч, танай байр руу явж байна`,
          `${cur.by} засвар хийж байна`,
          'Материал хүлээж байна',
          `${cur.by} шийдвэрлэв · зурагтай`,
        ][cur.st]
      : '';
    return html`<div class="cols c1 xl-side" style="--sw:380px">
      <div class="col g4">
        <section class="card pad-l col g3">
          <div class="flex ie g3">
            <div class="grow col g2 self-center">
              <span class="muted t13 b">Таны төлөх дүн · 10-р сар</span>
              <span class="${'chip self-start ' + (s.paid ? 'c-ok' : 'c-bad')}"
                ><span class="${cx('dot', s.paid ? 'ok' : 'bad pulse2')}"></span>${s.paid
                  ? 'Төлөгдсөн'
                  : 'Төлөгдөөгүй'}</span
              >
              <b class="${cx('num t40 tight', s.paid && 'okc')}">₮97,000</b
              ><span class="muted t13"
                >${s.paid
                  ? 'Баярлалаа! eBarimt имэйлээр очсон.'
                  : 'Төлөх хугацаа: 10/10 · 5 хоног үлдсэн'}</span
              >
            </div>
            ${W.flower(s.wilt, s.paid, 130)}
          </div>
          <div class="flex ic g3">
            <span class="t12 b muted nowrap">Цэцгийн амь</span>
            <div class="bar grow">
              <i
                class="${life > 60 ? 'okbg' : life > 30 ? 'warnbg' : 'badbg'}"
                style="${'width:' + life + '%'}"
              ></i>
            </div>
            <b class="num t12 right" style="width:36px">${life}%</b>
          </div>
          ${s.paid
            ? ''
            : html`<p class="t13 semi muted">
                  Төлбөрөө төлөөгүй хугацаанд цэцэг тань аажмаар хатна
                </p>
                <button class="btn p lg shine" data-act="pay">
                  Төлөх ${ic('arrow-right', 16)}
                </button>`}
        </section>
        ${fundCard(s)}
        <div class="cols c1 md-c2">
          <a href="#/parking" class="card p4 col g3"
            ><div class="flex jb">
              <span class="th">Зогсоол · шууд</span><span class="link">3D зураг →</span>
            </div>
            <div class="flex ic g3">
              <span class="${cx('free-box', free ? 'ok' : 'bad')}"
                ><b class="num t24">${free}</b><span class="t11 b">сул</span></span
              >
              <div class="mini-lot grow">
                ${pslots.map(
                  (x) =>
                    html`<i
                      class="${x.mine
                        ? 'accbg'
                        : x.st === 0
                          ? 'okbg'
                          : x.st === 2
                            ? 'warnbg'
                            : 'occ'}"
                    ></i>`,
                )}
              </div>
            </div>
            <b class="t14"
              >${park.stage === 'parked'
                ? park.slot + '-д зогссон'
                : park.stage === 'reserved'
                  ? park.slot + ' танд хадгалагдаж байна'
                  : free
                    ? free + ' сул зогсоол байна'
                    : 'Сул зогсоол алга'}</b
            ></a
          >
          <section class="${cx('card p4 col g3', myLeak && myLeak.st === 'active' && 'hot')}">
            <div class="flex jb ic">
              <span class="flex ic g2 b t14"
                ><span class="chip icon s c-acc">${ic('droplet', 15)}</span>Ус мэдрэгч чип</span
              >
              <span
                class="${'chip ' +
                (myLeak ? (myLeak.st === 'active' ? 'c-bad' : 'c-warn') : 'c-ok')}"
                >${myLeak
                  ? myLeak.st === 'active'
                    ? 'Ус алдаж байна'
                    : myLeak.st === 'closed'
                      ? 'Хавхлага хаалттай'
                      : 'Засварлаж байна'
                  : 'Хэвийн'}</span
              >
            </div>
            <div class="cols gs c3">
              ${ROOMS.map((r) => {
                const wet = myLeak && myLeak.room === r;
                const a = wet && myLeak.st === 'active';
                return html`<div class="${cx('room', wet && (a ? 'wet-a' : 'wet'))}">
                  ${r}${wet ? html`<span class="room-water pulse2"></span>` : ''}<i
                    class="${cx('room-dot', wet ? (a ? 'badbg ping-dot' : 'warnbg') : 'okbg')}"
                  ></i>
                </div>`;
              })}
            </div>
            <div class="flex jb ic g2">
              <span class="muted t12">Ус мэдэрмэгц 1 секундэд мэдэгдэж, хавхлагыг хаана</span
              ><button class="txt-btn" data-act="demoLeak">Демо</button>
            </div>
          </section>
        </div>
        <div class="card p3 cols gs c4 quick">
          ${[
            ['Төлөх', 'card', 'pay'],
            ['Хүсэлт', 'plus', 'req'],
            ['Зогсоол', 'car', 'go:parking'],
            ['Нэхэмжлэл', 'file', 'go:pay'],
          ].map(
            ([l, i, a]) =>
              html`<button
                class="col ic g1 p2"
                data-act="${a.startsWith('go:') ? 'go' : a}"
                data-arg="${a.slice(3)}"
              >
                <span class="q-ic">${ic(i, 21)}</span><span class="t11 b">${l}</span>
              </button>`,
          )}
        </div>
      </div>
      <aside class="col g4">
        ${cur
          ? html`<section class="card p4 col g3">
              <div class="flex jb ic">
                <span class="th">Миний хүсэлт · шууд</span
                ><span
                  class="${'chip ' + (cur.st === 4 ? 'c-ok' : cur.st === 2 ? 'c-warn' : 'c-acc')}"
                  >${REQ_STATUS[cur.st]}</span
                >
              </div>
              <b>#${cur.id} ${cur.title}</b>
              ${kind
                ? W.workerScene(kind)
                : html`<div class="wscene ph">
                    ${cur.st === 4
                      ? html`<b class="okc t18">✓ Шийдэгдлээ</b>`
                      : html`<span class="bob accc">${ic('wrench', 26)}</span>`}
                  </div>`}
              <span class="t13 b">${curMsg}</span>
              <div class="track">
                ${[0, 1, 2, 4].map(
                  (k, i) =>
                    html`<span class="${cx('tr-dot', cur.st >= k && 'on')}"></span>${i < 3
                        ? html`<span class="${cx('tr-line', cur.st > k && 'on')}"></span>`
                        : ''}`,
                )}
              </div>
              <div class="flex jb t10 b muted">
                <span>Илгээсэн</span><span>Хүлээн авсан</span><span>Хийгдэж байна</span
                ><span>Шийдэгдсэн</span>
              </div>
            </section>`
          : html`<section class="card p4 col g1">
              <div class="flex jb ic mb1">
                <span class="th">Мэдэгдэл</span><a href="#/notifications" class="link">Бүгд →</a>
              </div>
              <div class="list">
                ${s.notifs.resident
                  .slice(0, 4)
                  .map(
                    (n) =>
                      html`<div class="py2" data-key="${'n' + n.id}">
                        <b class="t13 block">${n.t}</b><span class="muted t12">${n.s}</span>
                      </div>`,
                  )}
              </div>
            </section>`}
        <button class="btn p" data-act="req">${ic('plus', 17)}Хүсэлт гаргах</button>
      </aside>
    </div>`;
  }

  function payPage() {
    const s = st();
    const hist = (s.paid ? [['10/19', 'СӨХ · QPay', 97000]] : []).concat([
      ['09/05', 'СӨХ · QPay', 82000],
      ['08/04', 'СӨХ · Хаан банк', 80000],
      ['07/03', 'СӨХ · SocialPay', 80000],
    ]);
    return html`<div class="cols c1 lg-c2 max-5">
      <section class="card p5 col g3 ic center">
        ${W.flower(s.wilt, s.paid, 150)}<span class="muted t14"
          >10-р сарын нэхэмжлэл · INV-2026-1024</span
        ><b class="${cx('num t40', s.paid && 'okc')}">₮97,000</b>
        ${s.paid
          ? html`<span class="chip lg c-ok">${ic('ok', 15)}Төлөгдсөн · баярлалаа!</span>`
          : html`<button class="btn p lg w100 shine" data-act="pay">Одоо төлөх</button>`}
        <div class="w100 col g2 t13 bt pt3" style="text-align:left">
          ${[
            ['СӨХ-ийн хураамж', 50000],
            ['Лифт', 10000],
            ['Дундын цахилгаан', 5000],
            ['Ус', 12000],
            ['Өмнөх өр', 20000],
          ].map(
            ([l, v]) =>
              html`<div class="flex jb"><span>${l}</span><b class="num">${D.money(v)}</b></div>`,
          )}
        </div>
      </section>
      <section class="card p5 col g3">
        <div class="flex jb ic">
          <h2 class="h2">Таны ₮97,000 юунд зарцуулагдах вэ</h2>
          <a href="#/report" class="link t12">Тайлан →</a>
        </div>
        <p class="muted t12">Энэ сарын нийтлэгдсэн зарлагын бүтцээр тооцов (ойролцоогоор).</p>
        ${Report.billShare(
          ME.bill,
          s.ledger.filter((x) => x.month === D.CUR_MONTH),
        )}
      </section>
      <section class="card p5 col g1">
        <h2 class="h2 mb2">Төлбөрийн түүх</h2>
        <div class="list">
          ${hist.map(
            ([d, t, a]) =>
              html`<div class="flex ic g3 py2 t13" data-key="${d}">
                <span class="chip icon s round c-ok">${ic('ok', 15)}</span
                ><span class="grow"
                  ><b class="block">${t}</b><span class="muted num t12">${d}</span></span
                ><b class="num">${D.money(a)}</b>
              </div>`,
          )}
        </div>
      </section>
    </div>`;
  }

  /* ------------------------------ Хотхоны сан · ил тод тайлан ------------------------------ */
  // нүүр хуудсан дээрх сангийн сав — төлбөрөө төлөхийг урамшуулна
  function fundCard(s) {
    const f = S.fund();
    const pct = Math.round(f.cover * 100);
    return html`<section
      class="${cx('card p4 flex ic g4 fund-home', !s.paid && f.short && 'nudge')}"
    >
      ${W.fundJar(f.cover, s.paid, 96)}
      <div class="grow col g2">
        <span class="th">Хотхоны сан · ${Report.mLabel(D.CUR_MONTH)}</span>
        <b class="t18"
          >${f.short ? 'Сан ' + Report.M(f.short) + ' дутуу байна' : 'Сан хүрэлцээтэй байна'}</b
        >
        <p class="muted t13">
          ${s.paid
            ? 'Таны ₮97,000 сан руу орсон. Хотхоноо хамтдаа авч явж байгаад баярлалаа!'
            : 'Таны ₮97,000 лифтний засвар, өвлийн дулааны бэлтгэлд шууд зарцуулагдана. Зарлага бүр тайланд нийтлэгддэг.'}
        </p>
        <div class="flex ic g2">
          <div class="bar grow">
            <i
              class="${pct >= 100 ? 'okbg' : pct >= 80 ? 'warnbg' : 'badbg'}"
              style="${'width:' + pct + '%'}"
            ></i>
          </div>
          <b class="num t12">${pct}%</b>
        </div>
        <div class="flex wrap g2">
          ${s.paid
            ? ''
            : html`<button class="btn s p shine" data-act="pay">
                ${ic('coins', 15)}Хувь нэмрээ оруулах
              </button>`}
          <a href="#/report" class="btn s">${ic('chart', 15)}Юунд зарцуулсныг харах</a>
        </div>
      </div>
    </section>`;
  }

  function reportPage() {
    const s = st();
    const f = S.fund();
    const m = ui.repM;
    const L = s.ledger.filter((x) => x.month === m);
    const Wk = s.works.filter((x) => x.month === m);
    const pub = s.reportPub[m];
    return html`<div class="col g4">
      <section class="${cx('card pad flex wrap ic g4', !s.paid && f.short && 'nudge')}">
        ${W.fundJar(f.cover, s.paid, 84)}
        <div class="grow col g2" style="min-width:220px">
          <h2 class="h2">СӨХ-ийн мөнгө юунд зарцуулагдаж байна вэ</h2>
          <p class="muted t13">
            СӨХ орлого, зарлага, хийсэн ажил бүрээ энд нийтэлдэг. Ажилтан ажлаа дуусгамагц танд
            мэдэгдэл очиж, энд нэмэгдэнэ.
          </p>
          ${s.paid
            ? html`<span class="chip c-ok self-start"
                >${ic('ok', 13)}Та энэ сарын төлбөрөө төлсөн</span
              >`
            : html`<button class="btn p self-start shine" data-act="pay">
                ${ic('coins', 16)}₮97,000 төлж сан руу нэмэх
              </button>`}
        </div>
      </section>
      ${Report.fundStats(f)}
      <div class="flex wrap g2 jb ic">
        ${seg(D.MONTHS, m, 'repM')}
        ${pub
          ? html`<span class="chip c-ok">${ic('ok', 13)}Тайлан нийтлэгдсэн · ${pub}</span>`
          : html`<span class="chip c-acc">Сар дуусаагүй · шууд шинэчлэгдэж байна</span>`}
      </div>
      <div class="cols c1 xl-split2">
        <section class="card pad col g3">
          <div class="flex jb ic">
            <h2 class="h2">Зарлага</h2>
            <b class="num badc">−${D.money(Report.sum(L))}</b>
          </div>
          ${L.length ? Report.catBars(L) : ''} ${Report.ledgerRows(L)}
        </section>
        <section class="card pad col g3">
          <div class="flex jb ic">
            <h2 class="h2">Хийсэн ажил</h2>
            <span class="chip c-acc num">${Wk.length} ажил</span>
          </div>
          ${Report.workRows(Wk)}
        </section>
      </div>
      <section class="card pad col g3">
        <div class="flex wrap jb ic g2">
          <h2 class="h2">Төлбөрийн гүйцэтгэл · байраар</h2>
          <span class="muted t12">★ — таны байр</span>
        </div>
        ${Report.bldRates(S.units, ME.b)}
      </section>
    </div>`;
  }

  let lot = null;
  function parkPage() {
    const s = st();
    const p = s.park;
    const free = s.slots.filter((x) => x.zone === 'p' && x.st === 0).length;
    const mm = Math.floor(p.hold / 60),
      ss = String(p.hold % 60).padStart(2, '0');
    let side = '';
    if (p.stage === 'idle')
      side = free
        ? html`<span class="chip icon xl c-ok t20 b9">P</span
            ><b class="t18">${free} сул зогсоол байна</b>
            <p class="muted t13">3D зураг дээрх ногоон зогсоол дээр дарж захиална.</p>`
        : html`<b class="t18">Сул зогсоол алга</b>
            <p class="muted t13">Хэн нэгэн гармагц танд түрүүлж мэдэгдэнэ.</p>
            <button class="btn p w100" data-act="parkNotify">
              ${ic('bell', 17)}Зогсоол гарвал мэдэгдэх
            </button>`;
    if (p.stage === 'waiting')
      side = html`<span class="big-ic accbg pulse2">${ic('bell', 26)}</span
        ><b class="t18">Сул зогсоол хүлээж байна…</b
        ><span class="chip c-acc">Дараалалд ${p.pos}-рт</span
        ><button class="btn s" data-act="parkCancel">Дараалалаас гарах</button>`;
    if (p.stage === 'found')
      side = html`<b class="t18">${p.slot} сул боллоо!</b>
        <p class="muted t13">Таныг дараалалд 1-рт байсан тул эхэлж санал болгож байна.</p>
        <div class="flex g2 w100">
          <button class="btn grow" data-act="parkCancel">Татгалзах</button
          ><button class="btn p grow" style="flex:2" data-act="reserve" data-arg="${p.slot}">
            Захиалах
          </button>
        </div>`;
    if (p.stage === 'reserved')
      side = html`<span class="big-ic sq resbg t18 b9">${p.slot}</span
        ><b class="t18">Таны нэр дээр захиалагдсан</b
        ><span class="chip c-acc num">${ic('timer', 14)}${mm}:${ss} хадгална</span>
        <p class="muted t13">Мэдрэгч машин ирэхийг өөрөө бүртгэнэ — та юу ч дарах шаардлагагүй.</p>
        <button class="txt-btn" data-act="parkArrive">Демо: машиныг зогсоолд оруулах</button
        ><button class="btn s" data-act="parkCancel">Захиалга цуцлах</button>`;
    if (p.stage === 'parked')
      side = html`<span class="big-ic okbg">${ic('ok', 32)}</span
        ><b class="t18">${p.slot}-д зогссон</b>
        <p class="muted t13">${ME.plate} · мэдрэгчээр автоматаар бүртгэгдсэн</p>
        <button class="txt-btn" data-act="parkLeave">Демо: машин гарах</button>`;
    return html`<div class="cols c1 xl-side">
      <section class="card p0 ovh park-box o2 xl-o1">
        ${Nar.keep('lot3d', 'fill')}
        <div class="map-title">
          <b class="t18 b9">Гадна зогсоол · P01–P48</b>
          <p class="t12 b" style="color:#7A7365">Ногоон P — сул. Дарж 10 минут захиална.</p>
        </div>
      </section>
      <section class="card p5 col g3 ic center o1 xl-o2">${side}</section>
    </div>`;
  }
  function parkAfter() {
    if (!lot)
      lot = Scenes.parking(Nar.host('lot3d'), {
        zone: 'p',
        onPick: (sl) => {
          if (sl.st === 0 && st().park.stage === 'idle') S.reserveSlot(sl.id);
        },
      });
    lot.update({ slots: st().slots, selected: st().park.slot });
  }

  function profile() {
    const s = st();
    const hist = s.reqs.filter((q) => q.b === ME.b && q.u === ME.n);
    return html`<div class="cols c1 lg-c2 max-5">
      <section class="card p5 col g3">
        <div class="flex ic g3">
          <span class="avatar t20" style="width:56px;height:56px">Б</span>
          <div>
            <b class="t18">Бат</b>
            <p class="muted t14 num">5-р байр · 34 тоот · 72.4 м²</p>
          </div>
        </div>
        ${[
          ['Утас', '9911 2233'],
          ['Оршин суугч', '4 хүн'],
          ['Автомашин', ME.plate + ' · Toyota Prius'],
        ].map(
          ([k, v]) =>
            html`<div class="flex jb t13 bt pt2"><span class="muted">${k}</span><b>${v}</b></div>`,
        )}
        <div class="flex ic g3 bt pt3">
          <div class="grow">
            <span class="th">Харагдац</span
            ><b class="block t14">${s.theme === 'dark' ? 'Харанхуй горим' : 'Гэрэлтэй горим'}</b>
          </div>
          ${Shell.themeBtn('alt')}
        </div>
        <button class="txt-btn self-start" data-act="reset">
          Демо өгөгдлийг анхны байдалд оруулах
        </button>
      </section>
      <section class="card p5 col g1">
        <h2 class="h2 mb2">Хүсэлтийн түүх</h2>
        <div class="list">
          ${hist.map(
            (q) =>
              html`<div class="flex ic g3 py2 t13" data-key="${q.id}">
                <span class="${'chip icon s round ' + (q.st === 4 ? 'c-ok' : 'c-acc')}"
                  >${ic('ok', 15)}</span
                ><span class="grow"
                  ><b class="block">#${q.id} ${q.title}</b
                  ><span class="muted t12">${q.by || '—'}</span></span
                ><span class="chip c-mute">${REQ_STATUS[q.st]}</span>
              </div>`,
          )}
        </div>
      </section>
    </div>`;
  }

  /* ------------------------------ Төлбөр / хүсэлтийн sheet ------------------------------ */
  const CH = [
    ['QPay', '#E2382A'],
    ['SocialPay', '#1F8AE5'],
    ['Хаан банк', '#0E7A4A'],
    ['Голомт банк', '#2B4C9B'],
  ];
  const pay = { ch: 0, stage: 'choose', p: 0 };
  function paySheet() {
    if (pay.stage === 'process')
      return html`<div class="col ic g4 py2" style="padding:24px 0">
        <b>${CH[pay.ch][0]}-д холбогдож байна…</b>
        <div class="bar w100" style="height:12px"><i style="${'width:' + pay.p + '%'}"></i></div>
      </div>`;
    if (pay.stage === 'done')
      return html`<div class="col ic g3 center">
        <span class="big-ic okbg bob" style="width:80px;height:80px">${ic('ok', 40)}</span
        ><b class="t20">Төлбөр амжилттай!</b>
        <p class="muted t14">₮97,000 · eBarimt имэйлээр очлоо. Цэцэг тань дахин цэцэглэлээ.</p>
        <button class="btn p w100" data-act="__close">Болсон</button>
      </div>`;
    return html`<div class="flex jb ic">
        <h2 class="t20 b">Төлбөр төлөх</h2>
        <button data-act="__close" aria-label="Хаах">${ic('x', 22)}</button>
      </div>
      <div class="card p4 flex jb ib">
        <span class="muted t14">10-р сарын СӨХ төлбөр</span><b class="num t24">₮97,000</b>
      </div>
      <div class="cols gs c2">
        ${CH.map(
          ([l, c], i) =>
            html`<button
              class="${cx('card p3 flex ic g2', pay.ch === i && 'sel')}"
              data-act="payCh"
              data-arg="${i}"
            >
              <span class="bank" style="${'background:' + c}">${l.slice(0, 2)}</span
              ><b class="t13">${l}</b>
            </button>`,
        )}
      </div>
      <button class="btn p lg" data-act="payGo">${CH[pay.ch][0]}-аар төлөх</button>`;
  }
  function openPay() {
    Object.assign(pay, { stage: 'choose', p: 0 });
    Nar.modal.open(paySheet, {
      lock: () => pay.stage === 'process',
      onClose: () => {
        if (pay.stage === 'done' && ui.guide === 'pay') set({ guide: 'thanks', mini: false });
      },
    });
  }

  const req = { cat: 'Лифт', title: '', p: 'MED', desc: '', photo: false };
  function reqSheet() {
    return html`<div class="flex jb ic">
        <h2 class="t20 b">Хүсэлт илгээх</h2>
        <button data-act="__close" aria-label="Хаах">${ic('x', 22)}</button>
      </div>
      <div class="flex wrap g1">
        ${['Лифт', 'Сантехник', 'Цахилгаан', 'Дулаан', 'Ариун цэвэр', 'Бусад'].map(
          (c) =>
            html`<button
              class="${cx('pill', req.cat === c && 'on')}"
              data-act="reqCat"
              data-arg="${c}"
            >
              ${c}
            </button>`,
        )}
      </div>
      <label class="field"
        >Гарчиг<input
          class="inp"
          data-in="reqTitle"
          value="${req.title}"
          placeholder="Жишээ: Лифт ажиллахгүй байна"
      /></label>
      <label class="field"
        >Дэлгэрэнгүй<textarea class="inp" data-in="reqDesc">${req.desc}</textarea>
      </label>
      ${seg(
        [
          ['LOW', 'Бага'],
          ['MED', 'Дунд'],
          ['HIGH', 'Яаралтай'],
        ],
        req.p,
        'reqP',
      )}
      <button class="${cx('btn', req.photo && 'c-ok')}" data-act="reqPhoto">
        ${ic('camera', 16)}${req.photo ? 'Зураг хавсаргасан ✓' : 'Зураг хавсаргах'}
      </button>
      <button class="btn p lg" data-act="reqSend" ${req.title.trim() ? '' : Nar.raw('disabled')}>
        Илгээх
      </button>`;
  }
  function openReq(cat = 'Лифт', title = '') {
    Object.assign(req, { cat, title, p: 'MED', desc: '', photo: false });
    Nar.modal.open(reqSheet);
  }

  /* ------------------------------ Хөтөч "Сараа" ------------------------------ */
  const CATS = [
    ['Лифт', 'Лифт ажиллахгүй байна'],
    ['Сантехник', 'Ус гоожиж байна'],
    ['Цахилгаан', 'Гэрэл, цахилгаан тасарсан'],
    ['Дулаан', 'Халаалт хүйтэн байна'],
    ['Бусад', 'Бусад асуудал'],
  ];
  function guideSteps() {
    const paid = st().paid;
    return {
      hello: {
        msg: paid
          ? 'Сайн байна уу, Бат! Энэ сарын төлбөр тань төлөгдсөн байна. Өөр юугаар туслах вэ?'
          : 'Сайн байна уу, Бат! Би Сараа — таны СӨХ хөтөч. Танд ₮97,000 төлбөр байна. Одоо төлөх үү, эсвэл ямар нэг асуудал байна уу?',
        opts: (paid ? [] : [['Төлбөр төлөх', 'g:pay', 1]]).concat([
          ['Асуудал мэдэгдэх', 'g:issue'],
          ['Зогсоол хайх', 'g:park'],
          ['Дараа', 'g:mini', 0, 1],
        ]),
      },
      pay: {
        msg: 'Энэ бол таны төлбөрийн хэсэг. ₮97,000-ийг QPay, SocialPay эсвэл банкны аппаар нэг товшилтоор төлнө. Төлмөгц цэцэг тань дахин цэцэглэнэ.',
        opts: [
          ['Төлөх →', 'g:payNow', 1],
          ['Буцах', 'g:hello', 0, 1],
        ],
      },
      thanks: {
        msg: 'Баярлалаа! Төлбөр амжилттай төлөгдлөө. eBarimt имэйлээр очсон, цэцэг тань дахин цэцэглэлээ.',
        opts: [['Нүүр хуудас', 'g:home', 1]],
      },
      issue: {
        msg: 'Ямар асуудал гарсан бэ? Төрлөө сонговол хүсэлтийн маягтыг би бөглөөд өгье.',
        opts: CATS.map(([c], i) => [c, 'g:cat' + i]).concat([['Буцах', 'g:hello', 0, 1]]),
      },
      sent: {
        msg: 'Хүсэлт тань илгээгдлээ! Ажилтан хүлээн авмагц, засвар эхлэх, дуусах бүрт танд мэдэгдэл очно.',
        opts: [['Ойлголоо', 'g:done', 1]],
      },
      park: {
        msg: 'Ногоон "P" тэмдэгтэй зогсоол сул байна. Дээр нь дарвал 10 минут танд хадгална. Хулганаар чирж 3D зургийг эргүүлж болно.',
        opts: [
          ['Ойлголоо', 'g:mini', 1],
          ['Буцах', 'g:back', 0, 1],
        ],
      },
    };
  }
  function guide() {
    if (ui.mini)
      return html`<button
        class="guide-mini view-in"
        data-act="guide"
        data-arg="g:open"
        aria-label="СӨХ хөтөч Сараа-г нээх"
      >
        ${W.avatar(50)}<span class="guide-dot"></span>
      </button>`;
    const cur = guideSteps()[ui.guide];
    return html`<div class="guide view-in" role="dialog" aria-label="СӨХ хөтөч Сараа">
      <div class="bob no-shrink guide-av">${W.avatar()}</div>
      <div class="card guide-bubble col g2">
        <div class="flex ic g2">
          <b class="t13">Сараа</b><span class="muted t11 b">СӨХ хөтөч</span
          ><button class="ml-auto faint" data-act="guide" data-arg="g:mini" aria-label="Нуух">
            ${ic('x', 16)}
          </button>
        </div>
        <p class="t14 semi view-in" data-key="${'gm' + ui.gk}">${cur.msg}</p>
        <div class="flex wrap g1">
          ${cur.opts.map(
            ([l, a, p, q]) =>
              html`<button
                class="${cx('pill', p && 'on', q && 'ghost')}"
                data-act="guide"
                data-arg="${a}"
              >
                ${l}
              </button>`,
          )}
        </div>
      </div>
    </div>`;
  }
  const go = (g) => set({ guide: g, gk: ui.gk + 1 });
  function guideAct(a) {
    const k = a.slice(2);
    if (k === 'open') return set({ mini: false });
    if (k === 'mini') return set({ mini: true });
    if (k === 'pay') {
      Nar.router.go('pay');
      return go('pay');
    }
    if (k === 'payNow') {
      openPay();
      return set({ mini: true });
    }
    if (k === 'home') {
      Nar.router.go('');
      return set({ mini: true, guide: 'hello' });
    }
    if (k === 'park') {
      Nar.router.go('parking');
      return go('park');
    }
    if (k === 'back') {
      Nar.router.go('');
      return go('hello');
    }
    if (k === 'done') return set({ guide: 'hello', mini: true });
    if (k.startsWith('cat')) {
      const [c, t] = CATS[Number(k.slice(3))];
      openReq(c, t);
      return set({ guide: 'sent', mini: true, gk: ui.gk + 1 });
    }
    go(k);
  }
  setTimeout(() => set({ mini: false }), 900);

  Shell.boot({
    role: 'resident',
    brand: 'СӨХ Platform',
    sub: 'Нарны хотхон · 5-р байр 34 тоот',
    mobile: 'bottom',
    profile: () =>
      html`<div class="side-profile">
        <span class="avatar">Б</span>
        <div>
          <b class="t14">Бат</b><span class="block t12 side-mu num">5-р байр · 34 тоот</span>
        </div>
      </div>`,
    nav: () => {
      const s = st();
      return [
        { h: '', label: 'Нүүр', icon: 'home' },
        { h: 'pay', label: 'Төлбөр', icon: 'card', badge: s.paid ? 0 : 1 },
        { h: 'report', label: 'Тайлан', icon: 'chart' },
        { h: 'parking', label: 'Зогсоол', icon: 'car' },
        {
          h: 'notifications',
          label: 'Мэдэгдэл',
          icon: 'bell',
          badge: s.notifs.resident.filter((n) => n.unread).length,
          bn: false, // гар утсанд дээд мөрний хонхоор нээнэ
        },
        { h: 'profile', label: 'Профайл', icon: 'user' },
      ];
    },
    routes: {
      '': {
        title: 'Сайн байна уу, Бат',
        topics: ['pay', 'wilt', 'reqs', 'slots', 'park', 'leaks', 'notifs', 'fund', 'ledger'],
        view: home,
      },
      pay: { title: 'Төлбөр', topics: ['pay', 'wilt', 'ledger'], view: payPage },
      report: {
        title: 'Ил тод тайлан',
        topics: ['ledger', 'works', 'fund', 'pay', 'payments'],
        view: reportPage,
      },
      parking: { title: 'Зогсоол', topics: ['slots', 'park'], view: parkPage, after: parkAfter },
      profile: { title: 'Профайл', topics: ['reqs', 'theme'], view: profile },
    },
    extra: guide,
    extraTopics: ['ui', 'pay'],
    actions: {
      pay: openPay,
      req: () => openReq(),
      go: (h) => Nar.router.go(h),
      repM: (m) => set({ repM: m }),
      demoLeak: () => S.newLeak(ME.b, ME.n, ROOMS[0]),
      reserve: (id) => S.reserveSlot(id),
      parkNotify: () => S.parkNotify(),
      parkCancel: () => S.parkCancel(),
      parkArrive: () => S.parkArrive(),
      parkLeave: () => S.parkLeave(),
      reset: () => {
        S.reset();
        S.toast('Демо өгөгдөл шинэчлэгдлээ', 'Анхны байдалд орлоо', 'acc');
      },
      payCh: (i) => {
        pay.ch = Number(i);
        Nar.modal.refresh();
      },
      payGo: () => {
        pay.stage = 'process';
        pay.p = 0;
        Nar.modal.refresh();
        const t = setInterval(() => {
          pay.p += 5;
          if (pay.p >= 100) {
            clearInterval(t);
            pay.stage = 'done';
            S.pay();
          }
          Nar.modal.refresh();
        }, 70);
      },
      reqCat: (c) => {
        req.cat = c;
        Nar.modal.refresh();
      },
      reqP: (p) => {
        req.p = p;
        Nar.modal.refresh();
      },
      reqPhoto: () => {
        req.photo = true;
        Nar.modal.refresh();
      },
      reqSend: () => {
        if (!req.title.trim()) return;
        const id = S.newRequest({
          title: req.title,
          cat: req.cat,
          p: req.p,
          desc: req.desc || req.title,
        });
        S.toast('Хүсэлт илгээгдлээ', id + ' · ангиллын бүх ажилтанд очлоо', 'acc');
        Nar.modal.close(true);
      },
      guide: guideAct,
    },
    inputs: {
      reqTitle: (v) => {
        req.title = v;
        Nar.modal.refresh();
      },
      reqDesc: (v) => {
        req.desc = v;
      },
    },
  });
  // төлбөр амжилттай болмогц хөтөч "баярлалаа" гэж хэлнэ
  S.on((T) => {
    if (T.includes('pay') && st().paid && ui.guide === 'pay') set({ guide: 'thanks', mini: false });
  });
})();
