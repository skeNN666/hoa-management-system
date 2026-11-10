/*
 * СӨХ Platform — нийтлэг UI Web Component-ууд (Light DOM).
 * nar.css / app.css-ийн class-уудыг шууд ашиглана; host нь `display: contents` тул
 * layout (flex / grid) өмнөх шигээ ажиллана. data-act товчнууд Nar.app-ийн event
 * delegation-оор ажилладаг тул component дотор ч, гадна ч ижил.
 *
 *   <nar-icon name="bell" size="18"></nar-icon>
 *   <sokh-switch on act="invToggle" arg="auto" label="Автомат"></sokh-switch>
 *   <sokh-seg value="p" act="zone" options='[["p","Гадна"],["g","Гараж"]]'></sokh-seg>
 *   <sokh-prio p="HIGH"></sokh-prio>
 *   <sokh-theme-btn dark variant="alt"></sokh-theme-btn>
 *   <sokh-stat label="Үлдэгдэл" value="₮12.4M" sub="..." tone="okc"></sokh-stat>
 *   <sokh-alert tone="bad" icon="droplet" heading="..." sub="..." cta="Хаах" act="closeLeak" arg="L1">
 *   <sokh-bar value="82" tone="okbg"></sokh-bar>
 */
(function () {
  const { html, raw, cx, define } = Nar;
  const ic = (n, s) => raw(Nar.icon(n, s));

  /** SVG icon. Хуучин ic('bell', 18) туслах нь энэ tag-ыг буцаана. */
  define('nar-icon', {
    attrs: ['name', 'size', 'cls'],
    render: (el) => raw(Nar.icon(el.str('name', 'info'), el.num('size', 18), el.str('cls'))),
  });
  /** html`` дотор: ${Nar.ic('bell', 18)} → <nar-icon> */
  Nar.ic = (name, size = 18, cls = '') =>
    html`<nar-icon name="${name}" size="${size}" ${cls ? html`cls="${cls}"` : ''}></nar-icon>`;

  /** Асаах / унтраах товч */
  define('sokh-switch', {
    attrs: ['on', 'act', 'arg', 'label'],
    render: (el) => {
      const on = el.bool('on');
      return html`<button
        role="switch"
        aria-checked="${on}"
        aria-label="${el.str('label')}"
        data-act="${el.str('act')}"
        data-arg="${el.str('arg')}"
        class="${cx('switch', on && 'on')}"
      ></button>`;
    },
  });

  /** Segmented control: options = [[value, label], ...] */
  define('sokh-seg', {
    attrs: ['value', 'act', 'options', 'variant'],
    render: (el) => {
      const cur = el.str('value');
      return html`<div class="${cx('seg', el.str('variant'))}">
        ${(el.data('options') || []).map(
          ([v, l]) =>
            html`<button
              class="${String(v) === cur ? 'on' : ''}"
              data-act="${el.str('act')}"
              data-arg="${v}"
            >
              ${l}
            </button>`,
        )}
      </div>`;
    },
  });

  /** Хүсэлтийн ач холбогдол: HIGH / MED / LOW */
  define('sokh-prio', {
    attrs: ['p'],
    render: (el) => {
      const p = el.str('p');
      return html`<span
        class="${'chip ' + (p === 'HIGH' ? 'c-bad' : p === 'MED' ? 'c-warn' : 'c-mute')}"
        >${p}</span
      >`;
    },
  });

  /** Light / dark горим солих товч (data-act="theme") */
  define('sokh-theme-btn', {
    attrs: ['dark', 'variant'],
    render: (el) => {
      const dark = el.bool('dark');
      return html`<button
        data-act="theme"
        class="${cx('theme-btn', el.str('variant'))}"
        title="${dark ? 'Харанхуй горим · гэрэлтэй болгох' : 'Гэрэлтэй горим · харанхуй болгох'}"
        aria-label="Горим солих"
      >
        ${ic(dark ? 'moon' : 'sun', 18)}
      </button>`;
    },
  });

  /** Үзүүлэлтийн карт: шошго, том тоо, тайлбар */
  define('sokh-stat', {
    attrs: ['label', 'value', 'sub', 'tone'],
    render: (el) =>
      html`<div class="card p4 col g1">
        <span class="muted t12 semi">${el.str('label')}</span
        ><b class="${'num t24 ' + el.str('tone')}">${el.str('value')}</b
        ><span class="faint t12">${el.str('sub')}</span>
      </div>`,
  });

  /**
   * Мэдэгдэл / анхааруулгын мөр: tone-тэй icon, гарчиг, тайлбар, баруун талд товч эсвэл цаг.
   * cta + act → товч · time → цаг · unread → цэг
   */
  define('sokh-alert', {
    attrs: ['tone', 'icon', 'heading', 'sub', 'cta', 'act', 'arg', 'time', 'unread'],
    render: (el) => {
      const cta = el.str('cta');
      return html`<div class="${cx('trow flex g3 p2', cta ? 'ic' : 'is')}">
        <span class="${'chip icon c-' + el.str('tone', 'acc')}"
          >${ic(el.str('icon', 'info'), 16)}</span
        >
        <div class="grow">
          <b class="t13 block">${el.str('heading')}</b
          ><span class="muted t12">${el.str('sub')}</span>
        </div>
        ${cta
          ? html`<button
              class="btn s no-shrink"
              data-act="${el.str('act')}"
              data-arg="${el.str('arg')}"
            >
              ${cta}
            </button>`
          : html`<div class="col ie g1">
              <span class="num faint t11">${el.str('time')}</span>${el.bool('unread')
                ? html`<span class="dot acc"></span>`
                : ''}
            </div>`}
      </div>`;
    },
  });

  /** Хэвтээ progress bar: value = 0..100, tone = okbg | warnbg | badbg | өнгө (#hex) */
  define('sokh-bar', {
    attrs: ['value', 'tone', 'variant'],
    render: (el) => {
      const t = el.str('tone');
      const col = t.startsWith('#') ? ';background:' + t : '';
      return html`<div class="${cx('bar', el.str('variant'))}">
        <i
          class="${t.startsWith('#') ? '' : t}"
          style="${'width:' + el.num('value') + '%' + col}"
        ></i>
      </div>`;
    },
  });
})();
