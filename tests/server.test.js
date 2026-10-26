/*
 * Backend-ийн тест:  node tests/server.test.js
 * Эрх (зөвхөн тухайн хотхоны админ), хадгалах / буцаах, статик файлын хамгаалалт.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SOKH_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'sokh-test-'));
const server = require(path.join(__dirname, '..', 'server', 'server.js'));

const L = {
  id: 'narny',
  n: 'Нарны хотхон',
  size: [84, 64],
  roads: [{ x1: -42, z1: 0, x2: 42, z2: 0, w: 4.8 }],
  buildings: [{ n: 1, x: 0, z: 4, w: 10, d: 7, fl: 9, per: 8, units: 72, door: 'n' }],
  lots: [],
  parks: [],
  pads: [],
  lights: [],
  trees: [],
};

let passed = 0,
  failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n    ' + e.message);
  }
}

server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const req = (method, url, body, h = {}) =>
    fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...h },
      body: body ? JSON.stringify(body) : undefined,
    });
  const admin = (cx) => ({ 'X-Sokh-Role': 'admin', 'X-Sokh-Cx': cx });

  console.log('Backend API');
  await test('ping, анх хоосон', async () => {
    assert.strictEqual((await req('GET', '/api/ping')).status, 200);
    assert.deepStrictEqual(await (await req('GET', '/api/layouts')).json(), []);
  });
  await test('нэвтрээгүй / оршин суугч хадгалж чадахгүй (403)', async () => {
    assert.strictEqual((await req('PUT', '/api/layouts/narny', L)).status, 403);
    const r = await req('PUT', '/api/layouts/narny', L, {
      'X-Sokh-Role': 'resident',
      'X-Sokh-Cx': 'narny',
    });
    assert.strictEqual(r.status, 403);
  });
  await test('өөр хотхоны админ хадгалж чадахгүй (403)', async () => {
    assert.strictEqual((await req('PUT', '/api/layouts/narny', L, admin('altan'))).status, 403);
  });
  await test('id таарахгүй бол 400', async () => {
    assert.strictEqual(
      (await req('PUT', '/api/layouts/narny', { ...L, id: 'od' }, admin('narny'))).status,
      400,
    );
  });
  await test('өөрийн хотхоны админ хадгална, бусад хотхонд нөлөөлөхгүй', async () => {
    assert.strictEqual((await req('PUT', '/api/layouts/narny', L, admin('narny'))).status, 200);
    const list = await (await req('GET', '/api/layouts')).json();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'narny');
  });
  await test('анхны map руу буцаах', async () => {
    assert.strictEqual(
      (await req('DELETE', '/api/layouts/narny', null, admin('narny'))).status,
      200,
    );
    assert.deepStrictEqual(await (await req('GET', '/api/layouts')).json(), []);
  });
  console.log('Статик файл');
  await test('index.html, js өгнө', async () => {
    assert.strictEqual((await req('GET', '/')).status, 200);
    const r = await req('GET', '/js/layout.js');
    assert.ok(/javascript/.test(r.headers.get('content-type')));
  });
  await test('server/, далд файл, ROOT-оос гадагш өгөхгүй', async () => {
    assert.strictEqual((await req('GET', '/server/server.js')).status, 403);
    assert.strictEqual((await req('GET', '/.git/config')).status, 403);
    assert.notStrictEqual((await req('GET', '/%2e%2e/%2e%2e/etc/passwd')).status, 200);
  });

  console.log('\n' + passed + ' амжилттай, ' + failed + ' алдаатай');
  fs.rmSync(process.env.SOKH_DATA, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
  server.closeAllConnections(); // keep-alive холболтыг хаагаад дуусгана
  server.close();
});
