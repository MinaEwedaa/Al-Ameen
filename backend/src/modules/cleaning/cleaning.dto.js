const { DateTime } = require('luxon');
const { ZONE } = require('../../utils/time');

const cairoIso = (d) => (d ? DateTime.fromJSDate(new Date(d)).setZone(ZONE).toISO() : null);

function toCleaningTaskDto(task) {
  const roomId = task.room_id?._id ? String(task.room_id._id) : (task.room_id ? String(task.room_id) : null);
  const roomNumber = task.room_id?.room_number ?? (task.room_number ?? null);

  return {
    task_id: String(task._id),
    room_id: roomId,
    room_number: roomNumber ? String(roomNumber) : null,
    priority: task.priority,
    status: task.status,
    notes: task.notes || null,
    cleaner_name: task.cleaner_name || null,
    assigned_date: cairoIso(task.assigned_at) || cairoIso(task.createdAt) || new Date().toISOString(),
    finished_date: cairoIso(task.finished_at),
    shift_id: task.shift_id ? String(task.shift_id) : (task.shift ? String(task.shift) : null),
    assigned_by_staff_id: task.assigned_by_staff_id ? String(task.assigned_by_staff_id) : null,
  };
}

module.exports = { toCleaningTaskDto };
