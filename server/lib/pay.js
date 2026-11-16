/*
 * Төлбөрийн provider.
 *   qpay — QPay v2 (QPAY_CLIENT_ID, QPAY_CLIENT_SECRET, QPAY_INVOICE_CODE, QPAY_URL)
 *          QR болон банкны апп-уудын (Хаан, Голомт, ХасБанк, SocialPay …) холбоосыг өгнө.
 *          Callback-д итгэхгүй: ирэхэд нь QPay API-аас төлөгдсөн эсэхийг дахин шалгана.
 *   mock — хөгжүүлэлтэд (production биш эсвэл PAYMENT_MOCK=1): /api/payments/:id/mock-confirm
 * eBarimt: EBARIMT_URL тохируулсан бол төлөгдсөн гүйлгээг тэр рүү POST хийнэ
 *          (PosAPI 3.0-тай холбогдох өөрийн bridge service). Үгүй бол алгасна.
 */
const { isProd } = require('./notify');

const QPAY_URL = () => (process.env.QPAY_URL || 'https://merchant.qpay.mn').replace(/\/$/, '');
let token = null; // { access, exp }

function provider() {
  if (process.env.QPAY_CLIENT_ID && process.env.QPAY_CLIENT_SECRET) return 'qpay';
  if (!isProd() || process.env.PAYMENT_MOCK === '1') return 'mock';
  return null;
}

async function qpayToken() {
  if (token && token.exp > Date.now() + 60000) return token.access;
  const basic = Buffer.from(process.env.QPAY_CLIENT_ID + ':' + process.env.QPAY_CLIENT_SECRET).toString('base64');
  const r = await fetch(QPAY_URL() + '/v2/auth/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basic },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('QPay token ' + r.status);
  const j = await r.json();
  token = { access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return token.access;
}
async function qpay(pathname, body) {
  const r = await fetch(QPAY_URL() + pathname, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await qpayToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('QPay ' + pathname + ' ' + r.status);
  return r.json();
}

/** Нэхэмжлэх үүсгэнэ → { ref, data: { qr_text, qr_image, urls, short_url } } */
async function create(p, { description, receiver, callbackUrl }) {
  const kind = provider();
  if (kind === 'qpay') {
    const j = await qpay('/v2/invoice', {
      invoice_code: process.env.QPAY_INVOICE_CODE,
      sender_invoice_no: String(p.id),
      invoice_receiver_code: receiver,
      invoice_description: description,
      amount: p.amount,
      callback_url: callbackUrl,
    });
    return {
      kind,
      ref: j.invoice_id,
      data: { qr_text: j.qr_text, qr_image: j.qr_image, urls: j.urls || [], short_url: j.qPay_shortUrl },
    };
  }
  if (kind === 'mock') return { kind, ref: 'mock-' + p.id, data: { mock: true, qr_text: 'MOCK:' + p.id } };
  throw new Error('Төлбөрийн систем тохируулагдаагүй');
}

/** Provider дээр төлөгдсөн эсэх → { paid, data } */
async function check(p) {
  if (p.provider === 'qpay') {
    const j = await qpay('/v2/payment/check', {
      object_type: 'INVOICE',
      object_id: p.provider_ref,
      offset: { page_number: 1, page_limit: 100 },
    });
    const rows = (j.rows || []).filter((r) => r.payment_status === 'PAID');
    const sum = rows.reduce((a, r) => a + Number(r.payment_amount || 0), 0);
    return { paid: sum >= p.amount, data: { qpay_payments: rows.map((r) => r.payment_id), paid_amount: sum } };
  }
  return { paid: false, data: {} };
}

/** eBarimt (НӨАТ-ын баримт) */
async function ebarimt(p, unit) {
  if (!process.env.EBARIMT_URL) return null;
  try {
    const r = await fetch(process.env.EBARIMT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.EBARIMT_TOKEN ? { Authorization: 'Bearer ' + process.env.EBARIMT_TOKEN } : {}),
      },
      body: JSON.stringify({
        payment_id: p.id,
        amount: p.amount,
        description: 'СӨХ-ийн төлбөр · ' + (unit ? unit.b + '-' + unit.n : ''),
        phone: unit ? unit.phone : '',
      }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok ? await r.json() : { error: 'HTTP ' + r.status };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

module.exports = { provider, create, check, ebarimt };
