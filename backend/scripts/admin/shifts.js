const mongoose = require('mongoose');
const { Staff, Shift, ShiftException, ShiftReport } = require('../../src/db/models');
const { guard } = require('./guard');
const shiftService = require('../../src/modules/shifts/shift.service');
const pdfUtils = require('../../src/utils/pdf');

async function addException({ username, date, shiftType, kind, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'ADD_EXCEPTION',
    details: { username, date, shift_type: shiftType, kind },
  });

  const staff = await Staff.findOne({ username });
  if (!staff) {
    throw new Error(`Staff member with username '${username}' not found.`);
  }

  const validKinds = ['cancel', 'swap', 'extra'];
  if (!validKinds.includes(kind)) {
    throw new Error(`Invalid kind '${kind}'. Must be one of: ${validKinds.join(', ')}.`);
  }

  const exception = await ShiftException.create({
    staff_id: staff._id,
    shift_date: date,
    shift_type: shiftType,
    kind,
  });

  return {
    exception_id: String(exception._id),
    username: staff.username,
    shift_date: exception.shift_date,
    shift_type: exception.shift_type,
    kind: exception.kind,
  };
}

async function reopenShift({ shiftId, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'REOPEN_SHIFT',
    details: { shift_id: shiftId },
  });

  if (!mongoose.isValidObjectId(shiftId)) {
    throw new Error(`Invalid shift ID format: '${shiftId}'.`);
  }

  const shift = await Shift.findById(shiftId);
  if (!shift) {
    throw new Error(`Shift with ID '${shiftId}' not found.`);
  }

  shift.status = 'active';
  shift.handed_over_at = null;
  shift.report_status = 'pending';
  await shift.save();

  // Delete previous shift report document to allow clean regeneration upon new handover
  await ShiftReport.deleteMany({ shift_id: shift._id });

  return {
    shift_id: String(shift._id),
    status: shift.status,
    report_status: shift.report_status,
  };
}

async function regenerateReport({ shiftId, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'REGENERATE_REPORT',
    details: { shift_id: shiftId },
  });

  if (!mongoose.isValidObjectId(shiftId)) {
    throw new Error(`Invalid shift ID format: '${shiftId}'.`);
  }

  const shift = await Shift.findById(shiftId);
  if (!shift) {
    throw new Error(`Shift with ID '${shiftId}' not found.`);
  }

  const staff = await Staff.findById(shift.staff_id);
  const summary = await shiftService.buildSummary(shift);
  summary.shift.status = shift.status;
  summary.shift.handed_over_at = shift.handed_over_at ? shift.handed_over_at.toISOString() : new Date().toISOString();
  summary.shift.shift_notes = shift.shift_notes || '';

  const { pdfBuffer, sha256 } = await pdfUtils.generateShiftReportPdf({
    ...summary,
    staff,
  });

  await ShiftReport.findOneAndUpdate(
    { shift_id: shift._id },
    {
      shift_id: shift._id,
      pdf: pdfBuffer,
      sha256,
      created_at: new Date(),
    },
    { upsert: true, returnDocument: 'after' }
  );

  shift.report_status = 'ready';
  await shift.save();

  return {
    shift_id: String(shift._id),
    report_status: 'ready',
    pdf_bytes: pdfBuffer.length,
    sha256,
  };
}

module.exports = {
  addException,
  reopenShift,
  regenerateReport,
};
