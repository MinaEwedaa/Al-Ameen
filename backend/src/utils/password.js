const argon2 = require('argon2');
const crypto = require('crypto');

const hashPassword = (plain) =>
  argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const generatePassword = (len = 16) =>
  Array.from({ length: len }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

const isStrong = (p) =>
  Boolean(p && p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p));

module.exports = {
  hashPassword,
  generatePassword,
  isStrong,
};
