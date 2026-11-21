/*
 * Cloudflare-ийн R2 / KV / LiveHub дохионы логик (server/lib/edge.js, core.saveFile …):
 *   node tests/edge.test.js
 * Worker-гүйгээр: PGlite + санах ойн хуурамч R2, KV-г Worker-тэй ижил scope-оор (AsyncLocalStorage) өгнө.
 */
const assert = require('assert');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

process.env.PGLITE_DIR = 'memory';
process.env.QUIET = '1';
const db = require(path.join(__dirname, '..', 'server', 'db.js'));
const { seed } = require(path.join(__dirname, '..', 'server', 'seed.js'));
const C = require(path.join(__dirname, '..', 'server', 'lib', 'core.js'));
const E = require(path.join(__dirname, '..', 'server', 'lib', 'edge.js'));
const N = require(path.join(__dirname, '..', 'server', 'lib', 'notify.js'));

const PNG = Buffer.concat([
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  Buffer.alloc(64, 7),
]);
let passed = 0,
  failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log(
      '  ✗ ' + name + '\n    ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n    '),
    );
  }
}

/** Санах ойн R2 (put / get / delete) */
function fakeR2() {
  const m = new Map();
  return {
    m,
    async put(k, v, o) {
      m.set(k, { body: Buffer.from(v), o });
    },
    async get(k) {
      const x = m.get(k);
      return x ? { arrayBuffer: async () => x.body, httpMetadata: x.o && x.o.httpMetadata } : null;
    },
    async delete(k) {
      m.delete(k);
    },
  };
}
/** Санах ойн KV */
function fakeKV() {
  const m = new Map();
  return {
    m,
    async get(k, o) {
      if (!m.has(k)) return null;
      return o && o.type === 'json' ? JSON.parse(m.get(k)) : m.get(k);
    },
    async put(k, v) {
      m.set(k, v);
    },
    async delete(k) {
      m.delete(k);
    },
  };
}

(async () => {
  await db.ready(); // PGlite-ийг scope-гүйгээр холбоно (scope байвал db.js pg pool хайдаг)
  await seed();
  const scope = new AsyncLocalStorage();
  globalThis.__SOKH_DB_SCOPE = scope;
  const env = { FILES: fakeR2(), KV: fakeKV() };
  const inWorker = (fn, st = { env, dirty: null }) => scope.run(st, fn);
  const row = async (id) =>
    (await db.query('select data, r2_key from files where id = $1', [id])).rows[0];

  console.log('edge (R2 · KV · LiveHub):');

  await test('R2: Worker дээр зураг R2-д, Postgres-д зөвхөн мета', async () => {
    const f = await inWorker(() => C.saveFile(db.query, 'narny', PNG, 'tester', false));
    const r = await row(f.id);
    assert.strictEqual(r.data, null);
    assert.strictEqual(r.r2_key, 'files/narny/' + f.id);
    assert.ok(env.FILES.m.has(r.r2_key));
    assert.strictEqual(env.FILES.m.get(r.r2_key).o.httpMetadata.contentType, 'image/png');
    const body = await inWorker(() => C.fileBody({ ...r, id: f.id }));
    assert.ok(body.equals(PNG));
  });

  await test('R2 binding-гүй (локал Node) бол хуучнаараа bytea', async () => {
    const f = await C.saveFile(db.query, 'narny', PNG, 'tester', false);
    const r = await row(f.id);
    assert.ok(r.data && Buffer.from(r.data).equals(PNG));
    assert.strictEqual(r.r2_key, null);
    assert.ok((await C.fileBody(r)).equals(PNG));
  });

  await test('cron: хуучин bytea файлууд R2 руу зөөгдөнө', async () => {
    const before = (await db.query('select count(*)::int n from files where r2_key is null'))
      .rows[0].n;
    assert.ok(before >= 1);
    const r = await inWorker(() => C.moveFilesToR2(db.query, 500));
    assert.strictEqual(r.moved, before);
    assert.strictEqual(r.left, 0);
    const bad = (await db.query('select count(*)::int n from files where data is not null')).rows[0]
      .n;
    assert.strictEqual(bad, 0);
    // R2-гүй (локал) бол юу ч хийхгүй
    assert.deepStrictEqual(await C.moveFilesToR2(db.query), { moved: 0, left: null });
  });

  await test('files: data болон r2_key хоёулаа null байж болохгүй (constraint)', async () => {
    await assert.rejects(
      db.query(
        "insert into files (id, cx_id, mime, size) values ('x-empty', 'narny', 'image/png', 1)",
      ),
    );
  });

  await test('KV: /api/layouts кэш — 2 дахь удаа DB уншихгүй, uncache-ийн дараа дахин', async () => {
    let n = 0;
    const load = async () => (n++, [{ id: 'narny' }]);
    const a = await inWorker(() => E.cached(E.LAYOUTS_KEY, 300, load));
    const b = await inWorker(() => E.cached(E.LAYOUTS_KEY, 300, load));
    assert.deepStrictEqual(a, b);
    assert.strictEqual(n, 1);
    await inWorker(() => E.uncache(E.LAYOUTS_KEY));
    await inWorker(() => E.cached(E.LAYOUTS_KEY, 300, load));
    assert.strictEqual(n, 2);
    // KV-гүй (локал) бол үргэлж load()
    await E.cached(E.LAYOUTS_KEY, 300, load);
    assert.strictEqual(n, 3);
  });

  await test('LiveHub: touch / notify нь хотхоныг «dirty» гэж тэмдэглэнэ', async () => {
    const st = { env, dirty: null };
    await inWorker(async () => {
      await C.touch(db.query, 'narny');
      await N.notify(db.query, 'other-cx', { role: 'admin' }, { title: 'туршилт' }).catch(() => {});
    }, st);
    assert.ok(st.dirty && st.dirty.has('narny'));
    assert.ok(st.dirty.has('other-cx'));
    // scope-гүй үед алдаа заахгүй
    await C.touch(db.query, 'narny');
  });

  console.log(`\n${passed} амжилттай, ${failed} алдаатай`);
  await db.close();
  process.exit(failed ? 1 : 0);
})();
