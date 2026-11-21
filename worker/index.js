/*
 * СӨХ Platform — Cloudflare Worker.
 *   • Статик файл (dist/)  → Workers Static Assets (wrangler.jsonc → assets), Worker ажиллахгүй
 *   • /api/*               → энд → server/app.js-ийн handle() (локал server-тэй яг ижил код)
 *   • DB                   → Hyperdrive (env.HYPERDRIVE) → Neon Postgres; хүсэлт бүрт шинэ pool
 *   • Cron Trigger         → /api/cron/daily (өдөр бүр 09:00 УБ)
 *   • /api/edge/*          → worker/edge/ (D1 · R2 · KV · Durable Object жишээ, edge.html)
 *
 * Үндсэн системд Cloudflare-ийн үйлчилгээ (server/lib/edge.js-ээр):
 *   • R2  (env.FILES) → хүсэлт, map-ын зураг (Postgres-д зөвхөн мета)
 *   • KV  (env.KV)    → /api/layouts кэш (хуудас бүр ачаалахдаа татдаг)
 *   • DO  (env.LIVE)  → /api/live WebSocket: хотхонд өөрчлөлт гармагц бүх browser-т шууд дохио
 */
import './setup.js';
import { scope } from './setup.js';
import { makeReq, makeRes } from './node-adapter.js';
import app from '../server/app.js';
import db from '../server/db.js';
import auth from '../server/lib/auth.js';
import { parseCookies } from '../server/lib/http.js';
import { handleEdge } from './edge/index.js';

// Durable Object класс main модулиас export хийгдсэн байх ёстой (wrangler.jsonc → durable_objects)
export { ChatRoom } from './edge/index.js';
export { LiveHub } from './live-hub.js';

async function api(request, env, ctx) {
  if (!env.HYPERDRIVE) return Response.json({ error: 'HYPERDRIVE binding алга' }, { status: 500 });
  const url = new URL(request.url);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const pool = db.makePool(env.HYPERDRIVE.connectionString);
  let req;
  const res = makeRes(() => req && req._close());
  req = makeReq(request, url, ip);
  // env: server/lib/edge.js-ээр R2/KV-д хандана; dirty: өөрчлөлт гарсан хотхонууд (touch/notify)
  const store = { pool, env, dirty: null };
  const run = scope.run(store, () => app.handle(req, res));
  // Холболтыг хариу бүрэн дууссаны дараа хаана (SSE урт хугацаанд ажиллаж болно)
  ctx.waitUntil(
    run
      .catch((e) => console.error(e))
      .finally(() => {
        if (!res.headersSent) res.end(JSON.stringify({ error: 'Серверийн алдаа' }));
        return Promise.all([pool.end().catch(() => {}), signal(env, store.dirty)]);
      }),
  );
  return res.done;
}

/** Өөрчлөлт гарсан хотхон бүрийн LiveHub руу нэг дохио (хариу илгээгдсэний дараа) */
function signal(env, dirty) {
  if (!env.LIVE || !dirty || !dirty.size) return null;
  return Promise.all(
    [...dirty].map((cx) =>
      env.LIVE.get(env.LIVE.idFromName(cx))
        .signal()
        .catch((e) => console.error('live signal', cx, e)),
    ),
  );
}

/** GET /api/live — WebSocket. Session cookie-оор нэвтрэлт шалгаад хотхоных нь LiveHub руу */
async function live(request, env) {
  if (!env.LIVE || !env.HYPERDRIVE) return Response.json({ error: 'LIVE binding алга' }, { status: 503 });
  if (request.headers.get('upgrade') !== 'websocket')
    return Response.json({ error: 'WebSocket шаардлагатай' }, { status: 426 });
  const pool = db.makePool(env.HYPERDRIVE.connectionString);
  let me;
  try {
    me = await scope.run({ pool, env }, () =>
      auth.sessionUser({ cookies: parseCookies(request.headers.get('cookie')) }),
    );
  } finally {
    pool.end().catch(() => {});
  }
  if (!me) return Response.json({ error: 'Нэвтэрнэ үү' }, { status: 401 });
  const h = new Headers(request.headers);
  h.set('x-live-uid', me.id);
  h.set('x-live-role', me.role);
  return env.LIVE.get(env.LIVE.idFromName(me.cx_id)).fetch(new Request(request, { headers: h }));
}

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/edge' || pathname.startsWith('/api/edge/'))
      return handleEdge(request, env, ctx);
    if (pathname === '/api/live') return live(request, env);
    if (pathname === '/api' || pathname.startsWith('/api/')) return api(request, env, ctx);
    // assets-д байхгүй (run_worker_first-ээс гадуур ирсэн) зам
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    const r = await api(
      new Request('https://cron.internal/api/cron/daily', {
        headers: { authorization: 'Bearer ' + (env.CRON_SECRET || '') },
      }),
      env,
      ctx,
    );
    console.log('cron', r.status, (await r.text()).slice(0, 2000));
  },
};
