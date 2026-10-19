# СӨХ Platform — HTML · CSS · JavaScript · Three.js

Ямар ч бэлэн framework ашиглаагүй (React, Next.js, Vue, Tailwind, Bootstrap, jQuery, icon сан байхгүй).
Ганц гадны файл нь **Three.js** (`vendor/three.min.js`, r147) — 3D зурахад л ашиглана.
Router, state store, DOM шинэчлэлт, icon, 3D камер удирдлага, 3D шошго бүгдийг өөрөө бичсэн.

## Ажиллуулах

`npm install` хэрэггүй, build хэрэггүй.

1. Zip-ээ задлаад **`index.html`**-ийг browser-оор нээнэ (давхар товшино).
2. Хотхон сонгоод → эрхээ сонгоод → **Бөглөх** → нэвтэрнэ.

| Эрх | Нэвтрэх нэр | Нууц үг |
|---|---|---|
| Удирдлага | `admin` | `admin2026` |
| Ажилтан | `EMP-009` | `staff2026` |
| Оршин суугч | `9911 2233` | `bat2026` |

Шууд нээж болно: `admin.html`, `staff.html`, `resident.html`.

**Шууд холбоо (realtime) турших:** `resident.html`, `staff.html`, `admin.html`-ийг тус тусад нь табд нээгээд
оршин суугчаас хүсэлт илгээ → ажилтан, удирдлагын таб дээр тэр дороо гарна (localStorage + `storage` event).

> Хэрэв таны browser `file://`-ээс нээхэд хязгаарлалт тавибал фолдер дотроо `npx serve .` эсвэл
> `python -m http.server` ажиллуулаад `http://localhost:...`-аар нээнэ.

## Бүтэц

```
index.html  admin.html  staff.html  resident.html     ← 4 хуудас
css/
  nar.css        ← өөрийн CSS framework: өнгө (light/dark), reset, utility, компонент
  app.css        ← shell, хуудас бүрийн загвар, анимаци
js/nar/          ← өөрийн жижиг framework "Nar"
  nar.js         ← html`` template (автоматаар escape), store, олон таб sync, leader,
                   DOM morph (diff), router, event delegation, keep-alive, modal, toast
  icons.js       ← өөрөө зурсан SVG icon-ууд
  three-kit.js   ← Three.js дээрх туслах: OrbitCam (чирэх/zoom/pinch), HTML шошго, resize, click
js/
  data.js        ← жишээ өгөгдөл (backend холбоход API-аас авна)
  store.js       ← төлөв + бүх үйлдэл (төлбөр, хүсэлт, ус алдалт, зогсоол…) + "шууд" симуляц
  widgets.js     ← ажилтны засварын анимаци, ус алдалтын байр, цэцэг, хөтөч Сараа
  scenes.js      ← 3D: хотхоны map, зогсоол
  shell.js       ← цэс (sidebar / drawer / доод цэс), header, мэдэгдэл
  login.js  admin.js  staff.js  resident.js   ← хуудас бүрийн view + action
vendor/three.min.js
```

## Nar framework товч

```js
const { html } = Nar;
html`<b>${name}</b>`                 // утга автоматаар escape → XSS-гүй
Nar.app({ store, regions: [{ el: '#view', render, topics: ['reqs'] }], actions, inputs })
<button data-act="remind" data-arg="5-34">          // → actions.remind('5-34')
<input data-in="q">                                   // → inputs.q(value)
Nar.keep('map3d')  / Nar.host('map3d')                // 3D canvas дахин зурахад алдагдахгүй
Nar.modal.open(() => html`...`)   Nar.toast('Гарчиг', 'тайлбар', 'ok')
```

Дахин зурах үед `morph` нь зөвхөн өөрчлөгдсөн DOM-ыг сольдог тул input-ийн focus, scroll,
CSS анимаци, 3D canvas хадгалагдана.

## Backend холбох

`js/store.js`-ийн action бүр (`pay`, `newRequest`, `takeRequest`, `closeLeak`…) нь нэг газар байгаа.
Тэдгээрийг `fetch('/api/...')` болгож, `tick()` симуляцыг WebSocket / SSE мессежээр солиход хангалттай.

## Responsive

Breakpoint: 640 · 768 · 1024 · 1280. ≥1024 зүүн цэс; түүнээс доош удирдлагад гулсдаг цэс,
ажилтан/оршин суугчид доод tab цэс. 3D камер нарийн дэлгэц дээр автоматаар холдоно.
