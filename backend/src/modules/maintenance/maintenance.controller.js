const maintenanceService = require('./maintenance.service');
const { getNow } = require('../../utils/clock');

async function createMaintenanceIssue(req, res, next) {
  try {
    const { room_id, problem, priority, notes } = req.body;
    const issue = await maintenanceService.createMaintenanceIssue({
      room_id,
      problem,
      priority,
      notes,
      staff: req.auth.staff,
      shift: req.shift,
      now: getNow(req),
      ip: req.ip,
    });
    res.status(201).json(issue);
  } catch (err) {
    next(err);
  }
}

async function listMaintenanceIssues(req, res, next) {
  try {
    const { status, priority, room_id, page, limit } = req.query;
    const result = await maintenanceService.listMaintenanceIssues({
      status,
      priority,
      room_id,
      page,
      limit,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMaintenanceIssue(req, res, next) {
  try {
    const { issue_id } = req.params;
    const issue = await maintenanceService.getMaintenanceIssue(issue_id);
    res.status(200).json(issue);
  } catch (err) {
    next(err);
  }
}

async function updateMaintenanceIssue(req, res, next) {
  try {
    const { issue_id } = req.params;
    const { priority, notes, status } = req.body;
    const issue = await maintenanceService.updateMaintenanceIssue({
      issueId: issue_id,
      priority,
      notes,
      status,
      staff: req.auth.staff,
      shift: req.shift,
      now: getNow(req),
      ip: req.ip,
    });
    res.status(200).json(issue);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createMaintenanceIssue,
  listMaintenanceIssues,
  getMaintenanceIssue,
  updateMaintenanceIssue,
};
