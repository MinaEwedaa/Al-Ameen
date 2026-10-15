const shiftService = require('./shift.service');
const { getNow } = require('../../utils/clock');
async function getCurrentShift(req, res, next) {
  try {
    const shift = await shiftService.getCurrentShift(req.auth.staff._id);
    res.status(200).json(shift);
  } catch (err) {
    next(err);
  }
}

async function getShiftSummary(req, res, next) {
  try {
    const summary = await shiftService.getShiftSummary(req.auth.staff, req.auth.session);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

async function handoverShift(req, res, next) {
  try {
    const now = getNow(req);
    const updated = await shiftService.handoverShift({
      staff: req.auth.staff,
      session: req.auth.session,
      shiftNotes: req.body?.shift_notes,
      now,
      ip: req.ip,
    });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function getShiftReport(req, res, next) {
  try {
    const { pdfBuffer, filename } = await shiftService.getShiftReport(
      req.auth.staff,
      req.params.shift_id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCurrentShift,
  getShiftSummary,
  handoverShift,
  getShiftReport,
};
