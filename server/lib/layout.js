/*
 * js/layout.js (browser-ийн map model)-ыг серверт module-аар ачаална (Node, Cloudflare Worker).
 * Сервер зөвхөн уншина: анхны map (original), шинэ map үүсгэх (generate), тоолох.
 * Server дээр window байхгүй тул localStorage нь хоосон → Layout.get(id) үргэлж кодонд байгаа
 * анхных map-ыг буцаана.
 */
const Layout = require('../../js/layout.js');

/** vm-ийн объектыг энгийн JSON болгоно */
const plain = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const pad = (n) => String(n).padStart(2, '0');

/** Кодонд байгаа хотхонууд (narny, altan …) */
const builtins = () => plain(Layout.all());
const original = (id) => plain(Layout.original(id));
const generate = (spec) => plain(Layout.generate(spec));

/** map-аас айл, зогсоол, гэрлийн жагсаалт */
function derive(L) {
  const units = [];
  for (const B of L.buildings)
    for (let n = 1; n <= B.units; n++)
      units.push({ b: B.n, n, floor: Math.ceil(n / Math.max(1, B.per || 1)) });
  const slots = [];
  const np = Layout.slots(L);
  for (let i = 1; i <= np; i++) slots.push({ id: 'P' + pad(i), zone: 'p' });
  for (let i = 1; i <= (Number(L.garage) || 0); i++) slots.push({ id: 'G' + pad(i), zone: 'g' });
  const lights = (L.lights || []).map((l, i) => ({
    id: 'L' + pad(i + 1),
    loc: String(l.loc || ''),
    x: Number(l.x) || 0,
    z: Number(l.z) || 0,
  }));
  return { units, slots, lights };
}

/** Хадгалах map-ын үндсэн бүтцийг шалгана → алдааны текст | null */
function validate(L, id) {
  if (!L || typeof L !== 'object' || Array.isArray(L)) return 'JSON биш';
  if (L.id !== id) return 'id таарахгүй байна';
  if (!Array.isArray(L.buildings) || !L.buildings.length) return 'buildings хоосон';
  if (L.buildings.length > 60) return 'Байр хэт олон байна';
  if (!Array.isArray(L.roads) || !Array.isArray(L.lots)) return 'roads / lots буруу';
  for (const B of L.buildings)
    if (!Number.isInteger(B.n) || !Number.isInteger(B.units) || B.units < 1 || B.units > 2000)
      return 'Байрны мэдээлэл буруу';
  if (new Set(L.buildings.map((B) => B.n)).size !== L.buildings.length)
    return 'Байрны дугаар давхардсан';
  if (L.bg) {
    const s = String(L.bg.src || '');
    // дэвсгэр: upload хийсэн файл (api/files/<id>) эсвэл хуучин data: зураг
    if (!/^\/?api\/files\/[\w-]+$/.test(s) && !/^data:image\/(png|jpeg|webp);base64,/.test(s))
      return 'дэвсгэр зураг буруу';
  }
  return null;
}

module.exports = { Layout, builtins, original, generate, derive, validate, plain };
