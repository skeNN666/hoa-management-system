# СӨХ Platform — HTML · CSS · JavaScript · Three.js

Ямар ч бэлэн framework ашиглаагүй (React, Next.js, Vue, Tailwind, Bootstrap, jQuery, icon сан байхгүй).
Ганц гадны файл нь **Three.js** (`vendor/three.min.js`, r147) — 3D зурахад л ашиглана.
Router, state store, DOM шинэчлэлт, icon, 3D камер удирдлага, 3D шошго бүгдийг өөрөө бичсэн.

## Ажиллуулах

**Backend-тэй (зөвлөмж):** `npm install && npm start` → http://localhost:8080 (доорх «Backend» хэсэг).

**Server-гүй демо:** **`index.html`**-ийг browser-оор шууд нээнэ — бүх өгөгдөл browser-ийн localStorage-д.

1. Нэвтрэх хуудас (`index.html`) нээгдэнэ.
2. Хотхон сонгоод → эрхээ (СӨХ / ажилтан / оршин суугч) сонгоод → **Бөглөх** → нэвтэрнэ.

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
Server байвал бүртгэл PostgreSQL-д (scrypt нууц үг, session cookie), server-гүй демо горимд
`js/accounts.js`-ийн дүрмээр browser-ийн localStorage-д хадгална.

Шууд нээж болно: `login.html?role=admin|staff|resident`, `admin.html`, `staff.html`, `resident.html`.

**Шууд холбоо (realtime) турших:** `resident.html`, `staff.html`, `admin.html`-ийг тус тусад нь табд нээгээд
оршин суугчаас хүсэлт илгээ → ажилтан, удирдлагын таб дээр тэр дороо гарна (localStorage + `storage` event).

> Хэрэв таны browser `file://`-ээс нээхэд хязгаарлалт тавибал фолдер дотроо `npx serve .` эсвэл
> `python -m http.server` ажиллуулаад `http://localhost:...`-аар нээнэ.

### Backend-тэй ажиллуулах

```
npm install
npm start                      # → http://localhost:8080  (DB: PGlite, server/data/pg)
```

`DATABASE_URL` байхгүй бол **PGlite** (Node дотор ажилладаг жинхэнэ Postgres) ашиглана — тусдаа DB
суулгах шаардлагагүй. Анх асаахад демо хотхон, айл, нэхэмжлэл, хүсэлт автоматаар үүснэ (`SEED_DEMO=0`
бол үүсгэхгүй). Демо нэвтрэлт: дээрх хүснэгт (ажилтан `EMP-001`…`EMP-012`, нууц үг `staff2026`).

Хуучин `server/data/layouts.json`, `accounts.json`-ыг DB руу: `npm run import:json`.

### Тест

```
npm test        # layout, accounts (бүртгэл), backend API (42 тест, PGlite санах ойд)
DATABASE_URL=postgres://… node tests/server.test.js   # жинхэнэ Postgres дээр
```

## Бүтэц

