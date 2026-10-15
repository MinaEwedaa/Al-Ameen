const ar = require('../../i18n/ar');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderReportHtml(data) {
  const { shift, staff, payments, check_ins, check_outs, rooms_handled, cleaning_tasks, maintenance_issues, pending } = data;
  const shiftTypeName = ar.shiftType[shift.shift_type] || shift.shift_type;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير تسليم وردية</title>
  <style>
    body { font-family: sans-serif; margin: 20px; direction: rtl; }
    h1, h2, h3 { color: #1E293B; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #CBD5E1; padding: 8px 12px; text-align: right; }
    th { background-color: #F1F5F9; }
    .section { margin-bottom: 24px; }
    .total-row { font-weight: bold; background-color: #E2E8F0; }
  </style>
</head>
<body>
  <h1>تقرير تسليم الوردية - فندق الأمين</h1>

  <div class="section">
    <h2>بيانات الوردية والموظف</h2>
    <table>
      <tr><th>اسم الموظف</th><td>${escapeHtml(staff.name)}</td></tr>
      <tr><th>تاريخ الوردية</th><td>${escapeHtml(shift.shift_date)}</td></tr>
      <tr><th>نوع الوردية</th><td>${escapeHtml(shiftTypeName)}</td></tr>
      <tr><th>ساعات العمل</th><td>${escapeHtml(shift.start_time)} - ${escapeHtml(shift.end_time)}</td></tr>
      <tr><th>وقت التسليم الفعلي</th><td>${escapeHtml(shift.handed_over_at)}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>المدفوعات والمتحصلات</h2>
    <table>
      <thead>
        <tr><th>طريقة الدفع</th><th>المبلغ (جنيه)</th></tr>
      </thead>
      <tbody>
        <tr><td>نقدي</td><td>${payments.cash}</td></tr>
        <tr><td>إنستاباي</td><td>${payments.instapay}</td></tr>
        <tr><td>فودافون كاش</td><td>${payments.vodafone_cash}</td></tr>
        <tr class="total-row"><td>الإجمالي</td><td>${payments.total}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>العمليات والغرف</h2>
    <table>
      <tr><th>تسجيلات الدخول (Check-in)</th><td>${check_ins}</td></tr>
      <tr><th>تسجيلات الخروج (Check-out)</th><td>${check_outs}</td></tr>
      <tr><th>الغرف التي تم التعامل معها</th><td>${escapeHtml(rooms_handled ? rooms_handled.join(', ') : 'لا يوجد')}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>مهام التنظيف بالوردية</h2>
    <p>عدد المهام: ${cleaning_tasks ? cleaning_tasks.length : 0}</p>
  </div>

  <div class="section">
    <h2>أعطال الصيانة بالوردية</h2>
    <p>عدد الأعطال: ${maintenance_issues ? maintenance_issues.length : 0}</p>
  </div>

  <div class="section">
    <h2>المعلق للوردية القادمة</h2>
    <table>
      <tr><th>مهام تنظيف معلقة</th><td>${pending?.cleaning_tasks?.length || 0}</td></tr>
      <tr><th>أعطال صيانة مفتوحة</th><td>${pending?.maintenance_issues?.length || 0}</td></tr>
      <tr><th>دفعات غير مؤكدة</th><td>${pending?.unverified_payments?.length || 0}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>ملاحظات التسليم</h2>
    <p>${escapeHtml(shift.shift_notes || 'لا توجد ملاحظات.')}</p>
  </div>
</body>
</html>`;
}

module.exports = { escapeHtml, renderReportHtml };
