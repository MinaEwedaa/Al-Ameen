const shiftService = require('./shift.service');

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
    const summary = await shiftService.getShiftSummary(req.auth.staff);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

async function handoverShift(req, res, next) {
  try {
    const now = req.headers['x-test-time']
      ? new Date(req.headers['x-test-time'])
      : new Date();
    const updated = await shiftService.handoverShift(
      req.auth.staff,
      req.body?.shift_notes,
      now
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function getShiftReport(req, res, next) {
  try {
    const pdfBuffer = await shiftService.getShiftReport(
      req.auth.staff,
      req.params.shift_id
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shift-report-${req.params.shift_id}.pdf"`
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
