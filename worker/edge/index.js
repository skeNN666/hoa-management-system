/*
 * Хотхоны самбар — Cloudflare-ийн 5 үйлчилгээг нэг дор ашигласан жишээ API (/api/edge/*).
 * Postgres (Hyperdrive) огт хэрэглэхгүй тул үндсэн системээс тусдаа ажиллана.
 *
 *   Worker  → энэ файл: URL-ээр endpoint сонгож, JSON буцаана
 *   D1      → env.DB     зарлалууд (SQL хүснэгт)               worker/edge/migrations/*.sql
 *   R2      → env.FILES  хэрэглэгчийн илгээсэн зураг (том файл)
 *   KV      → env.KV     зарлалын жагсаалтын кэш + баннер (хурдан унших, ховор бичих)
 *   DO      → env.CHAT   realtime чат + самбарын шууд мэдэгдэл (WebSocket)  worker/edge/chat-room.js
 *
 * Endpoint-ууд:
 *   GET    /api/edge/health            бүх binding ажиллаж байгаа эсэх + хугацаа (ms)
 *   GET    /api/edge/posts             KV кэш → (байхгүй бол) D1           X-Cache: HIT | MISS
 *   POST   /api/edge/posts             {author, title, body, imageKey?} → D1, кэш устгах, DO мэдэгдэл
 *   POST   /api/edge/posts/:id/like    D1 UPDATE
 *   DELETE /api/edge/posts/:id         D1 + R2 зураг устгах
 *   POST   /api/edge/upload            body = зураг (image/*) → R2       → {key, url}
 *   GET    /api/edge/files/<key>       R2-оос зураг (ETag, кэш)
 *   GET    /api/edge/banner            KV
 *   PUT    /api/edge/banner            {text, tone} → KV
 *   GET    /api/edge/chat/:room        WebSocket → Durable Object (өрөө бүр тусдаа объект)
 *
 * Нууц (заавал биш): EDGE_ADMIN_KEY тавибал баннер солих, зарлал устгахад
 * `X-Edge-Key` толгой шаардана.   npx wrangler@4 secret put EDGE_ADMIN_KEY
 */
export { ChatRoom } from './chat-room.js';

const LIST_KEY = 'board:posts:v1';
const BANNER_KEY = 'board:banner';
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const routes = [];
function on(method, pattern, fn) {
  const keys = [];
  const re = new RegExp(
    '^/api/edge' +
      pattern.replace(/:(\w+)(\+)?/g, (_, k, rest) => (keys.push(k), rest ? '(.+)' : '([^/]+)')) +
      '/?$',
  );
  routes.push({ method, re, keys, fn });
}

export async function handleEdge(request, env, ctx) {
  const url = new URL(request.url);
  const t0 = Date.now();
  let res;
  try {
    const route = routes.find((r) => r.method === request.method && r.re.test(url.pathname));
    if (!route) {
      const any = routes.some((r) => r.re.test(url.pathname));
      throw new HttpError(any ? 405 : 404, any ? 'Method буруу' : 'Endpoint олдсонгүй');
    }
    const m = url.pathname.match(route.re);
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    res = await route.fn({ request, env, ctx, url, params });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error('edge', url.pathname, e);
    let message = e.status ? e.message : 'Серверийн алдаа: ' + (e.message || e);
    if (/no such table/i.test(String(e.message)))
      message = 'D1 хүснэгт алга — `npm run d1:migrate:local` ажиллуулна уу';
    res = json({ error: message }, status);
  }
  if (res.status === 101) return res; // WebSocket — толгой өөрчилж болохгүй
  const h = new Headers(res.headers);
  h.set('X-Edge-Time', String(Date.now() - t0));
  const colo = request.cf && request.cf.colo;
  if (colo) h.set('X-Edge-Colo', colo); // аль дата төвд ажилласан (жишээ: HKG, NRT)
  return new Response(res.body, { status: res.status, headers: h });
}

/* ---------------------------------------------------------------- health */
on('GET', '/health', async ({ env, request }) => {
  const check = async (name, fn) => {
    if (!fn) return { name, ok: false, error: 'binding алга (wrangler.jsonc)' };
    const t = Date.now();
    try {
      const info = await fn();
      return { name, ok: true, ms: Date.now() - t, info };
    } catch (e) {
      return { name, ok: false, ms: Date.now() - t, error: String(e.message || e) };
    }
  };
  const services = await Promise.all([
    check('Worker', async () => (request.cf && request.cf.colo) || 'local'),
    check(
      'D1',
      env.DB &&
        (async () => {
          const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM posts').first();
          return r.n + ' зарлал';
        }),
    ),
    check(
      'R2',
      env.FILES &&
        (async () => {
          const r = await env.FILES.list({ prefix: 'posts/', limit: 100 });
          return r.objects.length + (r.truncated ? '+' : '') + ' файл';
        }),
    ),
    check(
      'KV',
      env.KV &&
        (async () => {
          const v = await env.KV.get(LIST_KEY);
          return v ? 'кэш бий' : 'кэш хоосон';
        }),
    ),
    check('DO', env.CHAT && (async () => (await room(env, 'board').online()) + ' онлайн')),
  ]);
  return json({ services, time: new Date().toISOString() });
});

