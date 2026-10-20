export interface ShiftActivityRecord {
  id: string;
  roomId: string;
  roomNumber: string;
  status: string;
  guestName?: string;
  notes: string;
  time: string;
}

const shiftActivity: ShiftActivityRecord[] = [];

export function appendShiftActivity(activity: ShiftActivityRecord): void {
  shiftActivity.unshift(activity);
}

export function listShiftActivity(): ShiftActivityRecord[] {
  return shiftActivity.map((activity) => ({ ...activity }));
}
