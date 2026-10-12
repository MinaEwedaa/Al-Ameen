const mongoose = require('mongoose');
const { toPiastres, toEgp } = require('../src/utils/money');
const {
  shiftWindow,
  stayDay,
  cairoDate,
  noonCairo,
  nightsBetween,
  stayDays,
} = require('../src/utils/time');
const {
  normalizeDigits,
  sanitizeText,
  normalizeArabic,
} = require('../src/utils/arabic');
const {
  normalizeIdNumber,
  encrypt,
  decrypt,
  blindIndex,
  maskId,
} = require('../src/utils/crypto');
const { Room, RoomNight } = require('../src/db/models');

describe('Feature 1: Domain Utilities & Schemas', () => {
  describe('Money Utils', () => {
    test('converts EGP to Piastres and vice versa correctly', () => {
      expect(toPiastres(4500.5)).toBe(450050);
      expect(toPiastres('4500.50')).toBe(450050);
      expect(toEgp(450050)).toBe(4500.5);
    });

    test('throws error when more than 2 decimal places are provided', () => {
      expect(() => toPiastres(123.456)).toThrow('more than 2 decimals');
    });
  });

  describe('Arabic Normalization & Text Sanitization', () => {
    test('normalizes Eastern and Persian numerals to Western digits', () => {
      expect(normalizeDigits('٠١٠٠١٢٣')).toBe('0100123');
      expect(normalizeDigits('۰۱۲۳۴۵۶')).toBe('0123456');
    });

    test('normalizes Arabic characters with variants and tashkeel', () => {
      expect(normalizeArabic('فاطِمَة')).toBe('فاطمه');
      expect(normalizeArabic('فاطمه')).toBe('فاطمه');
      expect(normalizeArabic('أَحْمَد')).toBe('احمد');
      expect(normalizeArabic('احمد')).toBe('احمد');
    });

    test('strips hidden bidi control characters while preserving valid Arabic', () => {
      const malicious = 'فندق\u202Eالسلام\u200B';
      const clean = sanitizeText(malicious);
      expect(clean).toBe('فندقالسلام');
    });
  });

  describe('Crypto & Blind Index', () => {
    test('normalizes Egyptian ID numbers with spaces and Eastern digits', () => {
      const id1 = normalizeIdNumber('١٢٣٤٥٦٧ ٢٩٨٠١٠١');
      const id2 = normalizeIdNumber('29801011234567');
      expect(id1).toBe('12345672980101');
      expect(id2).toBe('29801011234567');
    });

    test('same normalized ID generates identical blind index HMAC', () => {
      const h1 = blindIndex('29801011234567');
      const h2 = blindIndex('29801011234567');
      expect(h1).toBe(h2);
    });

    test('encrypts and decrypts round-trip with randomized IVs', () => {
      const plain = '29801011234567';
      const enc1 = encrypt(plain);
      const enc2 = encrypt(plain);

      expect(enc1).not.toBe(enc2); // Different IVs produce different ciphertexts
      expect(decrypt(enc1)).toBe(plain);
      expect(decrypt(enc2)).toBe(plain);
    });

    test('masks ID showing last 4 digits', () => {
      expect(maskId('4567')).toBe('**********4567');
    });
  });

  describe('Cairo Time & Shifts Math', () => {
    test('shiftWindow computes correct Cairo start and end boundaries', () => {
      const morning = shiftWindow('2026-10-08', 'morning');
      expect(morning.startAt.toISOString()).toBe('2026-10-08T04:00:00.000Z'); // 07:00 Cairo is UTC+3 in standard time
      expect(morning.endAt.toISOString()).toBe('2026-10-08T13:00:00.000Z'); // 16:00 Cairo

      const night = shiftWindow('2026-10-08', 'night');
      // Starts 23:00 Cairo on 8th, ends 07:00 Cairo on 9th
      expect(cairoDate(night.startAt)).toBe('2026-10-08');
      expect(cairoDate(night.endAt)).toBe('2026-10-09');
    });

    test('stayDay calculates hotel noon-to-noon boundary', () => {
      // 03:00 AM Cairo on 2026-10-09 belongs to 2026-10-08 stay day
      const dateAt0300 = new Date('2026-10-09T00:00:00.000Z'); // 03:00 Cairo (UTC+3)
      expect(stayDay(dateAt0300)).toBe('2026-10-08');

      // 13:00 Cairo on 2026-10-09 belongs to 2026-10-09 stay day
      const dateAt1300 = new Date('2026-10-09T10:00:00.000Z'); // 13:00 Cairo (UTC+3)
      expect(stayDay(dateAt1300)).toBe('2026-10-09');
    });

    test('nightsBetween and stayDays return correct intervals', () => {
      expect(nightsBetween('2026-10-10', '2026-10-13')).toBe(3);
      expect(stayDays('2026-10-10', 3)).toEqual([
        '2026-10-10',
        '2026-10-11',
        '2026-10-12',
      ]);
    });
  });

  describe('Mongoose Unique Index Constraints', () => {
    beforeAll(async () => {
      await Room.syncIndexes();
      await RoomNight.syncIndexes();
    });

    test('enforces uniqueness on Room room_number', async () => {
      await Room.create({
        room_number: '999',
        room_type: 'VIP',
        price_per_night: 200000,
        half_day_price: 100000,
        status: 'available',
      });

      await expect(
        Room.create({
          room_number: '999',
          room_type: 'Normal',
          price_per_night: 150000,
          half_day_price: 75000,
          status: 'available',
        })
      ).rejects.toThrow(/duplicate key/i);
    });

    test('enforces compound uniqueness on RoomNight (room_id, day)', async () => {
      const room = await Room.create({
        room_number: '888',
        room_type: 'Normal',
        price_per_night: 150000,
        half_day_price: 75000,
        status: 'available',
      });

      const resId1 = new mongoose.Types.ObjectId();
      const resId2 = new mongoose.Types.ObjectId();

      await RoomNight.create({
        room_id: room._id,
        day: '2026-10-15',
        reservation_id: resId1,
      });

      // Attempting to book the same room on the same day must throw duplicate key error
      await expect(
        RoomNight.create({
          room_id: room._id,
          day: '2026-10-15',
          reservation_id: resId2,
        })
      ).rejects.toThrow(/duplicate key/i);
    });
  });
});
