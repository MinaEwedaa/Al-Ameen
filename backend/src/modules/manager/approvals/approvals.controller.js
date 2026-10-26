const service = require('./approvals.service');

const actorOf = (req) => req.auth?.staff || req.staff;

async function list(req, res, next) {
  try {
    const { status, request_type, booking_id, page, limit } = req.query;
    res.json(await service.listApprovals({ status, request_type, booking_id, page, limit }));
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    res.json({ data: await service.getApprovalById(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function decide(req, res, next) {
  try {
    res.json({ data: await service.decideApproval(req.params.id, req.body, actorOf(req), req.ip) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, decide };