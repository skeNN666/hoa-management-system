# СӨХ Platform — HTML · CSS · JavaScript · Three.js

Ямар ч бэлэн framework ашиглаагүй (React, Next.js, Vue, Tailwind, Bootstrap, jQuery, icon сан байхгүй).
Ганц гадны файл нь **Three.js** (`vendor/three.min.js`, r147) — 3D зурахад л ашиглана.
Router, state store, DOM шинэчлэлт, icon, 3D камер удирдлага, 3D шошго бүгдийг өөрөө бичсэн.

## Ажиллуулах

`npm install` хэрэггүй, build хэрэггүй.

1. Zip-ээ задлаад **`index.html`**-ийг browser-оор нээнэ (давхар товшино).
2. Танилцуулга хуудаснаас системээ (СӨХ / ажилтан / оршин суугч) сонгоно → `login.html` нээгдэнэ.
3. Хотхон сонгоод → эрхээ шалгаад → **Бөглөх** → нэвтэрнэ.

| Эрх | Нэвтрэх нэр | Нууц үг |
|---|---|---|
| Удирдлага | `admin` | `admin2026` |
| Ажилтан | `EMP-009` | `staff2026` |
| Оршин суугч | `9911 2233` | `bat2026` |

### Бүртгүүлэх

| Хэн | Яаж | Нэвтрэх нэр |
|---|---|---|
| **СӨХ (админ)** | Нэвтрэх → «Шинэ СӨХ бүртгүүлэх»: хотхон, дүүрэг, байр, давхар + админы мэдээлэл → шинэ хотхон, map үүсч шууд нэвтэрнэ | өөрийн сонгосон латин нэр |
| **Оршин суугч** | Хотхоноо сонгоод → «Бүртгүүлэх хүсэлт илгээх»: нэр, утас, байр, тоот, нууц үг → **хүлээгдэнэ**. Эсвэл админ **Бүртгэл → Оршин суугч** хэсэгт өөрөө бүртгэнэ (шууд идэвхтэй) | утасны дугаар |
| **Ажилтан** | Өөрөө бүртгүүлэхгүй. Админ → **Бүртгэл → Ажилтан** хэсэгт үүсгэнэ | `EMP-101`, `EMP-102`… (автомат) |

Админ **Бүртгэл** хэсэгт хүсэлтийг **Батлах / Татгалзах**, оршин суугч, ажилтныг идэвхгүй болгоно (цэсэнд
хүлээгдэж буй хүсэлтийн тоо гарна). Батлагдаагүй хүсэлтээр нэвтрэх гэвэл «СӨХ хянаж байна» гэж гарна.
Дүрэм нь `js/accounts.js`-д — server байвал `server/data/accounts.json`-д, үгүй бол browser-ийн
localStorage-д хадгална. Demo нууц үгийн hash, `X-Sokh-*` толгойн эрх шалгалт нь demo түвшний.

Шууд нээж болно: `login.html?role=admin|staff|resident`, `admin.html`, `staff.html`, `resident.html`.

**Шууд холбоо (realtime) турших:** `resident.html`, `staff.html`, `admin.html`-ийг тус тусад нь табд нээгээд
оршин суугчаас хүсэлт илгээ → ажилтан, удирдлагын таб дээр тэр дороо гарна (localStorage + `storage` event).

> Хэрэв таны browser `file://`-ээс нээхэд хязгаарлалт тавибал фолдер дотроо `npx serve .` эсвэл
> `python -m http.server` ажиллуулаад `http://localhost:...`-аар нээнэ.

### Backend-тэй ажиллуулах (заавал биш)

```
node server/server.js          # эсвэл: npm start  →  http://localhost:8080
```

Нэмэлт сан хэрэггүй (Node 18+). Хотхоны map-ууд `server/data/layouts.json`-д хадгалагдаж, бүх компьютер,
browser дээр ижил харагдана. Server байхгүй үед өмнөх шигээ зөвхөн browser-ийн localStorage-д ажиллана
(`js/api.js` автоматаар таньдаг).

**Эрх:** нэвтэрсэн эрхээ (админ / ажилтан / оршин суугч) session-д хадгална. Өөр эрхтэй хэрэглэгч
`admin.html`-ийг нээвэл өөрийн хуудас руу шилжинэ. Map-ыг зөвхөн **тухайн хотхоны админ** засна: сервер
`X-Sokh-Role`, `X-Sokh-Cx` толгойг шалгаж, өөр хотхоны map руу бичихийг 403-аар хориглоно. Энэ нь demo
түвшний шалгалт — бодит системд нууц үгээр нэвтрүүлж серверт session / JWT ашиглана.

### Тест

```
npm test        # layout, accounts (бүртгэл), server тестүүд
```

## Бүтэц

