const settingsService = require('./settings.service');

async function getHotel(req, res, next) {
  try {
    const data = await settingsService.getHotelSettings();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateHotel(req, res, next) {
  try {
    const { name, location, floors_count, count_floors } = req.body || {};
    const effectiveFloors = floors_count !== undefined ? floors_count : count_floors;
    const data = await settingsService.updateHotelSettings({
      name,
      location,
      floors_count: effectiveFloors,
      staff: req.auth.staff,
      ip: req.ip,
    });
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getShifts(req, res, next) {
  try {
    const data = await settingsService.getShiftSettings();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updateShifts(req, res, next) {
  try {
    const { morning, evening, night, apply_to_future } = req.body || {};
    const data = await settingsService.updateShiftSettings({
      morning,
      evening,
      night,
      apply_to_future,
      staff: req.auth.staff,
      ip: req.ip,
    });
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHotel,
  updateHotel,
  getShifts,
  updateShifts,
};