/* ---------------------------------------------------------------- posts: D1 + KV кэш */
on('GET', '/posts', async ({ env, ctx }) => {
  need(env, 'DB', 'KV');
  // 1) KV-ээс унших — дэлхийн бүх дата төвд хуулбарлагддаг, маш хурдан
  const cached = await env.KV.get(LIST_KEY, { type: 'json' });
  if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });

  // 2) Кэш байхгүй → D1 (SQL)
  const { results } = await env.DB.prepare(
    'SELECT id, author, title, body, image_key, likes, created_at FROM posts ORDER BY created_at DESC LIMIT 50',
  ).all();
  const data = { posts: results.map(toPost), cachedAt: Date.now() };
  // 3) KV-д 60 сек хадгална (хамгийн бага TTL = 60). Хариуг хүлээлгэхгүй — waitUntil
  ctx.waitUntil(env.KV.put(LIST_KEY, JSON.stringify(data), { expirationTtl: 60 }));
  return json(data, 200, { 'X-Cache': 'MISS' });
});

on('POST', '/posts', async ({ request, env, ctx }) => {
  need(env, 'DB', 'KV');
  const b = await body(request);
  const author = text(b.author, 40, 'Нэр');
  const title = text(b.title, 120, 'Гарчиг');
  const content = String(b.body || '')
    .trim()
    .slice(0, 2000);
  let imageKey = b.imageKey ? String(b.imageKey) : null;
  if (imageKey && !/^posts\/[\w-]+\.(jpg|png|webp|gif)$/.test(imageKey))
    throw new HttpError(400, 'Зургийн түлхүүр буруу');

  // Prepared statement + bind → SQL injection-оос хамгаална
  const row = await env.DB.prepare(
    `INSERT INTO posts (author, title, body, image_key, created_at) VALUES (?, ?, ?, ?, ?)
     RETURNING id, author, title, body, image_key, likes, created_at`,
  )
    .bind(author, title, content, imageKey, Date.now())
    .first();
  const post = toPost(row);

  // Кэш хуучирсан → устгана. Realtime: самбарт холбогдсон бүх browser-т DO-оор түлхэнэ.
  ctx.waitUntil(
    Promise.all([
      env.KV.delete(LIST_KEY),
      env.CHAT ? room(env, 'board').broadcast({ type: 'post', post }) : null,
    ]),
  );
  return json({ post }, 201);
});

on('POST', '/posts/:id/like', async ({ env, ctx, params }) => {
  need(env, 'DB', 'KV');
  const row = await env.DB.prepare(
    'UPDATE posts SET likes = likes + 1 WHERE id = ? RETURNING id, likes',
  )
    .bind(Number(params.id))
    .first();
  if (!row) throw new HttpError(404, 'Зарлал олдсонгүй');
  ctx.waitUntil(
    Promise.all([
      env.KV.delete(LIST_KEY),
      env.CHAT
        ? room(env, 'board').broadcast({ type: 'like', id: row.id, likes: row.likes })
        : null,
    ]),
  );
  return json(row);
});

on('DELETE', '/posts/:id', async ({ request, env, ctx, params }) => {
  need(env, 'DB', 'KV');
  admin(request, env);
  const row = await env.DB.prepare('DELETE FROM posts WHERE id = ? RETURNING id, image_key')
    .bind(Number(params.id))
    .first();
  if (!row) throw new HttpError(404, 'Зарлал олдсонгүй');
  ctx.waitUntil(
    Promise.all([
      env.KV.delete(LIST_KEY),
      row.image_key && env.FILES ? env.FILES.delete(row.image_key) : null,
      env.CHAT ? room(env, 'board').broadcast({ type: 'delete', id: row.id }) : null,
    ]),
  );
  return json({ ok: true, id: row.id });
});

