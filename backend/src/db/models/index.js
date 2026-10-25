const Staff = require('./Staff');
const Shift = require('./Shift');
const ShiftException = require('./ShiftException');
const Attendance = require('./Attendance');
const Room = require('./Room');
const RoomStatusHistory = require('./RoomStatusHistory');
const Guest = require('./Guest');
const Reservation = require('./Reservation');
const RoomNight = require('./RoomNight');
const Payment = require('./Payment');
const CleaningTask = require('./CleaningTask');
const MaintenanceIssue = require('./MaintenanceIssue');
const AuditLog = require('./AuditLog');
const IdempotencyKey = require('./IdempotencyKey');
const Session = require('./Session');
const ShiftReport = require('./ShiftReport');
const RoomType = require('./RoomType');
const ShiftSchedule = require('./ShiftSchedule');
const LeaveRequest = require('./LeaveRequest');
const ApprovalRequest = require('./ApprovalRequest');
const CancellationSettlement = require('./CancellationSettlement');
const PasswordResetRequest = require('./PasswordResetRequest');
const DailyClosing = require('./DailyClosing');
const Notification = require('./Notification');
const Setting = require('./Setting');

module.exports = {
  Staff,
  Shift,
  ShiftException,
  Attendance,
  Room,
  RoomStatusHistory,
  Guest,
  Reservation,
  RoomNight,
  Payment,
  CleaningTask,
  MaintenanceIssue,
  AuditLog,
  IdempotencyKey,
  Session,
  ShiftReport,
  RoomType,
  ShiftSchedule,
  LeaveRequest,
  ApprovalRequest,
  CancellationSettlement,
  PasswordResetRequest,
  DailyClosing,
  Notification,
  Setting,
};
