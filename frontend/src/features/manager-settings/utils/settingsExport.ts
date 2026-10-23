import type { ManagerSettings } from '../types/manager-settings.types';
import { exportCsv, type CsvColumn } from '../../../utils/exportCsv';

export function exportSettingsAsJson(settings: ManagerSettings): void {
  const content = JSON.stringify(settings, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `al-amin-settings-${dateStr}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

interface SettingsCsvRow {
  section: string;
  key: string;
  value: string;
}

export function exportSettingsAsCsv(settings: ManagerSettings): boolean {
  const dateStr = new Date().toISOString().split('T')[0];
  const rows: SettingsCsvRow[] = [
    { section: 'Hotel Information', key: 'Hotel Name', value: settings.hotelInfo.hotelName },
    { section: 'Hotel Information', key: 'Location', value: settings.hotelInfo.location },
    { section: 'Hotel Information', key: 'Floors Count', value: String(settings.hotelInfo.floorsCount) },
    { section: 'Hotel Information', key: 'Total Rooms', value: String(settings.hotelInfo.totalRooms) },
    ...settings.shifts.map((s) => ({
      section: 'Shifts',
      key: s.name,
      value: `${s.startTime} - ${s.endTime}`,
    })),
    { section: 'Notifications', key: 'Maintenance', value: settings.notifications.maintenance ? 'Enabled' : 'Disabled' },
    { section: 'Notifications', key: 'Housekeeping', value: settings.notifications.cleaning ? 'Enabled' : 'Disabled' },
    { section: 'Notifications', key: 'Payments', value: settings.notifications.payments ? 'Enabled' : 'Disabled' },
    { section: 'Notifications', key: 'Pending Tasks', value: settings.notifications.pendingTasks ? 'Enabled' : 'Disabled' },
    { section: 'Notifications', key: 'Shift Handover', value: settings.notifications.shiftHandover ? 'Enabled' : 'Disabled' },
    { section: 'Notifications', key: 'Reports', value: settings.notifications.reports ? 'Enabled' : 'Disabled' },
    { section: 'Preferences', key: 'Language', value: settings.language },
    { section: 'Preferences', key: 'Appearance', value: settings.appearance },
  ];

  const columns: CsvColumn<SettingsCsvRow>[] = [
    { header: 'Section', value: (row) => row.section },
    { header: 'Setting', value: (row) => row.key },
    { header: 'Value', value: (row) => row.value },
  ];

  return exportCsv(rows, columns, `al-amin-settings-${dateStr}.csv`);
}
