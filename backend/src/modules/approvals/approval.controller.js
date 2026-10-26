const service = require('./approval.service');

async function create(req, res, next) {
  try {
    const data = await service.createApprovalRequest(req.body, req.auth.staff, req.shift, req.ip);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { create };