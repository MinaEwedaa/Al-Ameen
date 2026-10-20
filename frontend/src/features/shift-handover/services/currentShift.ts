import { useQuery } from '@tanstack/react-query';
import { request } from '../../../core/api/apiClient';

export interface CurrentShift {
  shift_id: string;
  shift_date: string;
  shift_type: 'morning' | 'evening' | 'night';
  start_time: string;
  end_time: string;
  status: 'active' | 'handed_over';
}

export interface ShiftProgress {
  progressPercent: number;
  remainingHours: number;
  remainingMinutes: number;
  ended: boolean;
}

const cairoFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Cairo wall-clock time expressed as a "fake UTC" number, so it can be compared with the shift times
function cairoWallClockMs(date: Date): number {
  const parts: Record<string, string> = {};
  for (const part of cairoFormat.formatToParts(date)) parts[part.type] = part.value;
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

export function computeShiftProgress(shift: CurrentShift, now: Date = new Date()): ShiftProgress {
  const [year, month, day] = shift.shift_date.split('-').map(Number);
  const [startHour, startMinute] = shift.start_time.split(':').map(Number);
  const [endHour, endMinute] = shift.end_time.split(':').map(Number);

  const startMs = Date.UTC(year, month - 1, day, startHour, startMinute);
  const durationMinutes = (endHour * 60 + endMinute - (startHour * 60 + startMinute) + 1440) % 1440;
  const endMs = startMs + durationMinutes * 60_000;
  const nowMs = cairoWallClockMs(now);

  const progressPercent = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)));
  const remaining = Math.max(0, Math.floor((endMs - nowMs) / 60_000));

  return {
    progressPercent,
    remainingHours: Math.floor(remaining / 60),
    remainingMinutes: remaining % 60,
    ended: remaining === 0,
  };
}

export function useCurrentShift() {
  return useQuery({
    queryKey: ['shift', 'current'],
    queryFn: () => request<CurrentShift>('/shifts/current'),
    retry: false,
    staleTime: 60_000,
  });
}
