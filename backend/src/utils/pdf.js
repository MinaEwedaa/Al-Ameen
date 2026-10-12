const PDFDocument = require('pdfkit');
const crypto = require('crypto');

/**
 * Generates an official hotel shift report PDF buffer.
 *
 * @param {Object} data
 * @param {Object} data.shift
 * @param {Object} data.staff
 * @param {Object} data.payments
 * @param {number} data.check_ins
 * @param {number} data.check_outs
 * @param {string[]} data.rooms_handled
 * @param {Object[]} data.cleaning_tasks
 * @param {Object[]} data.maintenance_issues
 * @param {Object} data.pending
 * @returns {Promise<{ pdfBuffer: Buffer, sha256: string }>}
 */
function generateShiftReportPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const sha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        resolve({ pdfBuffer, sha256 });
      });
      doc.on('error', reject);

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(18).text('AL-AMEEN HOTEL', 50, 50, { align: 'center' });
      doc.fontSize(12).text('Staff Management System — Official Shift Handover Report', 50, 75, { align: 'center' });

      doc.moveDown(3);
      doc.fillColor('#000000');

      // Shift & Staff Meta Table
      doc.fontSize(14).font('Helvetica-Bold').text('Shift & Receptionist Metadata');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Shift ID: ${data.shift.shift_id}`);
      doc.text(`Receptionist: ${data.staff.name} (@${data.staff.username || data.staff.name})`);
      doc.text(`Date (Cairo): ${data.shift.shift_date} | Shift Type: ${data.shift.shift_type.toUpperCase()}`);
      doc.text(`Scheduled Hours: ${data.shift.start_time} — ${data.shift.end_time}`);
      doc.text(`Handover Timestamp: ${data.shift.handed_over_at || new Date().toISOString()}`);
      doc.moveDown();

      // Financial Summary
      doc.fontSize(14).font('Helvetica-Bold').text('Financial Collections Summary');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Cash: ${data.payments.cash.toFixed(2)} EGP`);
      doc.text(`InstaPay: ${data.payments.instapay.toFixed(2)} EGP`);
      doc.text(`Vodafone Cash: ${data.payments.vodafone_cash.toFixed(2)} EGP`);
      doc.font('Helvetica-Bold').text(`Total Payments Collected: ${data.payments.total.toFixed(2)} EGP`);
      doc.font('Helvetica');
      doc.moveDown();

      // Operations Summary
      doc.fontSize(14).font('Helvetica-Bold').text('Front Desk Operations');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Guest Check-ins Completed: ${data.check_ins}`);
      doc.text(`Guest Check-outs Completed: ${data.check_outs}`);
      doc.text(`Rooms Handled: ${data.rooms_handled && data.rooms_handled.length > 0 ? data.rooms_handled.join(', ') : 'None'}`);
      doc.text(`Cleaning Tasks Created: ${data.cleaning_tasks ? data.cleaning_tasks.length : 0}`);
      doc.text(`Maintenance Issues Logged: ${data.maintenance_issues ? data.maintenance_issues.length : 0}`);
      doc.moveDown();

      // Pending Items
      doc.fontSize(14).font('Helvetica-Bold').text('Pending Hotel Status (For Next Shift)');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Unfinished Cleaning Tasks: ${data.pending?.cleaning_tasks?.length || 0}`);
      doc.text(`Open / In-Progress Maintenance Issues: ${data.pending?.maintenance_issues?.length || 0}`);
      doc.text(`Unverified Payments: ${data.pending?.unverified_payments?.length || 0}`);
      doc.moveDown();

      // Handover Notes
      doc.fontSize(14).font('Helvetica-Bold').text('Handover Notes');
      doc.font('Helvetica-Oblique').fontSize(10);
      doc.text(data.shift.shift_notes || 'No handover notes entered.');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateShiftReportPdf };
