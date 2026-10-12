/**
 * Currency utilities:
 * Money is stored as integer Piastres (1 EGP = 100 Piastres).
 * EGP conversion happens only when serializing outgoing response DTOs.
 */

const toPiastres = (egp) => {
  const p = Math.round(Number(egp) * 100);
  if (Math.abs(Number(egp) * 100 - p) > 1e-6) {
    throw new Error('more than 2 decimals');
  }
  return p;
};

const toEgp = (p) => Number((p / 100).toFixed(2));

module.exports = { toPiastres, toEgp, toEGP: toEgp };
