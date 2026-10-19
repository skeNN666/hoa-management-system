/* СӨХ Platform — жишээ (mock) өгөгдөл. Backend холбоход эдгээрийг API-аас авна. */
(function () {
  const REQ_STATUS = ['Шинэ', 'Хүлээн авсан', 'Хийгдэж буй', 'Хүлээгдэж буй', 'Шийдэгдсэн'];
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  const SUR = ['Бат', 'Болд', 'Сараа', 'Анужин', 'Тэмүүлэн', 'Номин', 'Ганбат', 'Уянга', 'Эрдэнэ', 'Мөнхзул', 'Тэлмэн', 'Энхжин', 'Батсайхан', 'Хулан', 'Дорж', 'Оюун'];
  const INI = ['Б', 'Д', 'Г', 'Ж', 'Л', 'М', 'Н', 'О', 'С', 'Т', 'Э', 'Ц', 'Х'];
  const LET = ['УБА', 'УНА', 'УНБ', 'УБЕ', 'УАМ', 'УКО'];
  const CAR_COLORS = ['#2F6FD6', '#D9483B', '#1F2937', '#E6A23C', '#3BA776', '#8B5CF6', '#94A3B8', '#E5E7EB'];
  const ME = { name: 'Бат', b: 5, n: 34, plate: '1234 УБА', bill: 97000 };
  const ME_STAFF = { n: 'Ж. Нарантуяа', role: 'Лифт техникч', cats: ['Лифт', 'Засвар'] };

  function makeUnits() {
    const r = rng(77); const pick = (a) => a[Math.floor(r() * a.length)]; const blds = [];
    for (let b = 1; b <= 6; b++) {
      const L = [];
      for (let n = 1; n <= 208; n++) {
        const x = r(); const st = x < 0.86 ? 0 : x < 0.95 ? 1 : 2;
        L.push({ b, n, floor: Math.ceil(n / 13), owner: pick(INI) + '. ' + pick(SUR), tenant: r() < 0.15 ? pick(INI) + '. ' + pick(SUR) : '', phone: '99' + Math.floor(100000 + r() * 899999), st,
          amt: 82000 + Math.floor(r() * 6) * 5000, prev: st === 1 ? 20000 + Math.floor(r() * 4) * 7000 : 0, plate: r() < 0.55 ? (1000 + Math.floor(r() * 8999)) + ' ' + pick(LET) : '' });
      }
      blds.push(L);
    }
    Object.assign(blds[4][33], { st: 2, amt: ME.bill, prev: 0, owner: 'Бат', plate: ME.plate });
    return blds;
  }
  function makeSlots() {
    const r = rng(11); const out = [];
    for (let i = 1; i <= 48; i++) { const x = r(); const st = x < 0.62 ? 1 : x < 0.88 ? 0 : 2; out.push({ id: 'P' + String(i).padStart(2, '0'), zone: 'p', st, plate: st ? (1000 + Math.floor(r() * 8999)) + ' ' + LET[i % 6] : '', sens: i === 17 ? 'off' : i === 31 ? 'low' : 'ok', bat: 20 + Math.floor(r() * 80), color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] }); }
    for (let i = 1; i <= 40; i++) { const x = r(); const st = x < 0.7 ? 1 : x < 0.93 ? 0 : 2; out.push({ id: 'G' + String(i).padStart(2, '0'), zone: 'g', st, plate: st ? (1000 + Math.floor(r() * 8999)) + ' ' + LET[i % 6] : '', sens: i === 9 ? 'off' : 'ok', bat: 60, color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] }); }
    return out;
  }
  const LIGHTS = [
    [40, 226, 'Гол зам · 1-р байр'], [130, 226, 'Гол зам · 1-р байр'], [220, 226, 'Гол зам · 2-р байр'], [310, 226, 'Гол зам · 2-р байр'],
    [440, 226, 'Гол зам · 3-р байр'], [540, 226, 'Гол зам · тоглоомын талбай'], [640, 226, 'Гол зам · тоглоомын талбай'], [730, 226, 'Гол зам · зүүн хэсэг'],
    [90, 292, 'Гол зам · 4-р байр'], [220, 292, 'Гол зам · 4-р байр'], [470, 292, 'Гол зам · 6-р байр'], [660, 292, 'Гол зам · 6-р байр'],
    [342, 60, 'Төв зам · хойд'], [408, 140, 'Төв зам · 3-р байр'], [342, 190, 'Төв зам · 2-р байр'], [408, 340, 'Төв зам · 6-р байр'],
    [342, 420, 'Төв зам · 5-р байр'], [408, 500, 'Төв зам · урд'], [530, 170, 'Тоглоомын талбай · баруун'], [620, 170, 'Тоглоомын талбай · зүүн'],
    [470, 470, 'Зогсоол · баруун'], [575, 470, 'Зогсоол · төв'], [690, 470, 'Зогсоол · зүүн'], [375, 520, 'Орцны хаалга'],
  ].map((l, i) => ({ id: 'L' + String(i + 1).padStart(2, '0'), x: l[0], y: l[1], loc: l[2], st: i === 6 || i === 18 ? 'off' : 'on' }));
  const BUILDINGS = [
    { n: 1, x: 36, y: 56, w: 110, d: 70, fl: 16 }, { n: 2, x: 192, y: 44, w: 118, d: 84, fl: 14 }, { n: 3, x: 432, y: 36, w: 78, d: 78, fl: 22 },
    { n: 4, x: 40, y: 334, w: 110, d: 78, fl: 12 }, { n: 5, x: 204, y: 392, w: 104, d: 96, fl: 16 }, { n: 6, x: 440, y: 316, w: 280, d: 62, fl: 9 },
  ];
  const STAFF = [
    ['Ж. Нарантуяа', 'Лифт техникч', 'Лифт'], ['Б. Ганзориг', 'Засварчин', 'Засвар'], ['С. Мөнхзул', 'Сантехникч', 'Сантехник'], ['Ц. Эрдэнэ', 'Сантехникч', 'Сантехник'],
    ['Н. Тунгалаг', 'Цахилгаанчин', 'Цахилгаан'], ['О. Сайнбаяр', 'Сантехникч', 'Сантехник'], ['Д. Бямба', 'Харуул', 'Харуул'], ['Г. Солонго', 'Цэвэрлэгээ', 'Цэвэрлэгээ'],
    ['Т. Ариунаа', 'Нягтлан', 'Санхүү'], ['Л. Мөнх-Эрдэнэ', 'Лифт техникч', 'Лифт'], ['Э. Батжаргал', 'Цахилгаанчин', 'Цахилгаан'], ['П. Хишигээ', 'Харуул', 'Харуул'],
  ].map((s, i) => ({ id: 'EMP-' + String(i + 1).padStart(3, '0'), n: s[0], role: s[1], cat: s[2], on: i % 5 !== 4, done: 12 + ((i * 7) % 30), rating: 4.2 + ((i * 3) % 8) / 10 }));
  const now = Date.now(), min = 60000;
  const REQUESTS = [
    { id: 'REQ-1040', title: 'Дээд давхраас ус гоожиж байна', cat: 'Сантехник', p: 'HIGH', b: 3, u: 88, st: 0, createdAt: now - 48 * min, stAt: now - 48 * min, desc: 'Угаалгын өрөөний таазаас ус дусч байна.', photos: 1, from: 'resident' },
    { id: 'REQ-1042', title: 'Лифт 3 давхарт гацсан', cat: 'Лифт', p: 'HIGH', b: 5, u: 34, st: 2, createdAt: now - 135 * min, stAt: now - 40 * min, by: 'Ж. Нарантуяа', desc: '5-р байрны лифт 3 давхарт гацсан. Хүүхэдтэй айлууд шатаар явж байна.', photos: 0, from: 'resident' },
    { id: 'REQ-1034', title: 'Дээврээс ус дусна', cat: 'Засвар', p: 'HIGH', b: 6, u: 201, st: 2, createdAt: now - 400 * min, stAt: now - 120 * min, by: 'Б. Ганзориг', desc: 'Дээврийн ус зайлуулах хоолой бөглөрсөн байж болзошгүй.', photos: 0, from: 'resident' },
    { id: 'REQ-1038', title: 'Цахилгааны хүчдэл хэлбэлзэж байна', cat: 'Цахилгаан', p: 'HIGH', b: 4, u: 96, st: 2, createdAt: now - 230 * min, stAt: now - 60 * min, by: 'Н. Тунгалаг', desc: 'Гэрэл анивчиж, хөргөгч унтарч асаж байна.', photos: 0, from: 'resident' },
    { id: 'REQ-1036', title: 'Орцны гэрэл асахгүй байна', cat: 'Цахилгаан', p: 'MED', b: 2, u: 112, st: 1, createdAt: now - 62 * min, stAt: now - 20 * min, by: 'Э. Батжаргал', desc: '2-р орцны 1 давхрын гэрэл.', photos: 0, from: 'resident' },
    { id: 'REQ-1029', title: 'Халаалт хүйтэн байна', cat: 'Дулаан', p: 'MED', b: 1, u: 145, st: 3, createdAt: now - 300 * min, stAt: now - 90 * min, by: 'С. Мөнхзул', desc: 'Радиатор хүйтэн. Материал хүлээж байна.', photos: 0, from: 'resident' },
    { id: 'REQ-1021', title: 'Лифтний гэрэл солих', cat: 'Лифт', p: 'LOW', b: 3, u: 0, st: 4, createdAt: now - 2000 * min, stAt: now - 1500 * min, by: 'Ж. Нарантуяа', desc: 'LED гэрэл солив.', photos: 2, from: 'admin' },
  ];
  const INCOMING = [
    { id: 'REQ-1047', title: 'Лифтний хаалга чимээ гаргаж байна', cat: 'Лифт', p: 'MED', b: 1, u: 26, st: 0, desc: 'Хаалга онгойх үед чимээ гарч байна.', photos: 1, from: 'resident' },
    { id: 'REQ-1049', title: 'Лифт 9 давхарт зогсохгүй', cat: 'Лифт', p: 'HIGH', b: 4, u: 117, st: 0, desc: '9 давхрын товч ажиллахгүй.', photos: 0, from: 'resident' },
    { id: 'REQ-1051', title: 'Угаалтуурын хоолой гоожиж байна', cat: 'Сантехник', p: 'MED', b: 6, u: 44, st: 0, desc: 'Гал тогооны угаалтуурын доор ус тогтож байна.', photos: 1, from: 'resident' },
  ];
  const PAY_NAMES = ['О. Номин', 'Х. Бат', 'М. Хулан', 'С. Болд', 'П. Энхжин', 'Т. Тэлмэн', 'Л. Мөнх-Эрдэнэ', 'Г. Солонго'];
  const CHANNELS = ['QPay', 'SocialPay', 'Хаан банк', 'Голомт банк', 'ХасБанк'];
  const hm = (t = Date.now()) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const money = (n) => '₮' + Math.round(n).toLocaleString('en-US');
  const nf = (n) => Math.round(n).toLocaleString('en-US');
  const ago = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' мин' : Math.floor(m / 60) + 'ц ' + (m % 60) + 'м'; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.D = { REQ_STATUS, rng, CAR_COLORS, ME, ME_STAFF, makeUnits, makeSlots, LIGHTS, BUILDINGS, STAFF, REQUESTS, INCOMING, PAY_NAMES, CHANNELS, hm, money, nf, ago, esc };
})();
