const mongoose = require('mongoose');
const { PasswordResetRequest, Staff, Session } = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { paginateM } = require('../../../utils/paginateM');
const { hashPassword, generatePassword } = require('../../../utils/password');
const { audit } = require('../../audit/audit.service');

async function listPasswordResetRequests({ status = 'PENDING', page = 1, limit = 20 }) {
  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }

  const result = await paginateM(
    PasswordResetRequest,
    filter,
    { page, limit, sort: { createdAt: -1 } },
    async (doc) => doc
  );

  const staffIds = [...new Set(result.data.map((d) => String(d.staff_id)).filter(Boolean))];
  const staffList = await Staff.find({ _id: { $in: staffIds } }).select('_id name role').lean();
  const staffMap = new Map(staffList.map((s) => [String(s._id), s]));

  result.data = result.data.map((d) => {
    const s = staffMap.get(String(d.staff_id));
    const role = s?.role || 'receptionist';
    return {
      id: String(d._id),
      staff_id: String(d.staff_id),
      staff_name: s?.name || '',
      role,
      staff_type: role.toUpperCase(),
      username: d.username,
      status: d.status,
      created_at: d.createdAt ? d.createdAt.toISOString() : null,
      requested_at: d.createdAt ? d.createdAt.toISOString() : null,
      decided_at: d.decided_at ? d.decided_at.toISOString() : null,
      decided_by_staff_id: d.decided_by_staff_id ? String(d.decided_by_staff_id) : null,
      manager_comment: d.manager_comment || null,
    };
  });

  return result;
}

async function decidePasswordResetRequest({ id, action, manager_comment, temporary_password: customPw, managerStaffId, ip }) {
  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw E.validation('action must be APPROVE or REJECT');
  }

  async function executeDecision(session) {
    // 1. Find request
    let query = PasswordResetRequest.findById(id);
    if (session) query = query.session(session);
    const reqDoc = await query;
    if (!reqDoc) {
      throw E.notFound('Password reset request not found');
    }

    if (!['PENDING', 'IN_REVIEW'].includes(reqDoc.status)) {
      throw E.conflict('Record already decided', 'RECORD_ALREADY_DECIDED');
    }

    const targetStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const now = new Date();

    // 2. Atomic update to prevent race conditions
    const updateOptions = { new: true };
    if (session) updateOptions.session = session;

    const updatedReq = await PasswordResetRequest.findOneAndUpdate(
      { _id: reqDoc._id, status: { $in: ['PENDING', 'IN_REVIEW'] } },
      {
        $set: {
          status: targetStatus,
          decided_by_staff_id: managerStaffId,
          decided_at: now,
          manager_comment: manager_comment || null,
        },
      },
      updateOptions
    );

    if (!updatedReq) {
      throw E.conflict('Record already decided', 'RECORD_ALREADY_DECIDED');
    }

    let temporary_password = null;

    if (action === 'APPROVE') {
      let staffQuery = Staff.findById(reqDoc.staff_id);
      if (session) staffQuery = staffQuery.session(session);
      const staff = await staffQuery;
      if (!staff || !staff.active) {
        throw E.conflict('Staff member is deactivated or not found', 'CONFLICT');
      }

      const pw = (typeof customPw === 'string' && customPw.trim().length >= 6)
        ? customPw.trim()
        : generatePassword();
      temporary_password = pw;
      const newHash = await hashPassword(pw);

      await Staff.updateOne(
        { _id: reqDoc.staff_id, active: true },
        {
          $set: {
            password_hash: newHash,
            failed_attempts: 0,
            lock_level: 0,
            locked_until: null,
            password_changed_at: now,
          },
        },
        session ? { session } : {}
      );

      // Revoke all existing sessions for this employee
      await Session.updateMany(
        { staff_id: reqDoc.staff_id, revoked_at: null },
        { $set: { revoked_at: now } },
        session ? { session } : {}
      );

      await audit(
        {
          action: 'APPROVED_RESET_PASSWORD',
          actorStaffId: managerStaffId,
          ip,
          entity: 'PasswordResetRequest',
          entityId: reqDoc._id,
          details: { staff_id: reqDoc.staff_id, username: reqDoc.username },
        },
        session ? { session } : undefined
      );
    } else {
      await audit(
        {
          action: 'REJECTED_RESET_PASSWORD',
          actorStaffId: managerStaffId,
          ip,
          entity: 'PasswordResetRequest',
          entityId: reqDoc._id,
          details: { staff_id: reqDoc.staff_id, username: reqDoc.username },
        },
        session ? { session } : undefined
      );
    }

    return {
      id: String(updatedReq._id),
      status: updatedReq.status,
      staff_id: String(updatedReq.staff_id),
      temporary_password,
    };
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch {
    session = null;
  }

  if (session) {
    try {
      let result;
      await session.withTransaction(async () => {
        result = await executeDecision(session);
      });
      return result;
    } catch (err) {
      if (err.message && err.message.includes('Transaction numbers are only allowed on a replica set member')) {
        return await executeDecision(null);
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  return await executeDecision(null);
}

module.exports = {
  listPasswordResetRequests,
  decidePasswordResetRequest,
};
