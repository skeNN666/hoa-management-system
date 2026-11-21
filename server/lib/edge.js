/*
 * Cloudflare-ийн binding-ууд (R2, KV, Durable Object) — server/ кодоос ашиглах цэг.
 *   • Worker дээр: worker/index.js хүсэлт бүрт env-ийг scope-д (AsyncLocalStorage) хийнэ
 *   • Локал Node / тест дээр: env байхгүй → бүх функц хуучин аргаараа ажиллана
 *     (зураг Postgres-д, кэшгүй, realtime-гүй — 5 сек тутмын /api/sync)
 */
function store() {
  const s = globalThis.__SOKH_DB_SCOPE;
  return (s && s.getStore()) || null;
}
/** Worker-ийн env ({ FILES, KV, LIVE, … }) эсвэл null */
function env() {
  const s = store();
  return (s && s.env) || null;
}
const r2 = () => (env() && env().FILES) || null;
const kv = () => (env() && env().KV) || null;

/**
 * Хотхонд өөрчлөлт гарлаа гэж тэмдэглэнэ. Хариу илгээгдсэний ДАРАА worker/index.js нь
 * тэмдэглэсэн хотхон бүрийн LiveHub (Durable Object) руу нэг дохио явуулна → тэр хотхоны
 * нээлттэй бүх browser шууд /api/sync хийнэ. (Гүйлгээ буцсан бол илүү дохио л очно — хор хөнөөлгүй.)
 */
function changed(cx) {
  const s = store();
  if (!s || !cx) return;
  (s.dirty || (s.dirty = new Set())).add(cx);
}

/** KV кэш: байвал түүнийг, үгүй бол load()-ийн үр дүнг ttl сек хадгална */
async function cached(key, ttl, load) {
  const K = kv();
  if (!K) return load();
  try {
    const hit = await K.get(key, { type: 'json' });
    if (hit !== null) return hit;
  } catch (e) {
    console.error('kv get', key, e);
  }
  const v = await load();
  try {
    await K.put(key, JSON.stringify(v), { expirationTtl: Math.max(60, ttl) });
  } catch (e) {
    console.error('kv put', key, e);
  }
  return v;
}
async function uncache(key) {
  const K = kv();
  if (K) await K.delete(key).catch((e) => console.error('kv delete', key, e));
}

module.exports = { env, r2, kv, changed, cached, uncache, LAYOUTS_KEY: 'app:layouts:v1' };
