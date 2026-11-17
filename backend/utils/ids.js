const crypto = require('crypto');

/** Human-readable reference like RC-TXN-20261116-7F3A9C */
function makeRef(prefix) {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `RC-${prefix}-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

module.exports = { makeRef };
