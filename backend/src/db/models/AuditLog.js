const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema({
  at: { type: Date, required: true, default: Date.now },
  actor_staff_id: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
  action: { type: String, required: true },
  entity: { type: String, default: null },
  entity_id: { type: String, default: null },   // String مش ObjectId (الشرح تحت)
  details: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
});

auditLogSchema.index({ at: -1 });
auditLogSchema.index({ actor_staff_id: 1, at: -1 });

// ---- Append-only: ممنوع التعديل والمسح ----
const fail = () => { throw new Error('AuditLog is append-only'); };

auditLogSchema.pre(
  ['updateOne', 'updateMany', 'replaceOne', 'findOneAndUpdate', 'findOneAndReplace',
    'findOneAndDelete', 'deleteOne', 'deleteMany'],
  { query: true, document: false },
  fail
);
auditLogSchema.pre('deleteOne', { document: true, query: false }, fail);
auditLogSchema.pre('save', function () { if (!this.isNew) fail(); });

module.exports = model('AuditLog', auditLogSchema);