// Worker дээр PGlite хэрэггүй (үргэлж Hyperdrive → Postgres). Bundle-д орохгүйн тулд wrangler alias.
module.exports = {
  PGlite: class {
    constructor() {
      throw new Error('PGlite Worker дээр ажиллахгүй — HYPERDRIVE binding шалгана уу');
    }
  },
};
