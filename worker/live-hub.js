/*
 * LiveHub — Durable Object, хотхон бүрт нэг (idFromName(cx_id)).
 * Тухайн хотхоны нээлттэй бүх хуудас (админ, ажилтан, оршин суугч) WebSocket-оор холбогдоно.
 *
 * Өгөгдөл ДАМЖУУЛАХГҮЙ — зөвхөн «өөрчлөлт гарлаа» дохио ({type:'sync'}). Browser дохио авмагц
 * өөрийн эрхээр /api/sync хийнэ → хэн юуг харах эрхтэй нь хуучнаараа server-ийн шалгалтаар.
 *
 *   Worker (/api/live)  → нэвтрэлт шалгаад stub.fetch(request) → энд WebSocket
 *   Worker (хариуны дараа) → stub.signal() → бүх холболт руу {type:'sync'}
 */
import { DurableObject } from 'cloudflare:workers';

export class LiveHub extends DurableObject {
  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('WebSocket хүлээж байна', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    // Hibernation API: идэвхгүй үед объект унтана, холболт тасрахгүй
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      uid: request.headers.get('x-live-uid') || '',
      role: request.headers.get('x-live-role') || '',
      at: Date.now(),
    });
    server.send(JSON.stringify({ type: 'hello', online: this.ctx.getWebSockets().length }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    // Browser 30 сек тутам ping илгээж холболтоо амьд байлгана
    if (raw === 'ping') ws.send('pong');
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {}
  }

  /** RPC (Worker-ээс): хотхонд өөрчлөлт гарлаа → бүгдэд дохио. → холбогдсон тоо */
  async signal() {
    const s = JSON.stringify({ type: 'sync', at: Date.now() });
    const all = this.ctx.getWebSockets();
    for (const ws of all) {
      try {
        ws.send(s);
      } catch {}
    }
    return all.length;
  }
}
