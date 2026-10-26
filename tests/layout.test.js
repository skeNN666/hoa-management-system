/*
 * Хотхоны layout model-ийн тест (нэмэлт сан хэрэггүй):  node tests/layout.test.js
 * Шалгах зүйл: текст ойлгох, map үүсгэх, давхцалгүй байх, замын маршрут, хэсэгчилсэн засвар,
 * builder (зөөх, нэмэх, устгах, эргүүлэх, хэмжээ), зам, L/U хэлбэр, дэвсгэр зураг.
 */
const assert = require('assert');
const path = require('path');

// browser-ийн орчныг дуурайна
global.window = {};
global.localStorage = {
  s: {},
  getItem(k) {
    return this.s[k] == null ? null : this.s[k];
  },
  setItem(k, v) {
    this.s[k] = String(v);
  },
};
require(path.join(__dirname, '..', 'js', 'layout.js'));
const Y = window.Layout;

const clone = (x) => JSON.parse(JSON.stringify(x));
const rects = (L) =>
  L.buildings.concat(L.parks).concat(L.lots.map((l) => ({ ...l, ...Y.lotSize(l) })));
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
function overlaps(L) {
  const R = rects(L);
  let n = 0;
  for (let i = 0; i < R.length; i++)
    for (let j = i + 1; j < R.length; j++) if (hit(R[i], R[j])) n++;
  return n;
}
const pos = (L) => JSON.stringify(L.buildings.map((b) => [b.x, b.z]));

let passed = 0,
  failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n    ' + e.message);
  }
}

console.log('Текстээс ойлгох (parse)');
test('кирилл тайлбар', () => {
  const sp = Y.parse('Тэнгэр хотхон, Хан-Уул, 12 байр, 14-18 давхар, 96 зогсоол, спорт, гараж 80');
  assert.strictEqual(sp.n, 'Тэнгэр хотхон');
  assert.strictEqual(sp.d, 'Хан-Уул');
  assert.strictEqual(sp.buildings, 12);
  assert.deepStrictEqual(sp.floors, [14, 18]);
  assert.strictEqual(sp.slots, 96);
  assert.strictEqual(sp.garage, 80);
  assert.strictEqual(sp.sport, true);
});
test('латин галиг', () => {
  const sp = Y.parse('5 bair 20-24 davhar 40 zogsool togloomyn talbai');
  assert.strictEqual(sp.buildings, 5);
  assert.deepStrictEqual(sp.floors, [20, 24]);
  assert.strictEqual(sp.slots, 40);
  assert.strictEqual(sp.play, true);
});
test('зогсоолгүй, талбайгүй', () => {
  const sp = Y.parse('2 байр 5 давхар зогсоолгүй талбайгүй');
  assert.strictEqual(sp.slots, 0);
  assert.strictEqual(sp.play, false);
});

console.log('Map үүсгэх (generate)');
for (const t of [
  '8 байр, 12-20 давхар, 60 зогсоол, тоглоомын талбай',
  '14 байр 16 давхар 120 зогсоол спорт',
  '4 байр нэг эгнээ 9 давхар 24 зогсоол',
  '1 байр 5 давхар зогсоолгүй',
])
  test('давхцалгүй: ' + t, () => {
    const L = Y.generate(Y.parse(t));
    assert.strictEqual(overlaps(L), 0);
    assert.strictEqual(L.buildings.length, Y.parse(t).buildings);
    assert.strictEqual(Y.slots(L), Y.parse(t).slots);
  });
test('бүх жишээ хотхон давхцалгүй', () => {
  Y.all().forEach((L) => assert.strictEqual(overlaps(L), 0, L.id));
});

console.log('Явган хүний маршрут (route)');
test('Нарны хотхон: хаалганаас замаар 3-р байр хүртэл', () => {
  const L = Y.NARNY,
    d = Y.doorOf(L.buildings[2]);
  const r = Y.route(L, { x: 3.5, z: 0.75 }, d, null, d.dir);
  assert.deepStrictEqual(r[r.length - 1], [d.x, d.z]);
  // зам дээрх цэгүүд хэвтээ / босоо шугамаар холбогдоно
  for (let i = 1; i < r.length; i++)
    assert.ok(r[i][0] === r[i - 1][0] || r[i][1] === r[i - 1][1], 'диагональ алхам ' + i);
});

console.log('Хэсэгчилсэн засвар (бусад нь хөдлөхгүй)');
test('зогсоолын тоо өөрчлөхөд байр хөдлөхгүй', () => {
  const L = clone(Y.get('narny')),
    p0 = pos(L);
  [80, 120, 20].forEach((n) => {
    Y.setSlots(L, n);
    assert.strictEqual(pos(L), p0);
    assert.strictEqual(overlaps(L), 0);
    assert.strictEqual(L.lots[0].n, n);
  });
});
test('байр нэмэхэд хуучин байрнууд хөдлөхгүй', () => {
  const L = clone(Y.get('altan')),
    p0 = pos(L);
  Y.setBuildings(L, L.buildings.length + 3);
  assert.ok(pos(L).startsWith(p0.slice(0, -1)));
  assert.strictEqual(overlaps(L), 0);
});
test('талбай асаах / унтраах', () => {
  const L = clone(Y.get('khangai'));
  Y.setPark(L, 'sport', true);
  assert.ok(L.parks.some((p) => p.kind === 'sport'));
  Y.setPark(L, 'sport', false);
  assert.ok(!L.parks.some((p) => p.kind === 'sport'));
  assert.strictEqual(overlaps(L), 0);
});

