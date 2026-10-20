import { request } from '../../../core/api/apiClient';
import { getAuthSession } from '../../../core/auth/authManager';
import type { ShiftSummary } from '../types/shift-report.types';
import type { ShiftSummary as HandoverSummary } from '../../shift-handover/types/shift-handover.types';
// A night shift ends on the next calendar day (for example 23:00 -> 07:00).
function addOneDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export async function getShiftReport(): Promise<ShiftSummary> {
  try {
    const handover = await request<HandoverSummary>('/shifts/current/summary');
    const tasksDone =
      handover.cleaning_tasks.filter((t) => t.status === 'done').length +
      handover.maintenance_issues.filter((i) => i.status === 'resolved').length;
    const totalTasks = handover.cleaning_tasks.length + handover.maintenance_issues.length;
    const score = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 100;
    const endDate =
      handover.shift.end_time <= handover.shift.start_time
        ? addOneDay(handover.shift.shift_date)
        : handover.shift.shift_date;

    return {
      date: handover.shift.shift_date,
      checkedIn: handover.check_ins,
      checkedOut: handover.check_outs,
      tasksCompleted: tasksDone,
      staffName: getAuthSession()?.staffName,
      shiftName: handover.shift.shift_type,
      startedAt: `${handover.shift.shift_date}T${handover.shift.start_time}`,
      endedAt: `${endDate}T${handover.shift.end_time}`,
      performanceScore: score,
      totalCollected: handover.payments.total,
      cashCollected: handover.payments.cash,
      cardCollected: handover.payments.instapay,
      transferCollected: handover.payments.vodafone_cash,
      housekeepingTasks: handover.cleaning_tasks.length,
      maintenanceTasks: handover.maintenance_issues.length,
      reservations: handover.check_ins,
      notes: handover.shift.shift_notes ?? undefined,
    };
  } catch {
    return request<ShiftSummary>('/shift-report');
  }
}

