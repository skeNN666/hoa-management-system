/*
 * СӨХ Platform — Танилцуулга (index.html)-ийн Web Component-ууд (Light DOM).
 * Хуудасны агуулга index.html-д шууд HTML-ээр бичигдсэн; энд зөвхөн давтагддаг хэсгүүд:
 *   <sokh-system-card role="admin" icon="shield" heading="..." sub="..." desc="..." points="a|b|c">
 *   <sokh-feature icon="wallet" heading="Төлбөр" desc="...">
 *   <sokh-landing-stats>  — хотхон, байр, айлын тоо (js/layout.js-ийн бүртгэлээс)
 * Систем сонгоход → login.html?role=… руу шилжинэ.
 */
(function () {
  const { html, raw, define } = Nar;
  const ic = (n, s) => raw(Nar.icon(n, s));

  define('sokh-system-card', {
    attrs: ['role', 'icon', 'heading', 'sub', 'desc', 'points'],
    render: (el) =>
      html`<a class="card ld-sys" href="${'login.html?role=' + el.str('role')}">
        <span class="role-ic ld-sys-ic">${ic(el.str('icon'), 22)}</span>
        <div class="col g1">
          <b class="t18">${el.str('heading')}</b><span class="muted t13">${el.str('sub')}</span>
        </div>
        <p class="t14">${el.str('desc')}</p>
        <ul class="col g2 ld-pts">
          ${el
            .str('points')
            .split('|')
            .filter(Boolean)
            .map((p) => html`<li class="flex ic g2 t13">${ic('check', 15)}${p}</li>`)}
        </ul>
        <span class="btn p ld-go">${el.str('heading')} рүү орох ${ic('arrow-right', 17)}</span>
      </a>`,
  });

  define('sokh-feature', {
    attrs: ['icon', 'heading', 'desc'],
    render: (el) =>
      html`<div class="card ld-feat">
        <span class="ld-feat-ic">${ic(el.str('icon'), 20)}</span
        ><b class="t15">${el.str('heading')}</b>
        <p class="muted t13">${el.str('desc')}</p>
      </div>`,
  });

  define('sokh-landing-stats', {
    render() {
      const ALL = Layout.all();
      const units = ALL.reduce((a, L) => a + Layout.units(L), 0);
      const blds = ALL.reduce((a, L) => a + L.buildings.length, 0);
      return html`<div class="ld-stats">
        <div><b>${ALL.length}</b><span>хотхон</span></div>
        <div><b>${blds}</b><span>байр</span></div>
        <div><b>${units.toLocaleString()}</b><span>айл</span></div>
      </div>`;
    },
  });
})();