```
index.html             ← нэвтрэх хуудас (домэйн руу ороход шууд нээгдэнэ)
login.html             ← index.html руу шилжүүлдэг (хуучин холбоосын төлөө)
admin.html  staff.html  resident.html     ← 3 систем
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
  accounts.js            ← бүртгэлийн дүрэм (server-гүй демо горим)
  login.js  admin.js  staff.js  resident.js   ← хуудас бүрийн view + action
vendor/three.min.js
server/ api/          ← backend (Node + PostgreSQL) — доорх «Backend» хэсэг
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
| **Light DOM** | `js/components.js`, `report.js`, `shell.js` | nar.css / app.css-ийн class-ыг шууд ашиглана; host нь `display: contents` тул flex/grid өөрчлөгдөхгүй |
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
- Хуудасны бүтэц HTML-д: `admin.html` → `<sokh-shell mobile="drawer" banner>`.

## Backend (Node + PostgreSQL · Cloudflare Workers + Neon)

```
worker/                  ← Cloudflare Worker (бүх /api/*) → server/app.js — доорх «Cloudflare»
server/
  app.js                 ← router, session, CSRF, алдаа
  server.js              ← локал: статик файл + API
  db.js                  ← pg (DATABASE_URL) / PGlite, migration
  migrations/*.sql       ← схем (бүх хүснэгт cx_id-аар тусгаарлагдана)
  lib/                   ← auth, core (тохиргоо, map→айл/зогсоол/гэрэл, audit, файл), billing, pay (QPay),
                           requests, parking, notify (мэдэгдэл + SMS outbox), layout (js/layout.js-ийг уншина)
  routes/                ← auth, complexes, billing, requests, iot, parking, finance, notify
  seed.js · import-json.js
scripts/build.js         ← зөвхөн browser-ийн файлыг dist/ руу (server/ нийтэд харагдахгүй)
wrangler.jsonc           ← Cloudflare: assets, Hyperdrive, cron (өдөр бүр 09:00 УБ)
```

**Аюулгүй байдал:** scrypt нууц үг (хуучин hash нэвтрэхэд автоматаар шинэчлэгдэнэ) · httpOnly
`sokh_sid` session cookie (30 хоног; `X-Sokh-*` header-т итгэхгүй) · нэвтрэх, OTP, бүртгэлийн оролдлогын
хязгаар · JSON/зураг биш POST-ыг хүлээж авахгүй (CSRF) · хүсэлт бүр эрх + хотхоноор шүүгдэнэ · audit log.

### API

| Хэсэг | Endpoint |
|---|---|
| **Нэвтрэлт** | `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/password` · `POST /api/auth/otp/request` · `POST /api/auth/otp/reset` |
| **Бүртгэл** | `POST /api/accounts/register` (СӨХ: хотхон+map+админ нэг гүйлгээнд / оршин суугчийн хүсэлт) · `GET /api/accounts` · `POST /api/accounts/staff` · `POST /api/accounts/resident` · `PATCH /api/accounts/:id` |
| **Хотхон, map** | `GET /api/complexes` · `PATCH /api/complexes/:id` · `GET/PUT /api/settings` · `GET /api/layouts` · `PUT/DELETE /api/layouts/:id` · `POST /api/files` · `GET /api/files/:id` |
| **Айл** | `GET /api/units?q=5-34&debt=1` · `GET/PATCH /api/units/:id` · `GET /api/audit` |
| **Төлбөр** | `POST /api/invoices/run` · `GET /api/invoices` · `GET /api/billing/summary` · `GET /api/me/bill` · `POST /api/payments` (QPay QR + банкны апп) · `GET /api/payments[/:id]` · `/api/pay/qpay/callback` · `POST /api/payments/manual` · `POST /api/reminders` |
| **Хүсэлт** | `POST/GET /api/requests` · `GET /api/requests/:id` · `POST …/:id/take` · `…/assign` · `…/status` · `…/photos?kind=after` · `GET /api/staff` |
| **Ус алдалт** | `GET/POST /api/leaks` · `POST /api/leaks/:id/close` · `POST /api/leaks/:id/assign` |
| **Гэрэл** | `GET /api/lights` · `POST /api/lights/:id/report` · `POST /api/lights/:id/fix` |
| **Зогсоол** | `GET /api/slots` · `GET /api/parking/me` · `POST /api/parking/reserve·cancel·arrive·leave` · `POST/DELETE /api/parking/queue` · `POST/DELETE /api/slots/:id/rental` · `GET /api/parking/rentals` |
| **Санхүү** | `GET /api/finance/fund` · `GET/POST /api/finance/ledger` · `GET/POST /api/finance/obligations` · `POST …/:id/pay` · `GET/POST /api/works` · `GET /api/reports` · `POST /api/reports/:month/publish` · `GET /api/finance/months` |
| **Мэдэгдэл** | `GET /api/notifications` · `POST /api/notifications/read` · `GET /api/sync?since=` · `GET /api/stream` (SSE) |
| **IoT** | `GET/POST/DELETE /api/devices` · `POST /api/iot/leak·slot·light·heartbeat` · `GET /api/iot/commands` · `POST /api/iot/commands/:id/ack` (толгой: `X-Device-Id`, `X-Device-Key`) |
| **Cron** | `GET /api/cron/daily` (`Authorization: Bearer $CRON_SECRET`): нэхэмжлэл, сануулга, SLA, зогсоол, SMS, цэвэрлэгээ |

### Cloudflare Workers дээр байршуулах (үнэгүй багц)

Ажиллаж буй хаяг: https://sokh-platform.sokh-nar.workers.dev

Ижил код: статик файл → **Workers Static Assets**, `/api/*` → `worker/index.js` → `server/app.js`,
DB → **Hyperdrive** → Neon Postgres, өдөр тутмын ажил → **Cron Trigger**.

```
worker/index.js          ← Worker: /api/* → server/app.js, scheduled() → /api/cron/daily
worker/node-adapter.js   ← Fetch Request/Response ↔ Node req/res (server/ код өөрчлөгдөхгүй)
worker/setup.js          ← хүсэлт бүрт DB pool (AsyncLocalStorage), migration-ууд
scripts/build-worker.js  ← dist/ + worker/migrations.gen.js (deploy, dev бүрт автоматаар)
wrangler.jsonc           ← assets, hyperdrive, cron, vars
```

1. `npx wrangler@4 login`
2. Hyperdrive (Neon-ы **pooler-гүй** хаяг — `-pooler` хэсгийг хасна; **cache унтраана**, эс тэгвээс
   SELECT-ийн хариу 60 сек хуучирч болно):
   ```
   npx wrangler@4 hyperdrive create sokh-db --caching-disabled --connection-string="postgresql://…@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
   ```
   Гарсан `id`-г `wrangler.jsonc` → `hyperdrive[0].id`-д тавина.
3. Нууцууд: `npx wrangler@4 secret put CRON_SECRET` (хэрэгтэй бол `QPAY_*`, `SMS_*`, `PUBLIC_URL`).
4. `npm run cf:deploy` → `https://sokh-platform.<таны-subdomain>.workers.dev`
   (схем анхны хүсэлтээр автоматаар үүснэ; демо өгөгдлийг production-д бүү seed хий)

Локалаар Worker-ээр турших: `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://… npm run cf:dev`.

**Үнэгүй багцын хязгаар:** 100 000 хүсэлт/өдөр (статик файл тоологдохгүй), хүсэлт бүрт 10ms CPU
(DB-г хүлээх хугацаа тоологдохгүй). Нэвтрэх үеийн scrypt CPU их зарцуулдаг тул нэвтрэхэд алдаа (1102)
гарвал Workers Paid ($5) руу шилжинэ.

**Frontend холболт:** server-тэй, нэвтэрсэн үед `js/remote.js` store-ыг үүсгэнэ: хуудас ачаалахад
`GET /api/boot` (хэрэглэгчийн эрхээр шүүсэн бүх өгөгдөл, `js/store.js`-ийн төлвийн хэлбэрээр), үйлдэл бүр
(`S.pay`, `S.newRequest`, `S.reserveSlot` …) API руу явна, 5 сек тутам `/api/sync`-ээр бусдын өөрчлөлтийг
татна. Server-гүй үед `js/store.js` өмнөх шигээ демо симуляцаар ажиллана. Нэг browser нэг session-тэй тул
гурван эрхийг зэрэг турших бол өөр browser / incognito цонх ашиглана.

## Responsive

Breakpoint: 640 · 768 · 1024 · 1280. ≥1024 зүүн цэс; түүнээс доош удирдлагад гулсдаг цэс,
ажилтан/оршин суугчид доод tab цэс. 3D камер нарийн дэлгэц дээр автоматаар холдоно.