/* ---------------------------------------------------------------- R2: зураг */
on('POST', '/upload', async ({ request, env, url }) => {
  need(env, 'FILES');
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) throw new HttpError(415, 'Зөвхөн JPG, PNG, WEBP, GIF зураг');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_IMAGE) throw new HttpError(413, 'Зураг 5MB-аас ихгүй байх ёстой');
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) throw new HttpError(400, 'Файл хоосон');
  if (buf.byteLength > MAX_IMAGE) throw new HttpError(413, 'Зураг 5MB-аас ихгүй байх ёстой');

  const key = `posts/${crypto.randomUUID()}.${ext}`;
  const name = (url.searchParams.get('name') || '').slice(0, 120);
  await env.FILES.put(key, buf, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { originalName: name, uploadedAt: new Date().toISOString() },
  });
  return json({ key, url: '/api/edge/files/' + key, size: buf.byteLength, type }, 201);
});

on('GET', '/files/:key+', async ({ request, env, params }) => {
  need(env, 'FILES');
  const obj = await env.FILES.get(params.key, { onlyIf: request.headers });
  if (!obj) throw new HttpError(404, 'Файл олдсонгүй');
  const h = new Headers();
  obj.writeHttpMetadata(h); // content-type, cache-control (put үед өгсөн)
  h.set('ETag', obj.httpEtag);
  h.set('X-Content-Type-Options', 'nosniff');
  // If-None-Match таарвал body ирэхгүй → 304 (browser өөрийн кэшээ ашиглана)
  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers: h });
  h.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers: h });
});

/* ---------------------------------------------------------------- KV: баннер */
on('GET', '/banner', async ({ env }) => {
  need(env, 'KV');
  // cacheTtl: тухайн дата төв KV-гийн утгыг 5 мин санах ойдоо барина → бүр хурдан
  const b = await env.KV.get(BANNER_KEY, { type: 'json', cacheTtl: 300 });
  return json(b || { text: '', tone: 'info', updatedAt: null });
});

on('PUT', '/banner', async ({ request, env, ctx }) => {
  need(env, 'KV');
  admin(request, env);
  const b = await body(request);
  const tone = ['info', 'ok', 'warn', 'bad'].includes(b.tone) ? b.tone : 'info';
  const data = {
    text: String(b.text || '')
      .trim()
      .slice(0, 200),
    tone,
    updatedAt: Date.now(),
  };
  await env.KV.put(BANNER_KEY, JSON.stringify(data));
  if (env.CHAT) ctx.waitUntil(room(env, 'board').broadcast({ type: 'banner', banner: data }));
  return json(data);
});

/* ---------------------------------------------------------------- DO: realtime чат */
on('GET', '/chat/:room', async ({ request, env, params }) => {
  need(env, 'CHAT');
  if (request.headers.get('upgrade') !== 'websocket')
    throw new HttpError(426, 'WebSocket холболт шаардлагатай');
  const name = params.room.toLowerCase();
  if (!/^[a-z0-9-]{1,32}$/.test(name)) throw new HttpError(400, 'Өрөөний нэр: a-z, 0-9, - (≤32)');
  // Нэр → ID: ижил нэртэй өрөө үргэлж ижил объект руу очно
  return room(env, name).fetch(request);
});

/* ---------------------------------------------------------------- туслах */
function room(env, name) {
  return env.CHAT.get(env.CHAT.idFromName(name));
}
function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}
function need(env, ...names) {
  const miss = names.filter((n) => !env[n]);
  if (miss.length)
    throw new HttpError(503, 'Binding алга: ' + miss.join(', ') + ' (wrangler.jsonc)');
}
function admin(request, env) {
  if (env.EDGE_ADMIN_KEY && request.headers.get('x-edge-key') !== env.EDGE_ADMIN_KEY)
    throw new HttpError(403, 'X-Edge-Key буруу');
}
async function body(request) {
  // CSRF: өөр сайтын <form> application/json илгээж чадахгүй
  if (!(request.headers.get('content-type') || '').includes('application/json'))
    throw new HttpError(415, 'JSON илгээнэ үү');
  const raw = await request.text();
  if (raw.length > 64 * 1024) throw new HttpError(413, 'Хэт том');
  try {
    const x = JSON.parse(raw || '{}');
    if (x && typeof x === 'object' && !Array.isArray(x)) return x;
  } catch {}
  throw new HttpError(400, 'Буруу JSON');
}
function text(v, max, label) {
  const s = String(v || '')
    .trim()
    .slice(0, max);
  if (!s) throw new HttpError(400, label + ' хоосон байна');
  return s;
}
function toPost(r) {
  return {
    id: r.id,
    author: r.author,
    title: r.title,
    body: r.body,
    image: r.image_key ? '/api/edge/files/' + r.image_key : null,
    imageKey: r.image_key,
    likes: r.likes,
    createdAt: r.created_at,
  };
}
