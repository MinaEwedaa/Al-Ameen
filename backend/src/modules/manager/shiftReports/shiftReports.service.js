const mongoose = require('mongoose');
const {
  ShiftReport,
  Shift,
  AuditLog,
  Staff,
} = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { sanitizeText } = require('../../../utils/arabic');
const { audit } = require('../../audit/audit.service');
const { AUDIT } = require('../../audit/audit.actions');
const PDFDocument = require('pdfkit');

const REPORT_STATUSES = [
  'PENDING_REVIEW',
  'APPROVED',
  'NEEDS_REVIEW',
];

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function findReport(id) {
  if (!validId(id)) {
    throw E.notFound('Shift report not found');
  }

  const report = await ShiftReport.findById(id)
    .select('-pdf -pdf_data')
    .lean();

  if (!report) {
    throw E.notFound('Shift report not found');
  }

  return report;
}

function toReportDto(report) {
  return {
    report_id: String(report._id),
    shift_id: String(report.shift_id),
    business_date: report.shift_date,
    shift_type: report.shift_type,
    staff_id: report.staff_id ? String(report.staff_id) : null,
    staff_name: report.staff_name,
    rooms_handled: report.handled_rooms,
    cleaning_tasks: report.tasks_cleaning,
    maintenance_requests: report.maintenance_requests,
    pending_items: report.pending_items,
    cash_total: report.cash_total,
    instapay_total: report.instapay_total,
    vodafone_cash_total: report.vodafone_cash_total,
    gross_revenue: report.gross_revenue,
    refunds_total: report.refunds_total,
    cancellation_retained_total: report.cancellation_retained_total,
    net_revenue: report.net_revenue,
    review_status: report.review_status,
    reviewed_by_staff_id: report.reviewed_by_staff_id
      ? String(report.reviewed_by_staff_id)
      : null,
    reviewed_at: report.reviewed_at || null,
    manager_comment: report.manager_comment || null,
    pdf_url: `/api/v1/manager/shift-reports/${report._id}/pdf`,
  };
}

