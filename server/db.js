/*
 * СӨХ Platform — өгөгдлийн сан (PostgreSQL).
 *   • DATABASE_URL байвал → pg   (production: Cloudflare Worker + Hyperdrive → Neon)
 *   • байхгүй бол         → PGlite (Node дотор ажилладаг Postgres — хөгжүүлэлт, тест)
 *       PGLITE_DIR=memory  → санах ойд (тест);  default: server/data/pg
 *
 *   await db.query(sql, params)          → { rows }
 *   await db.tx(async (q) => q(sql, p))  → гүйлгээ (алдаа гарвал бүгд буцна)
 * Анхаар: гүйлгээн дотор зөвхөн q-г ашиглана (PGlite нэг холболттой тул db.query түгжинэ).
 *
 * Cloudflare Worker (worker/index.js): холболтыг хүсэлт хооронд хуваалцаж болохгүй тул worker нь
 * хүсэлт бүрт db.makePool()-оор pool үүсгээд globalThis.__SOKH_DB_SCOPE (AsyncLocalStorage)-д
 * хийнэ; migration-ыг globalThis.__SOKH_MIGRATIONS ([{ name, sql }])-аас уншина (fs байхгүй).
 */
const fs = require('fs');
const path = require('path');

// Worker (ESM bundle) дээр __dirname байхгүй — тэнд migration, PGlite-ийг файлаас уншдаггүй
const HERE = typeof __dirname === 'string' ? __dirname : '.';
const MIG = path.join(HERE, 'migrations');
let impl = null;
let readyP = null;

let pgTypesSet = false;
function makePool(url) {
  const { Pool, types } = require('pg');
  if (!pgTypesSet) {
    // pg-ийн type parser нь process-д нэг л удаа (pool бүрт биш) бүртгэгдэнэ
    types.setTypeParser(20, Number); // int8 (count(*)) → Number
    types.setTypeParser(1700, Number); // numeric → Number
    pgTypesSet = true;
  }
  return new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX) || 3 });
}

function connect() {
  const url = process.env.DATABASE_URL;
  const scope = globalThis.__SOKH_DB_SCOPE;
  if (scope || url) {
    const shared = scope ? null : makePool(url);
    const getPool = () => {
      if (shared) return shared;
      const st = scope.getStore();
      if (!st || !st.pool) throw new Error('DB pool байхгүй (worker scope-оос гадуур)');
      return st.pool;
    };
    const wrap = (c) => {
      const q = (t, p) => c.query(t, p);
      q.exec = (sql) => c.query(sql);
      return q;
    };
    return {
      kind: 'pg',
      query: (t, p) => getPool().query(t, p),
      async tx(fn) {
        const c = await getPool().connect();
        try {
          await c.query('begin');
          const r = await fn(wrap(c));
          await c.query('commit');
          return r;
        } catch (e) {
          await c.query('rollback').catch(() => {});
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => (shared ? shared.end() : undefined),
    };
  }
  const { PGlite } = require('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || path.join(HERE, 'data', 'pg');
  let db;
  if (dir === 'memory') db = new PGlite();
  else {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    db = new PGlite(dir);
  }
  return {
    kind: 'pglite',
    query: (t, p) => db.query(t, p),
    tx: (fn) =>
      db.transaction((tx) => {
        const q = (t, p) => tx.query(t, p);
        q.exec = (sql) => tx.exec(sql);
        return fn(q);
      }),
    close: () => db.close(),
  };
}

async function migrate(d) {
  await d.query(
    'create table if not exists _migrations (name text primary key, at timestamptz not null default now())',
  );
  const list =
    globalThis.__SOKH_MIGRATIONS ||
    fs
      .readdirSync(MIG)
      .filter((f) => f.endsWith('.sql'))
      .map((name) => ({ name, sql: () => fs.readFileSync(path.join(MIG, name), 'utf8') }));
  const files = list.map((m) => m.name).sort();
  const sqlOf = (f) => {
    const m = list.find((x) => x.name === f);
    return typeof m.sql === 'function' ? m.sql() : m.sql;
  };
  const done = new Set((await d.query('select name from _migrations')).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    await d.tx(async (q) => {
      await q('select pg_advisory_xact_lock(77310)'); // хоёр instance зэрэг ажиллуулахгүй
      if ((await q('select 1 from _migrations where name = $1', [f])).rows.length) return;
      await q.exec(sqlOf(f));
      await q('insert into _migrations (name) values ($1)', [f]);
    });
  }
}

function ready() {
  if (!readyP)
    readyP = (async () => {
      impl = connect();
      await migrate(impl);
      return impl;
    })().catch((e) => {
      readyP = null; // дараагийн хүсэлт дахин оролдоно
      throw e;
    });
  return readyP;
}

module.exports = {
  ready,
  makePool,
  async query(t, p) {
    return (await ready()).query(t, p);
  },
  async tx(fn) {
    return (await ready()).tx(fn);
  },
  async close() {
    if (!readyP) return;
    const d = await readyP.catch(() => null);
    readyP = null;
    impl = null;
    if (d) await d.close();
  },
  get kind() {
    return impl
      ? impl.kind
      : process.env.DATABASE_URL || globalThis.__SOKH_DB_SCOPE
        ? 'pg'
        : 'pglite';
  },
};