```
index.html             ← танилцуулга (систем сонгох)
login.html  admin.html  staff.html  resident.html     ← нэвтрэх + 3 систем
css/
  nar.css        ← өөрийн CSS framework: өнгө (light/dark), reset, utility, компонент
  app.css        ← shell, хуудас бүрийн загвар, анимаци
  components/    ← Shadow DOM component-уудын CSS (leak-building, worker-scene, flower,
                   avatar, fund-jar, scene3d) — зөвхөн тухайн component дотор үйлчилнэ
js/nar/          ← өөрийн жижиг framework "Nar"
  nar.js         ← html`` template (автоматаар escape), store, олон таб sync, leader,
                   DOM morph (diff), Nar.define (Web Component), router, event delegation,
                   <nar-modal>, <nar-toast>
  icons.js       ← өөрөө зурсан SVG icon-ууд
  three-kit.js   ← Three.js дээрх туслах: OrbitCam (чирэх/zoom/pinch), HTML шошго, resize, click
js/
  api.js         ← backend адаптер (server байвал серверт, үгүй бол localStorage) + session, эрх
  layout.js      ← хотхоны бүтцийн model: байр, зам, зогсоол, гэрэл, мод (хотхон бүр өөр map)
  data.js        ← жишээ өгөгдөл (backend холбоход API-аас авна)
  store.js       ← төлөв + бүх үйлдэл (төлбөр, хүсэлт, ус алдалт, зогсоол…) + "шууд" симуляц
  components.js  ← нийтлэг UI component (Light DOM): <nar-icon>, <sokh-switch>, <sokh-seg>,
                   <sokh-prio>, <sokh-theme-btn>, <sokh-stat>, <sokh-alert>, <sokh-bar>
  widgets.js     ← Shadow DOM component: <sokh-worker-scene>, <sokh-leak-building>, <sokh-flower>,
                   <sokh-avatar>, <sokh-ring>, <sokh-fund-jar>, <sokh-skyline>
  report.js      ← ил тод тайлан component: <sokh-fund-stats>, <sokh-cat-bars>, <sokh-ledger>,
                   <sokh-work-timeline>, <sokh-bld-rates>, <sokh-bill-share> (admin + resident)
  scenes.js      ← 3D: хотхоны map, зогсоол
  shell.js       ← <sokh-shell mobile="drawer|bottom" banner>: цэс, header, доод цэс, мэдэгдэл
  landing.js             ← танилцуулгын component: <sokh-system-card>, <sokh-feature>, <sokh-landing-stats>
  accounts.js            ← бүртгэлийн дүрэм (browser + server хоёуланд)
  login.js  admin.js  staff.js  resident.js   ← хуудас бүрийн view + action
vendor/three.min.js
server/server.js     ← жижиг backend (статик файл + /api/layouts), нэмэлт сан хэрэггүй
tests/               ← layout model, backend-ийн тест (node)
```

## Хотхоны map model (`js/layout.js`)

Хотхон бүр өөрийн layout JSON-той (байр, орцны чиглэл, зам, зогсоолын эгнээ, машин орох зам,
гэрэл, мод). 3D map, зогсоол, айлын жагсаалт, ус алдалтын зүсэлт бүгд үүнээс уншина.

Хотхон бүр зөвхөн **өөрийн** map-ыг харж, засна: **Удирдлага → Хотхоны бүтэц** (map builder).

- **2D builder (drag & drop):** байр, зогсоол, тоглоом/спорт талбай, **замыг** чирж зөөнө; дээрх
  жагсаалтаас map руу чирж шинээр нэмнэ (дарвал хоосон газар автоматаар). Давхцах, зам дээр гарах үед улаан
  болж тавигдахгүй. Дарж сонгоод давхар, айлын тоо, орцны чиглэл, **орцны тоо (1–4)**, **хэлбэр
  (тэгш өнцөгт / L / U)**, зогсоолын тоог (− / +) засна, 90° эргүүлнэ, устгана. Сонгосон объектын буланд
  байгаа шар бариулаар **хэмжээг** чирж өөрчилнө.
- **Буцаах / дахих:** ↶ ↷ товч эсвэл Ctrl+Z / Ctrl+Y (40 алхам). Delete — устгах, Esc — сонголт арилгах.
- **Дэвсгэр зураг:** зураг төсөл эсвэл хиймэл дагуулын зургийг оруулж, тунгалаг байдал, хэмжээ,
  байрлалыг тохируулаад дээр нь байр, замаа зурна (зураг 1600px хүртэл жижигрүүлж хадгалагдана).
- **Томруулах / гүйлгэх:** хулганы дугуй, + / − товч, хоосон газар чирэх; утсанд хоёр хуруугаар.
- **3D харах:** засаж буй map-ыг жинхэнэ 3D-ээр шууд харна (2D ↔ 3D сэлгэнэ).
- **Нарийн тохируулга:** тоо өөрчлөхөд зөвхөн тухайн хэсэг өөрчлөгдөж, бусад нь байрандаа үлдэнэ.
- **Текстээр үүсгэх:** `12 байр, 16 давхар, 96 зогсоол, спорт талбай, гараж 80` гэх мэт бичиж map-ыг
  бүхэлд нь шинээр үүсгэнэ (латин галиг ч ойлгоно).

