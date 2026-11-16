/*
 * Fetch API (Request / Response) ↔ Node http (req / res) адаптер.
 * server/app.js-ийн handle(req, res) нь Node-ийн req/res-ийг хүлээдэг тул Worker дээр
 * яг тэр кодыг өөрчлөхгүйгээр ажиллуулна. Ашиглагддаг хэсэг нь:
 *   req: method, url, headers, socket, on('data'|'end'|'error'|'close'), destroy()
 *   res: statusCode, setHeader, getHeader, writeHead, write, end, headersSent, writableEnded
 */
import { Buffer } from 'node:buffer';

const toBytes = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : new Uint8Array(x));
// Worker өөрөө тооцдог / hop-by-hop header-ууд
const DROP = new Set(['content-length', 'connection', 'transfer-encoding', 'keep-alive']);

export function makeReq(request, url, ip) {
  const handlers = {};
  let started = false,
    destroyed = false;
  const headers = {};
  request.headers.forEach((v, k) => (headers[k] = v));
  const emit = (ev, ...a) => (handlers[ev] || []).forEach((h) => h(...a));

  async function pump() {
    try {
      if (request.body) {
        const r = request.body.getReader();
        for (;;) {
          const { done, value } = await r.read();
          if (done || destroyed) break;
          emit('data', Buffer.from(value));
        }
      }
      if (!destroyed) emit('end');
    } catch (e) {
      emit('error', e);
    }
  }

  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    socket: { remoteAddress: ip, encrypted: url.protocol === 'https:' },
    on(ev, cb) {
      (handlers[ev] = handlers[ev] || []).push(cb);
      // body-г анхны 'data'/'end' сонсогч бүртгэгдсэний дараа уншиж эхэлнэ
      if ((ev === 'data' || ev === 'end') && !started) {
        started = true;
        queueMicrotask(pump);
      }
      return req;
    },
    destroy() {
      destroyed = true;
    },
    _close: () => emit('close'),
  };
  return req;
}

export function makeRes(onClose) {
  let resolve;
  const done = new Promise((r) => (resolve = r));
  const headers = new Headers();
  let writer = null;

  const respond = (body) => {
    for (const k of DROP) headers.delete(k);
    resolve(new Response(body, { status: res.statusCode, headers }));
  };
  const start = () => {
    if (res.headersSent) return;
    res.headersSent = true;
    const ts = new TransformStream();
    writer = ts.writable.getWriter();
    respond(ts.readable);
  };

  const res = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    done,
    setHeader(k, v) {
      if (Array.isArray(v)) {
        headers.delete(k);
        v.forEach((x) => headers.append(k, String(x)));
      } else headers.set(k, String(v));
    },
    getHeader(k) {
      if (String(k).toLowerCase() === 'set-cookie') {
        const a = headers.getSetCookie();
        return a.length ? a : undefined;
      }
      const v = headers.get(k);
      return v == null ? undefined : v;
    },
    writeHead(code, h) {
      res.statusCode = code;
      for (const k in h || {}) res.setHeader(k, h[k]);
      start();
      return res;
    },
    write(chunk) {
      start();
      writer.write(toBytes(chunk)).catch(onClose);
      return true;
    },
    end(chunk) {
      if (res.writableEnded) return;
      res.writableEnded = true;
      if (!res.headersSent) {
        res.headersSent = true;
        return respond(chunk == null ? null : toBytes(chunk));
      }
      if (chunk != null) writer.write(toBytes(chunk)).catch(() => {});
      writer.close().catch(() => {});
    },
  };
  return res;
}
