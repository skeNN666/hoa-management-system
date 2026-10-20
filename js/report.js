/*
 * СӨХ Platform — Ил тод тайлангийн нийтлэг хэсгүүд.
 * Удирдлага (admin.js), оршин суугч (resident.js) хоёулаа ашиглана:
 *   Report.fundStats(S.fund())  Report.ledgerRows(list)  Report.workRows(list)
 *   Report.catBars(list)  Report.bldRates(S.units, myBuilding)  Report.billShare(bill, list)
 */
(function () {
  const { html, cx, raw } = Nar;
  const ic = (n, s) => raw(Nar.icon(n, s));
  const { money, nf } = D;

  const mLabel = (m) => (D.MONTHS.find((x) => x[0] === m) || [0, m])[1];
  const sum = (L) => L.reduce((a, x) => a + x.amt, 0);
  const M = (n) => (n < 0 ? '−' : '') + '₮' + (Math.abs(n) / 1e6).toFixed(1) + 'M';
  const byCat = (L) =>
    D.EXP_CATS.map((c) => [c, sum(L.filter((x) => x.cat === c))])
      .filter((x) => x[1])
      .sort((a, b) => b[1] - a[1]);

  /** Сангийн 4 үзүүлэлт + хүрэлцээний хэмжүүр */
  function fundStats(f) {
    const pct = Math.round(f.cover * 100);
    const tone = f.short ? (f.cover >= 0.8 ? 'warn' : 'bad') : 'ok';
    return html`<div class="cols gs c2 lg-c4">
        ${[
          ['Сангийн үлдэгдэл', M(f.balance), 'Сарын эхэнд ' + M(f.opening), ''],
          ['Энэ сард орсон', M(f.collected), Math.round(f.rate * 100) + '% айл төлсөн', 'okc'],
          ['Зарцуулсан', M(f.spent), 'Нийтлэгдсэн зарлага', 'badc'],
          ['Төлөх үлдсэн зардал', M(f.due), 'Энэ сарын эцэс хүртэл', 'warnc'],
        ].map(
          ([l, v, sub, c]) =>
            html`<div class="card p4 col g1">
              <span class="muted t12 semi">${l}</span><b class="${'num t24 ' + c}">${v}</b
              ><span class="faint t12">${sub}</span>
            </div>`,
        )}
      </div>
      <div class="${'card p4 col g2 fund-meter ' + tone}">
        <div class="flex jb ic wrap g2">
          <b class="t14 flex ic g2"
            >${ic(f.short ? 'alert' : 'ok', 17)}${f.short
              ? 'Сан ' + money(f.short) + ' дутуу байна'
              : 'Сан хүрэлцээтэй байна'}</b
          ><span class="num t12 b">${pct}% хангагдсан</span>
        </div>
        <div class="fm-bar"><i style="${'width:' + pct + '%'}"></i></div>
        <span class="muted t12"
          >${f.short
            ? nf(f.debtors) + ' айлын ' + money(f.debt) + ' өр барагдвал сан бүрэн хүрэлцэнэ'
            : 'Энэ сарын бүх зардлыг санхүүжүүлэх боломжтой'}</span
        >
      </div>`;
  }

  /** Зарлагын бүтэц — нэг өнгөт зурвас + тайлбар */
  function catBars(L) {
    const total = sum(L) || 1;
    const by = byCat(L);
    return html`<div class="cat-bar">
        ${by.map(
          ([c, v], i) =>
            html`<i
              class="${'cb' + (i % 8)}"
              style="${'flex:' + v}"
              title="${c + ' · ' + money(v)}"
            ></i>`,
        )}
      </div>
      <div class="flex wrap g3 t12">
        ${by.map(
          ([c, v], i) =>
            html`<span class="flex ic g1"
              ><i class="${'lg-sq cb' + (i % 8)}"></i>${c}
              <b class="num">${Math.round((v / total) * 100)}%</b></span
            >`,
        )}
      </div>`;
  }

  /** Зарлагын жагсаалт */
  function ledgerRows(L) {
    if (!L.length) return html`<p class="empty">Энэ сард зарлага бүртгэгдээгүй</p>`;
    return html`<div class="list">
      ${L.map(
        (x) =>
          html`<div class="flex ic g3 py2 t13 view-in" data-key="${x.id}">
            <span class="chip icon s c-mute">${ic('receipt', 15)}</span>
            <div class="grow">
              <b class="block">${x.t}</b
              ><span class="muted t12">${x.date} · ${x.cat} · ${x.vendor}</span>
            </div>
            <b class="num badc nowrap">−${money(x.amt)}</b>
          </div>`,
      )}
    </div>`;
  }

  /** Хийсэн ажлын timeline (ажилтны дуусгасан ажил автоматаар нэмэгдэнэ) */
  function workRows(Wk) {
    if (!Wk.length) return html`<p class="empty">Энэ сард бүртгэгдсэн ажил алга</p>`;
    return html`<div class="tl">
      ${Wk.map(
        (x) =>
          html`<div class="tl-it view-in" data-key="${x.id}">
            <span class="${'tl-dot ' + (x.src === 'staff' ? 'okbg' : 'accbg')}"></span>
            <div class="grow col">
              <b class="t13">${x.t}</b
              ><span class="muted t12"
                >${x.date} · ${x.where || '—'} · ${x.by}${x.req ? ' · ' + x.req : ''}</span
              >
            </div>
            <span class="${'chip no-shrink ' + (x.src === 'staff' ? 'c-ok' : 'c-acc')}"
              >${x.src === 'staff' ? 'Ажилтан' : 'Удирдлага'}</span
            >
          </div>`,
      )}
    </div>`;
  }

  /** Байр тус бүрийн төлбөрийн гүйцэтгэл (айлын нэр харуулахгүй) */
  function bldRates(units, mine) {
    return html`<div class="col g2">
      ${D.BUILDINGS.map((b) => {
        const L = units[b.n - 1];
        const p = L.filter((u) => u.st === 0).length / L.length;
        const pc = Math.round(p * 100);
        return html`<div class="flex ic g3 t13">
          <b class="${cx('nowrap', mine === b.n && 'accc')}" style="width:84px"
            >${b.n}-р байр${mine === b.n ? ' ★' : ''}</b
          >
          <div class="bar grow">
            <i
              class="${p >= 0.9 ? 'okbg' : p >= 0.8 ? 'warnbg' : 'badbg'}"
              style="${'width:' + pc + '%'}"
            ></i>
          </div>
          <b class="num right" style="width:40px">${pc}%</b>
        </div>`;
      })}
    </div>`;
  }

  /** Айлын сарын төлбөр энэ сарын зарлагын бүтцээр юунд зарцуулагдах */
  function billShare(bill, L) {
    const total = sum(L) || 1;
    return html`<div class="col g2">
      ${byCat(L).map(
        ([c, v], i) =>
          html`<div class="flex ic g2 t13">
            <i class="${'lg-sq cb' + (i % 8)}"></i><span class="grow">${c}</span
            ><b class="num">${money(Math.round((bill * v) / total / 100) * 100)}</b>
          </div>`,
      )}
    </div>`;
  }

  window.Report = { mLabel, sum, M, fundStats, catBars, ledgerRows, workRows, bldRates, billShare };
})();