**Зогсоол түрээслэх:** Удирдлага → Зогсоол хуудсанд зогсоол сонгоод айлд (жишээ нь `5-34`) сарын
төлбөртэй хуваарилна; нийт түрээсийн орлого харагдана. Оршин суугч өөрийн түрээсийн зогсоолоо нүүр болон
зогсоолын хуудсанд харна. **3D map**-д байр сонгоход айл бүр (давхар × тоот) төлбөр, ус алдалтын өнгөөр
харагдаж, дарвал тэр айлын мэдээлэл рүү шилжинэ.

**Хадгалж map-аа шинэчлэх** дарахад тухайн хотхоны id дээр хадгалагдах тул бусад хотхонд нөлөөлөхгүй;
**Анхны map руу буцаах**-аар сэргээнэ. Бэлэн map-ыг JSON-оор оруулж / татаж болно.

## Кодын стандарт

CSS, JS, HTML файлууд [Prettier](https://prettier.io)-оор форматлагдсан (тохиргоо: `.prettierrc.json`, `.editorconfig`).
`vendor/` фолдерыг форматлахгүй. Код өөрчилсний дараа дараах командыг ажиллуулна:

```
npx prettier@3.3.3 --write "css/**/*.css" "js/**/*.js" "*.html"
```

## Nar framework товч

```js
const { html } = Nar;
html`<b>${name}</b>`                 // утга автоматаар escape → XSS-гүй
Nar.app({ store, regions: [{ el: '#view', render, topics: ['reqs'] }], actions, inputs })
<button data-act="remind" data-arg="5-34">          // → actions.remind('5-34')
<input data-in="q">                                   // → inputs.q(value)
Nar.define('sokh-x', { attrs, shadow, styles, render(el) })  // Web Component (доор харна)
Nar.modal.open(() => html`...`)   Nar.toast('Гарчиг', 'тайлбар', 'ok')
```

Дахин зурах үед `morph` нь зөвхөн өөрчлөгдсөн DOM-ыг сольдог тул input-ийн focus, scroll,
CSS анимаци, 3D canvas хадгалагдана.

## Web Components

UI нь Custom Element-ээр бүтсэн (гадны сан байхгүй, `Nar.define`). Хоёр төрөл:

| Төрөл | Хаана | Яагаад |
|---|---|---|
| **Light DOM** | `js/components.js`, `report.js`, `shell.js`, `landing.js` | nar.css / app.css-ийн class-ыг шууд ашиглана; host нь `display: contents` тул flex/grid өөрчлөгдөхгүй |
| **Shadow DOM** | `js/widgets.js`, `<sokh-scene3d>` (`scenes.js`) | SVG / 3D widget бүр өөрийн CSS-тэй (`css/components/*.css`), бусад хуудсанд нөлөөлөхгүй. Өнгө нь `--token`-оор light/dark-д дагана |

```js
Nar.define('sokh-flower', {
  attrs: ['wilt', 'paid', 'size'],          // өөрчлөгдвөл дахин зурна
  shadow: true, styles: ['css/components/flower.css'],
  render: (el) => html`<svg>…${el.num('wilt')}…</svg>`,   // el.str / num / bool / data
});
// хуудсанд:
html`<sokh-flower wilt="${s.wilt}" ${Nar.flag('paid', s.paid)} size="130"></sokh-flower>`
html`<sokh-ledger data="${Nar.json(list)}"></sokh-ledger>`   // объект → JSON attribute
```

- `morph` нь component-ийн **дотор** хүрэхгүй, зөвхөн attribute-ийг нь шинэчилнэ →
  `attributeChangedCallback` дахин зурна. Тиймээс component дотоод анимаци, focus-оо хадгална.
- `data-act` / `data-in` нь `composedPath()`-ээр шалгагддаг тул Shadow DOM дотор ч ажиллана.
- **3D:** `<sokh-scene3d key="complex3d">` — WebGL үзэгдэл key бүрт нэг л удаа үүснэ:
  `el.use((host) => Scenes.complex(host, {...})).update({...})`, `el.reset()` устгана.
- Хуудасны бүтэц HTML-д: `admin.html` → `<sokh-shell mobile="drawer" banner>`,
  `index.html` нь шууд HTML (`<sokh-system-card>`, `<sokh-feature>`, `<nar-icon>`).

## Backend холбох

`js/store.js`-ийн action бүр (`pay`, `newRequest`, `takeRequest`, `closeLeak`…) нь нэг газар байгаа.
Тэдгээрийг `fetch('/api/...')` болгож, `tick()` симуляцыг WebSocket / SSE мессежээр солиход хангалттай.

## Responsive

Breakpoint: 640 · 768 · 1024 · 1280. ≥1024 зүүн цэс; түүнээс доош удирдлагад гулсдаг цэс,
ажилтан/оршин суугчид доод tab цэс. 3D камер нарийн дэлгэц дээр автоматаар холдоно.