console.log('Builder (drag & drop)');
test('давхцах газар руу зөөхийг хориглоно', () => {
  const L = clone(Y.NARNY);
  const b1 = L.buildings[1];
  assert.strictEqual(Y.moveItem(L, 'b:0', b1.x, b1.z).ok, false);
  assert.strictEqual(Y.canPlace(L, 'b:0', b1.x, b1.z), false);
});
test('чөлөөтэй газар руу зөөнө, 0.5 торонд таарна', () => {
  const L = clone(Y.NARNY);
  assert.strictEqual(Y.moveItem(L, 'b:0', -38.2, -24.1).ok, true);
  assert.strictEqual(L.buildings[0].x, -38);
  assert.strictEqual(L.buildings[0].z, -24);
});
test('нэмэх, устгахад дугаар дахин дараалагдана', () => {
  const L = clone(Y.NARNY);
  const r = Y.addItem(L, 'b');
  assert.ok(r.ok);
  assert.strictEqual(L.buildings.length, 7);
  Y.removeItem(L, 'b:0');
  assert.deepStrictEqual(
    L.buildings.map((b) => b.n),
    [1, 2, 3, 4, 5, 6],
  );
  assert.strictEqual(overlaps(L), 0);
});
test('зам дээр нэмэхийг хориглоно', () => {
  const L = clone(Y.NARNY);
  assert.strictEqual(Y.addItem(L, 'b', 0, -2).ok, false);
});
test('шинэ зогсоол төв замын хажууд, машин орох эгнээтэй', () => {
  const L = clone(Y.NARNY);
  const r = Y.addItem(L, 'lot');
  assert.ok(r.ok);
  const l = L.lots[1];
  assert.ok(Math.abs(Math.abs(l.lane - -0.5) - 1.5) < 0.01, 'lane ' + l.lane);
});
test('эргүүлэхэд өргөн ↔ гүн, орц эргэнэ', () => {
  const L = clone(Y.NARNY);
  const b = { ...L.buildings[2] };
  assert.ok(Y.rotateItem(L, 'b:2').ok);
  assert.strictEqual(L.buildings[2].w, b.d);
  assert.strictEqual(L.buildings[2].door, 'w');
});
test('хэмжээ өөрчлөх: давхцвал хориглоно', () => {
  const L = clone(Y.NARNY);
  assert.ok(Y.resizeItem(L, 'b:0', 12, 8).ok);
  assert.strictEqual(L.buildings[0].w, 12);
  assert.strictEqual(Y.resizeItem(L, 'b:0', 40, 8).ok, false);
});

console.log('Зам');
test('зам нэмэх, зөөх, устгах', () => {
  const L = clone(Y.get('khangai'));
  const n0 = L.roads.length;
  const r = Y.addRoad(L, 'v');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(L.roads.length, n0 + 1);
  const k = L.roads.length - 1;
  // объект дээгүүр зөөхийг хориглоно
  const b = L.buildings[0];
  assert.strictEqual(Y.moveRoad(L, k, b.x + b.w / 2).ok, false);
  assert.ok(Y.removeItem(L, 'r:' + k).ok);
  assert.strictEqual(L.roads.length, n0);
});
test('сүүлийн замыг устгахгүй', () => {
  const L = clone(Y.NARNY);
  L.roads = [L.roads[0]];
  assert.strictEqual(Y.removeRoad(L, 0).ok, false);
});

console.log('Байрны хэлбэр, орц');
test('L / U хэлбэрийн хэсгүүд байрны хүрээнд, давхцалгүй', () => {
  const b = { x: 0, z: 0, w: 14, d: 12 };
  for (const shape of ['L', 'U'])
    for (let rot = 0; rot < 4; rot++) {
      const P = Y.partsOf({ ...b, shape, rot });
      assert.strictEqual(P.length, shape === 'L' ? 2 : 3);
      P.forEach((q) => assert.ok(q.x >= 0 && q.z >= 0 && q.x + q.w <= 14 && q.z + q.d <= 12));
      for (let i = 0; i < P.length; i++)
        for (let j = i + 1; j < P.length; j++) assert.ok(!hit(P[i], P[j]), shape + rot);
    }
});
test('олон орц хаалганы талд жигд', () => {
  const D = Y.doorsOf({ x: 0, z: 0, w: 12, d: 8, door: 's', entr: 3 });
  assert.strictEqual(D.length, 3);
  assert.ok(D.every((d) => d.z === 8.9));
  assert.deepStrictEqual(
    D.map((d) => d.x),
    [2, 6, 10],
  );
});

console.log('Дэвсгэр зураг');
test('map-д багтаж, хэмжээ / тунгалаг өөрчлөгдөнө', () => {
  const L = clone(Y.NARNY);
  Y.setBg(L, 'data:image/png;base64,AA', 2);
  assert.ok(L.bg.w <= L.size[0] && L.bg.d <= L.size[1]);
  Y.bgAdjust(L, { scale: 1.5, op: 0.3 });
  assert.strictEqual(L.bg.op, 0.3);
  Y.setBg(L, null);
  assert.strictEqual(L.bg, undefined);
});

console.log('Бүртгэл: хотхон зөвхөн өөрийнхөө map-ыг');
test('хадгалах, анхных руу буцаах', () => {
  const L = clone(Y.get('od'));
  Y.setSlots(L, 50);
  Y.save(L);
  assert.strictEqual(Y.slots(Y.get('od')), 50);
  assert.strictEqual(Y.slots(Y.get('narny')), 48); // бусад хотхонд нөлөөлөхгүй
  Y.reset('od');
  assert.strictEqual(Y.slots(Y.get('od')), Y.slots(Y.original('od')));
});

console.log('\n' + passed + ' амжилттай, ' + failed + ' алдаатай');
process.exit(failed ? 1 : 0);
