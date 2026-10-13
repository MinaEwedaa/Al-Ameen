const { Guest } = require('../../db/models');
const { E } = require('../../utils/errors');
const { sanitizeText, normalizeArabic } = require('../../utils/arabic');
const {
  normalizeIdNumber,
  encrypt,
  blindIndex,
  maskId,
} = require('../../utils/crypto');
const { audit } = require('../audit/audit.service');
const { normalizePhone, escapeRegex } = require('./guest.utils');

function toGuestDto(guest) {
  return {
    guest_id: String(guest._id),
    name: guest.name,
    phone: guest.phone,
    id_number: maskId(guest.id_number_last4),
  };
}

async function handleDuplicateKey(err, hash) {
  if (err && err.code === 11000) {
    const existing = await Guest.findOne({ id_number_hash: hash });
    const conflict = E.conflict(
      'A guest with this ID number already exists.'
    );

    if (existing) {
      conflict.guest_id = String(existing._id);
    }

    throw conflict;
  }

  throw err;
}

async function createGuest(payload, actorStaffId, ip) {
  const name = sanitizeText(payload.name || '');
  const phone = normalizePhone(payload.phone || '');
  const idNorm = normalizeIdNumber(payload.id_number || '');

  if (!name) throw E.validation('Name is required.');

  if (!/^\+?\d{7,15}$/.test(phone)) {
  throw E.validation('Invalid phone number.');
}
  if (!/^[A-Z0-9]{6,30}$/.test(idNorm)) {
    throw E.validation('Invalid ID number.');
  }

  const hash = blindIndex(idNorm);
  const existing = await Guest.findOne({ id_number_hash: hash });

  if (existing) {
  const err = E.conflict('A guest with this ID number already exists.');
  err.guest_id = String(existing._id);
  throw err;
}
  
  try {
    const guest = await Guest.create({
      name,
      name_search: normalizeArabic(name),
      phone,
      id_number_enc: encrypt(idNorm),
      id_number_hash: hash,
      id_number_last4: idNorm.slice(-4),
    });

    await audit({
      action: 'GUEST_CREATED',
      actorStaffId,
      entity: 'guest',
      entityId: String(guest._id),
      details: {},
      ip,
    });

    return toGuestDto(guest);
  } catch (err) {
    if (err && err.code === 11000) {
      await handleDuplicateKey(err, hash);
    }

    throw err;
  }

}

async function searchGuests(filters, page = 1, limit = 20) {
  const { name, phone, id_number } = filters;
  const conditions = [];

  if (name !== undefined) {
    const q = normalizeArabic(name);
    if (q.length < 2) {
      throw E.validation('Name search must contain at least 2 characters.');
    }
    conditions.push({ name_search: { $regex: escapeRegex(q) } });
  }

  if (phone !== undefined) {
    const q = normalizePhone(phone);
    const digits = q.replace(/\D/g, '');
    if (digits.length < 4) {
      throw E.validation('Phone search must contain at least 4 digits.');
    }
    conditions.push({ phone: { $regex: escapeRegex(q) } });
  }

  if (id_number !== undefined) {
    const idNorm = normalizeIdNumber(id_number);
    if (!/^[A-Z0-9]{6,30}$/.test(idNorm)) {
      throw E.validation('Invalid ID number.');
    }
    conditions.push({ id_number_hash: blindIndex(idNorm) });
  }

  if (!conditions.length) {
    throw E.validation('Provide at least one search filter.');
  }

  const query = { $and: conditions };
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [guests, total] = await Promise.all([
    Guest.find(query)
      .sort({ name_search: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Guest.countDocuments(query),
  ]);

  return {
    guests: guests.map(toGuestDto),
    page: safePage,
    limit: safeLimit,
    total,
  };
}

async function getGuestById(id) {
  const guest = await Guest.findById(id);
  if (!guest) throw E.notFound('Guest not found.');
  return toGuestDto(guest);
}

module.exports = { createGuest, searchGuests, getGuestById };