async function listReports({
  from,
  to,
  business_date,
  shift_id,
  review_status,
  staff_id,
  page = 1,
  limit = 20,
} = {}) {
  const filter = {};

  if (business_date) {
    filter.shift_date = business_date;
  } else if (from || to) {
    filter.shift_date = {};
    if (from) filter.shift_date.$gte = from;
    if (to) filter.shift_date.$lte = to;
  }

  if (shift_id) {
    if (!validId(shift_id)) {
      throw E.validation('Invalid shift_id');
    }
    filter.shift_id = new mongoose.Types.ObjectId(shift_id);
  }

  if (review_status) {
    if (!REPORT_STATUSES.includes(review_status)) {
      throw E.validation('Invalid review_status');
    }
    filter.review_status = review_status;
  }

  if (staff_id) {
    if (!validId(staff_id)) {
      throw E.validation('Invalid staff_id');
    }
    filter.staff_id = new mongoose.Types.ObjectId(staff_id);
  }

  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(limit, 10) || 20)
  );

  const [reports, total] = await Promise.all([
    ShiftReport.find(filter)
      .select('-pdf -pdf_data')
      .sort({ shift_date: -1, created_at: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    ShiftReport.countDocuments(filter),
  ]);

  return {
    data: reports.map((report) => ({
      report_id: report._id,
      shift_id: report.shift_id,
      business_date: report.shift_date,
      shift_type: report.shift_type,
      staff_id: report.staff_id,
      staff_name: report.staff_name,
      review_status: report.review_status,
      gross_revenue: report.gross_revenue,
      refunds_total: report.refunds_total,
      net_revenue: report.net_revenue,
      created_at: report.created_at,
    })),
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
}

async function getReport(id) {
  return toReportDto(await findReport(id));
}

async function getReportActivities(id, { page = 1, limit = 20 } = {}) {
  const report = await findReport(id);
  const shiftId = String(report.shift_id);
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const filter = {
    $or: [
      { entity: 'Shift', entity_id: shiftId },
      { entity: 'ShiftReport', entity_id: String(report._id) },
      { 'details.shift_id': shiftId },
    ],
  };

  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .select('action entity entity_id at')
      .sort({ at: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    data: rows.map((a) => ({
      id: String(a._id),
      action: a.action,
      entity: a.entity,
      entity_id: a.entity_id,
      at: a.at,
    })),
    meta: { page: p, limit: l, total, total_pages: Math.ceil(total / l) || 1 },
  };
}

async function getHandover(id) {
  const report = await findReport(id);
  const shift = await Shift.findById(report.shift_id).lean();

  if (!shift) {
    throw E.notFound('Shift not found');
  }

  // The report stores only the COUNT of pending items, so the list stays empty
  // (rebuilding it from live data would change after the shift ended)
  return {
    report_id: String(report._id),
    shift_id: String(shift._id),
    staff_name: report.staff_name,
    submitted_at: shift.handed_over_at || report.created_at || null,
    notes: report.notes || shift.shift_notes || null,
    pending_items_count: report.pending_items || 0,
    pending_items: [],
  };
}

// Amounts are EGP here (this is how the report stores them)
function buildPdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const bufs = [];
    doc.on('data', (b) => bufs.push(b));
    doc.on('end', () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    doc.fontSize(18).text('Shift Report - Al-Amin Hotel');
    doc.moveDown();
    doc.fontSize(11).text(`Date: ${r.shift_date}`);
    doc.text(`Shift: ${r.shift_type}`);
    doc.text(`Review: ${r.review_status}`);
    doc.moveDown();

    const rows = [
      ['Cash', r.cash_total],
      ['InstaPay', r.instapay_total],
      ['Vodafone Cash', r.vodafone_cash_total],
      ['Gross', r.gross_revenue],
      ['Refunds', r.refunds_total],
      ['Retained (cancellations)', r.cancellation_retained_total],
      ['Net', r.net_revenue],
    ];
    for (const [label, value] of rows) {
      doc.text(`${label}: ${Number(value || 0).toFixed(2)} EGP`);
    }
    doc.end();
  });
}

async function loadOrBuildPdf(id) {
  const report = await ShiftReport.findById(id).select('+pdf_data');
  if (!report) {
    throw E.notFound('Shift report not found');
  }

  let pdfBuffer = report.pdf || report.pdf_data;

  if (!pdfBuffer || !pdfBuffer.length) {
    pdfBuffer = await buildPdf(report);
    // Stored only for an approved report
    if (report.review_status === 'APPROVED') {
      await ShiftReport.updateOne(
        { _id: report._id },
        { $set: { pdf_data: pdfBuffer, pdf_generated_at: new Date() } }
      );
    }
  }

  return { report, pdfBuffer };
}

async function getReportPdf(id) {
  if (!validId(id)) {
    throw E.notFound('Shift report not found');
  }

  const { report, pdfBuffer } = await loadOrBuildPdf(id);

  return {
    pdfBuffer,
    filename: `shift-report-${report.shift_date}-${report.shift_type}.pdf`,
  };
}

async function reviewReport(id, body = {}, actor, ip = null) {
  if (!validId(id)) {
    throw E.notFound('Shift report not found');
  }

  const status = body.review_status;
  if (!['APPROVED', 'NEEDS_REVIEW'].includes(status)) {
    throw E.validation('review_status must be APPROVED or NEEDS_REVIEW');
  }

  if (!actor?._id) {
    throw E.validation('Reviewer information is missing');
  }

  const rawComment =
    typeof body.manager_comment === 'string'
      ? body.manager_comment.trim()
      : '';

  if (status === 'NEEDS_REVIEW' && !rawComment) {
    throw E.validation('manager_comment is required with NEEDS_REVIEW', {
      field: 'manager_comment',
      issue: 'required',
    });
  }

  if (rawComment.length > 500) {
    throw E.validation('manager_comment must be at most 500 characters', {
      field: 'manager_comment',
      issue: 'max 500',
    });
  }

  const managerComment = rawComment ? sanitizeText(rawComment) : null;

  const before = await ShiftReport.findById(id).select('review_status').lean();
  if (!before) {
    throw E.notFound('Shift report not found');
  }

  let updated;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Atomic: only a pending or needs-review report can be reviewed (APPROVED is final)
      updated = await ShiftReport.findOneAndUpdate(
        { _id: id, review_status: { $in: ['PENDING_REVIEW', 'NEEDS_REVIEW'] } },
        {
          $set: {
            review_status: status,
            reviewed_by_staff_id: actor._id,
            reviewed_at: new Date(),
            manager_comment: managerComment,
            // A report that goes back to review loses its stored PDF
            ...(status === 'NEEDS_REVIEW'
              ? { pdf: null, pdf_data: null, pdf_generated_at: null }
              : {}),
          },
        },
        { returnDocument: 'after', session }
      )
        .select('-pdf -pdf_data')
        .lean();

      if (!updated) {
        throw E.unprocessable('An approved report cannot be reviewed again');
      }

      await audit(
        {
          action: AUDIT.REVIEWED_SHIFT_REPORT,
          actorStaffId: actor._id,
          entity: 'ShiftReport',
          entityId: String(id),
          details: { from: before.review_status, to: status },
          ip,
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (status === 'APPROVED') {
    try {
      await loadOrBuildPdf(id);
    } catch (err) {
      // The PDF is generated again on request, so a failure here never fails the review
    }
  }
  return toReportDto(updated);
}

module.exports = {
  listReports,
  getReport,
  getReportActivities,
  getHandover,
  getReportPdf,
  reviewReport,
};