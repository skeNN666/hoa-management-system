/*
 * СӨХ Platform — Cloudflare Worker.
 *   • Статик файл (dist/)  → Workers Static Assets (wrangler.jsonc → assets), Worker ажиллахгүй
 *   • /api/*               → энд → server/app.js-ийн handle() (локал server-тэй яг ижил код)
 *   • DB                   → Hyperdrive (env.HYPERDRIVE) → Neon Postgres; хүсэлт бүрт шинэ pool
 *   • Cron Trigger         → /api/cron/daily (өдөр бүр 09:00 УБ)
 */
import './setup.js';
import { scope } from './setup.js';
import { makeReq, makeRes } from './node-adapter.js';
import app from '../server/app.js';
import db from '../server/db.js';

async function api(request, env, ctx) {
  if (!env.HYPERDRIVE) return Response.json({ error: 'HYPERDRIVE binding алга' }, { status: 500 });
  const url = new URL(request.url);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const pool = db.makePool(env.HYPERDRIVE.connectionString);
  let req;
  const res = makeRes(() => req && req._close());
  req = makeReq(request, url, ip);
  const run = scope.run({ pool }, () => app.handle(req, res));
  // Холболтыг хариу бүрэн дууссаны дараа хаана (SSE урт хугацаанд ажиллаж болно)
  ctx.waitUntil(
    run
      .catch((e) => console.error(e))
      .finally(() => {
        if (!res.headersSent) res.end(JSON.stringify({ error: 'Серверийн алдаа' }));
        return pool.end().catch(() => {});
      }),
  );
  return res.done;
}

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
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
