const readline = require('readline');
const { AuditLog } = require('../../src/db/models');

/**
 * Validates mandatory admin flags (--by and --reason), prompts for confirmation if interactive,
 * and records the action into the AuditLog.
 */
async function guard({ by, reason, yes = false, action, details = {}, session = null }) {
  if (!by || typeof by !== 'string' || !by.trim()) {
    throw new Error('Missing required option: --by is mandatory for all admin commands.');
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('Missing required option: --reason is mandatory for all admin commands.');
  }

  const cleanBy = by.trim();
  const cleanReason = reason.trim();

  // If interactive terminal and not bypassed with --yes, ask for confirmation
  if (!yes && process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    const confirmed = await askConfirmation(`Are you sure you want to execute ${action}? (y/N): `);
    if (!confirmed) {
      throw new Error('Operation aborted by user.');
    }
  }

  // Filter sensitive fields from details before logging
  const safeDetails = { ...details };
  delete safeDetails.password;
  delete safeDetails.newPassword;
  delete safeDetails.token;

  // Log to AuditLog
  const auditDoc = {
    action: `ADMIN_${action.toUpperCase().replace(/-/g, '_')}`,
    actorStaffId: null,
    ip: 'CLI',
    details: {
      by: cleanBy,
      reason: cleanReason,
      ...safeDetails,
    },
    created_at: new Date(),
  };

  if (session) {
    await AuditLog.create([auditDoc], { session });
  } else {
    await AuditLog.create(auditDoc);
  }

  return { by: cleanBy, reason: cleanReason };
}

function askConfirmation(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'y' || ans.trim().toLowerCase() === 'yes');
    });
  });
}

module.exports = { guard };
