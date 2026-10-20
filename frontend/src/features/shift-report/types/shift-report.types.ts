export interface ShiftSummary {
  date: string;
  checkedIn: number;
  checkedOut: number;
  tasksCompleted: number;
  staffName?: string;
  staffRole?: string;
  shiftName?: string;
  startedAt?: string;
  endedAt?: string;
  performanceScore?: number;
  totalCollected?: number;
  cashCollected?: number;
  cardCollected?: number;
  transferCollected?: number;
  housekeepingTasks?: number;
  maintenanceTasks?: number;
  reservations?: number;
  guestRequests?: number;
  notes?: string;
  events?: ShiftReportEvent[];
}

export interface ShiftReportEvent {
  id: string;
  title: string;
  description?: string;
  time?: string;
}
