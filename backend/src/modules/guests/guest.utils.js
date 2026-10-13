const { normalizeDigits } = require('../../utils/arabic');

function normalizePhone(raw) {
  let p = normalizeDigits(raw).replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (/^01\d{9}$/.test(p)) p = '+2' + p;
  return p;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { normalizePhone, escapeRegex };
