const notificationsService = require('./notifications.service');

async function list(req, res, next) {
  try {
    const { is_read, page, limit } = req.query;
    const result = await notificationsService.listNotifications({
      staffId: req.auth.staff._id,
      isRead: is_read,
      page,
      limit,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const data = await notificationsService.markAsRead({
      staffId: req.auth.staff._id,
      notificationId: id,
    });
    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const data = await notificationsService.markAllAsRead({
      staffId: req.auth.staff._id,
    });
    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getPreferences(req, res, next) {
  try {
    const data = await notificationsService.getPreferences({
      staffId: req.auth.staff._id,
    });
    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const data = await notificationsService.updatePreferences({
      staffId: req.auth.staff._id,
      body: req.body,
    });
    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  markRead,
  markAllRead,
  getPreferences,
  updatePreferences,
};
