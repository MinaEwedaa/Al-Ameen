const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    actor_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    action: {
      type: String,
      required: true,
    },
    entity: {
      type: String,
      default: null,
    },
    entity_id: {
      type: String,
      default: null,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ at: -1 });
auditLogSchema.index({ actor_staff_id: 1 });

module.exports = model('AuditLog', auditLogSchema);
