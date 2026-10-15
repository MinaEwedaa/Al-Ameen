const cleaningService = require('./cleaning.service');
const { getNow } = require('../../utils/clock');

async function createCleaningTask(req, res, next) {
  try {
    const { room_id, priority, cleaner_name, notes } = req.body;
    const task = await cleaningService.createCleaningTask({
      room_id,
      priority,
      cleaner_name,
      notes,
      staff: req.auth.staff,
      shift: req.shift,
      now: getNow(req),
      ip: req.ip,
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

async function listCleaningTasks(req, res, next) {
  try {
    const { status, priority, room_id, page, limit } = req.query;
    const result = await cleaningService.listCleaningTasks({
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

async function getCleaningTask(req, res, next) {
  try {
    const { task_id } = req.params;
    const task = await cleaningService.getCleaningTask(task_id);
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

async function updateCleaningTask(req, res, next) {
  try {
    const { task_id } = req.params;
    const { cleaner_name, priority, notes, status } = req.body;
    const task = await cleaningService.updateCleaningTask({
      taskId: task_id,
      cleaner_name,
      priority,
      notes,
      status,
      staff: req.auth.staff,
      shift: req.shift,
      now: getNow(req),
      ip: req.ip,
    });
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCleaningTask,
  listCleaningTasks,
  getCleaningTask,
  updateCleaningTask,
};
