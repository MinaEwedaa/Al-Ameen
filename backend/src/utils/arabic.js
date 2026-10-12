const AR = '٠١٢٣٤٥٦٧٨٩';
const FA = '۰۱۲۳۴۵۶۷۸۹';

const normalizeDigits = (s) =>
  String(s).replace(/[٠-٩۰-۹]/g, (ch) =>
    String(AR.indexOf(ch) >= 0 ? AR.indexOf(ch) : FA.indexOf(ch))
  );

/**
 * Strips hidden/bidi control characters and performs Unicode NFC normalization.
 */
const sanitizeText = (s) =>
  String(s)
    .normalize('NFC')
    .replace(
      /[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
      ''
    )
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Normalizes Arabic text for searchable fields:
 * - strips tashkeel/diacritics and tatweel
 * - normalizes Alef, Yaa, Taa Marbuta variants
 * - converts Eastern numerals
 */
const normalizeArabic = (s) =>
  normalizeDigits(sanitizeText(s))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();

module.exports = {
  normalizeDigits,
  sanitizeText,
  normalizeArabic,
};
