const guestService = require('./guest.service');

async function createGuest(req, res, next) {
  try {
    const guest = await guestService.createGuest(
      req.body,
      req.auth.staff._id,
      req.ip
    );
    res.status(201).json(guest);
  } catch (err) {
    next(err);
  }
}

async function searchGuests(req, res, next) {
  try {
    const result = await guestService.searchGuests(
      {
        name: req.query.name,
        phone: req.query.phone,
        id_number: req.query.id_number,
      },
      req.query.page,
      req.query.limit
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getGuestById(req, res, next) {
  try {
    const guest = await guestService.getGuestById(req.params.guest_id);
    res.status(200).json(guest);
  } catch (err) {
    next(err);
  }
}

module.exports = { createGuest, searchGuests, getGuestById };
