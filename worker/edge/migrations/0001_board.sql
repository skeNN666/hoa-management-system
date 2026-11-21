-- D1 (Cloudflare-ийн SQLite) — Хотхоны самбарын зарлалууд.
-- Ажиллуулах:  npm run d1:migrate:local   (локал)   ·   npm run d1:migrate   (Cloudflare дээр)
CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author     TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  image_key  TEXT,                         -- R2 дахь зургийн түлхүүр (posts/<uuid>.jpg)
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL              -- Unix ms
);
CREATE INDEX IF NOT EXISTS posts_created ON posts (created_at DESC);
