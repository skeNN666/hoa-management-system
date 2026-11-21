/*
 * Durable Object (DO) — нэг өрөө = нэг объект. Дэлхий дээр яг НЭГ хувь нь ажилладаг тул
 * тухайн өрөөнд холбогдсон бүх WebSocket нэг газар цуглаж, мессежийг бүгдэд нь дамжуулна.
 *
 *   • WebSocket Hibernation API (ctx.acceptWebSocket): хэн ч бичихгүй үед объект "унтаж",
 *     холболт тасрахгүй, CPU/төлбөр зарцуулахгүй.
 *   • ctx.storage.sql: объект бүр өөрийн жижиг SQLite-тэй → сүүлийн 50 мессеж хадгалагдана.
 *   • broadcast(): Worker-ээс RPC-ээр дуудна (жишээ: шинэ зарлал нэмэгдэхэд самбар руу түлхэнэ).
 */
import { DurableObject } from 'cloudflare:workers';

const KEEP = 50;

export class ChatRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`);
  }

  /** Worker → stub.fetch(request): WebSocket upgrade */
  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('WebSocket хүлээж байна', { status: 426 });
    const url = new URL(request.url);
    const name = clean(url.searchParams.get('name'), 24) || 'Зочин';

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ name, joined: Date.now() }); // унтаж сэрсэн ч хадгалагдана

    const history = this.ctx.storage.sql
      .exec('SELECT name, text, at FROM messages ORDER BY id DESC LIMIT ?', KEEP)
      .toArray()
      .reverse();
    server.send(JSON.stringify({ type: 'history', messages: history }));
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Холбогдсон хэн нэг мессеж илгээхэд (объект унтаж байсан бол сэрнэ) */
  async webSocketMessage(ws, raw) {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const { name } = ws.deserializeAttachment() || { name: 'Зочин' };
    if (m.type === 'chat') {
      const text = clean(m.text, 500);
      if (!text) return;
      const at = Date.now();
      this.ctx.storage.sql.exec(
        'INSERT INTO messages (name, text, at) VALUES (?, ?, ?)',
        name,
        text,
        at,
      );
      this.ctx.storage.sql.exec(
        'DELETE FROM messages WHERE id <= (SELECT MAX(id) FROM messages) - ?',
        KEEP,
      );
      this.send({ type: 'chat', name, text, at });
    } else if (m.type === 'typing') {
      this.send({ type: 'typing', name }, ws);
    } else if (m.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: m.t }));
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {}
    this.presence(ws);
  }

  async webSocketError(ws) {
    this.presence(ws);
  }

  /** RPC: Worker-ээс `stub.broadcast({...})` */
  async broadcast(msg) {
    this.send(msg);
    return this.ctx.getWebSockets().length;
  }

  /** RPC: хэдэн хүн онлайн */
  async online() {
    return this.ctx.getWebSockets().length;
  }

  send(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(s);
      } catch {}
    }
  }

  presence(gone) {
    const people = this.ctx
      .getWebSockets()
      .filter((ws) => ws !== gone)
      .map((ws) => (ws.deserializeAttachment() || {}).name);
    this.send({ type: 'presence', count: people.length, people }, gone);
  }
}

function clean(v, max) {
  return String(v || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .trim()
    .slice(0, max);
}
