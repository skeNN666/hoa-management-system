/*
 * Vercel Function — бүх /api/* хүсэлт энд ирнэ (vercel.json → rewrites).
 * Логик нь server/app.js-д (локал server-тэй ижил).
 */
const { handle } = require('../server/app');

module.exports = (req, res) => handle(req, res);
