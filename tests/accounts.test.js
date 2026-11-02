/*
 * Хэрэглэгчийн бүртгэлийн дүрмийн тест:  node tests/accounts.test.js
 * СӨХ бүртгүүлэх, оршин суугчийн хүсэлт → батлах, ажилтан үүсгэх, нэвтрэх шалгалт.
 */
const assert = require('assert');
const path = require('path');
const A = require(path.join(__dirname, '..', 'js', 'accounts.js'));

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
const RES = {
  role: 'resident',
  cx: 'narny',
  name: 'Б. Болд',
  phone: '8811 2233',
  b: 2,
  u: 15,
  fam: 3,
  pw: 'bold2026',
  pw2: 'bold2026',
};

console.log('Бүртгэл');
test('СӨХ бүртгэл шууд идэвхтэй, нууц үг hash-лагдана', () => {
  const list = [];
  const r = A.register(list, {
    role: 'admin',
    cx: 'cx-1',
    name: 'Д. Сарнай',
    phone: '99112233',
    login: 'sarnai',
    pw: 'secret1',
    pw2: 'secret1',
  });
  assert.ok(r.ok, r.msg);
  assert.strictEqual(r.acc.status, 'active');
  assert.notStrictEqual(r.acc.pw, 'secret1');
  assert.ok(A.check(list, 'admin', 'cx-1', 'Sarnai', 'secret1').ok);
  assert.ok(!('pw' in A.pub(r.acc)));
});
test('ажилтан өөрөө бүртгүүлж чадахгүй', () => {
  assert.ok(!A.register([], { ...RES, role: 'staff' }).ok);
});
test('буруу утас, богино / таарахгүй нууц үг', () => {
  assert.ok(!A.register([], { ...RES, phone: '123' }).ok);
  assert.ok(!A.register([], { ...RES, pw: '123', pw2: '123' }).ok);
  assert.ok(!A.register([], { ...RES, pw2: 'other123' }).ok);
});
test('оршин суугч: хүсэлт → хүлээгдэнэ → батлагдсаны дараа нэвтэрнэ', () => {
  const list = [];
  const r = A.register(list, RES);
  assert.ok(r.ok, r.msg);
  assert.strictEqual(r.acc.status, 'pending');
  const c = A.check(list, 'resident', 'narny', '88112233', 'bold2026');
  assert.strictEqual(c.status, 'pending');
  assert.ok(A.decide(list, 'narny', r.acc.id, 'active').ok);
  assert.ok(A.check(list, 'resident', 'narny', '8811-2233', 'bold2026').ok);
  assert.ok(!A.check(list, 'resident', 'narny', '88112233', 'wrong').ok);
});
test('өөр хотхоны админ батлах боломжгүй, давхар хүсэлт хориглоно', () => {
  const list = [];
  const r = A.register(list, RES);
  assert.ok(!A.decide(list, 'altan', r.acc.id, 'active').ok);
  assert.ok(!A.register(list, RES).ok);
  // өөр хотхонд тэр дугаараар хүсэлт илгээж болно
  assert.ok(A.register(list, { ...RES, cx: 'altan' }).ok);
});
test('татгалзсан хүсэлтийг дахин илгээнэ', () => {
  const list = [];
  const r = A.register(list, RES);
  A.decide(list, 'narny', r.acc.id, 'rejected', 'тоот буруу');
  assert.match(A.check(list, 'resident', 'narny', RES.phone, RES.pw).msg, /тоот буруу/);
  assert.ok(A.register(list, RES).ok);
  assert.strictEqual(list.length, 1);
});
test('ажилтан: EMP-### ID дараална, идэвхгүй бол нэвтрэхгүй', () => {
  const list = [];
  const x = { name: 'Г. Төмөр', pos: 'Цахилгаанчин', phone: '88001122', pw: 'tomor26' };
  const a = A.createStaff(list, 'narny', x).acc;
  const b = A.createStaff(list, 'narny', x).acc;
  assert.strictEqual(a.login, 'EMP-101');
  assert.strictEqual(b.login, 'EMP-102');
  assert.ok(A.check(list, 'staff', 'narny', 'emp-101', 'tomor26').ok);
  A.decide(list, 'narny', a.id, 'disabled');
  assert.strictEqual(A.check(list, 'staff', 'narny', 'EMP-101', 'tomor26').status, 'disabled');
});

test('админ оршин суугчийг өөрөө бүртгэнэ → шууд нэвтэрнэ', () => {
  const list = [];
  const x = { name: 'Д. Цэцэг', phone: '99001122', b: 1, u: 7, pw: 'tsetseg1' };
  const r = A.createResident(list, 'narny', x, 'admin');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(r.acc.status, 'active');
  assert.ok(A.check(list, 'resident', 'narny', '9900 1122', 'tsetseg1').ok);
  assert.ok(!A.createResident(list, 'narny', x).ok); // давхар
  // хүсэлт ирсэн дугаарыг «Хүсэлт» хэсэгт батлуулна
  A.register(list, { ...RES });
  assert.match(A.createResident(list, 'narny', { ...x, phone: RES.phone }).msg, /Хүсэлт/);
});

console.log('\n' + passed + ' амжилттай, ' + failed + ' алдаатай');
process.exitCode = failed ? 1 : 0;
