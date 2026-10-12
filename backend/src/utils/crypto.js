const crypto = require('crypto');
const env = require('../config/env');
const { normalizeDigits } = require('./arabic');

const normalizeIdNumber = (raw) =>
  normalizeDigits(raw).replace(/[\s-]/g, '').toUpperCase();

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', env.idEncKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
  const [iv, tag, enc] = payload
    .split('.')
    .map((x) => Buffer.from(x, 'base64'));

  const decipher = crypto.createDecipheriv('aes-256-gcm', env.idEncKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/**
 * Blind index: HMAC-SHA256 hash allows exact-match search without decrypting.
 */
const blindIndex = (plain) =>
  crypto.createHmac('sha256', env.idHmacKey).update(plain).digest('hex');

const maskId = (last4) => '*'.repeat(10) + last4;

module.exports = {
  normalizeIdNumber,
  encrypt,
  decrypt,
  blindIndex,
  maskId,
};
