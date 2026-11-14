const service = require('./finance.service');

const actorOf = (req) => req.auth?.staff || req.staff;

async function current(req, res, next) {
  try {
    res.json({ data: await service.getCurrent() });
  } catch (err) {
    next(err);
  }
}

async function open(req, res, next) {
  try {
    res.status(201).json({ data: await service.openDay(req.body, actorOf(req), req.ip) });
  } catch (err) {
    next(err);
  }
}

async function close(req, res, next) {
  try {
    res.json({ data: await service.closeDay(req.body, actorOf(req), req.ip) });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    res.json(await service.listClosings(req.query));
  } catch (err) {
    next(err);
  }
}

async function payments(req, res, next) {
  try {
    res.json(await service.listPayments(req.query));
  } catch (err) {
    next(err);
  }
}

module.exports = { current, open, close, list, payments };