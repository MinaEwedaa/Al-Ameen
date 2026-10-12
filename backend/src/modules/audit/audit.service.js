const { AuditLog } = require('../../db/models');

async function audit(
  { action, actorStaffId, entity, entityId, details, ip },
  { session } = {}
) {
  await AuditLog.create(
    [
      {
        at: new Date(),
        action,
        actor_staff_id: actorStaffId || null,
        entity: entity || null,
        entity_id: entityId || null,
        details: details || {},
        ip: ip || null,
      },
    ],
    { session }
  );
}

module.exports = { audit };
