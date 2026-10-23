import { exportCsv, type CsvColumn } from '../../../utils/exportCsv';
import type { ManagerRoom, ManagerRoomsStats, RoomLogItem } from '../types/manager-rooms.types';

export function exportAllRoomsCsv(rooms: ManagerRoom[], language: 'ar' | 'en'): boolean {
  if (!rooms || rooms.length === 0) return false;
  const isAr = language === 'ar';
  const columns: CsvColumn<ManagerRoom>[] = [
    { header: isAr ? 'رقم الغرفة' : 'Room Number', value: (r) => r.number },
    { header: isAr ? 'الطابق' : 'Floor', value: (r) => r.floor },
    { header: isAr ? 'نوع الغرفة' : 'Room Type', value: (r) => (r.type === 'vip' ? 'VIP' : (isAr ? 'عادية' : 'Standard')) },
    {
      header: isAr ? 'الحالة' : 'Status',
      value: (r) => {
        if (!isAr) return r.status;
        switch (r.status) {
          case 'occupied':
            return 'مشغولة';
          case 'available':
            return 'متاحة';
          case 'cleaning':
            return 'تنظيف';
          case 'maintenance':
            return 'صيانة';
          case 'reserved':
            return 'محجوزة';
          default:
            return r.status;
        }
      },
    },
    { header: isAr ? 'السعر (ج.م)' : 'Price (EGP)', value: (r) => r.price },
    { header: isAr ? 'النزيل الحالي' : 'Current Guest', value: (r) => r.guestName ?? (isAr ? 'لا يوجد ضيف' : 'No Guest') },
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  return exportCsv(rooms, columns, `all-rooms-36-${dateStr}.csv`);
}

export function exportFloorRoomsCsv(
  rooms: ManagerRoom[],
  language: 'ar' | 'en',
  floor: number
): boolean {
  if (!rooms || rooms.length === 0) return false;
  const isAr = language === 'ar';
  const columns: CsvColumn<ManagerRoom>[] = [
    { header: isAr ? 'رقم الغرفة' : 'Room Number', value: (r) => r.number },
    { header: isAr ? 'الطابق' : 'Floor', value: (r) => r.floor },
    { header: isAr ? 'نوع الغرفة' : 'Room Type', value: (r) => (r.type === 'vip' ? 'VIP' : (isAr ? 'عادية' : 'Standard')) },
    {
      header: isAr ? 'الحالة' : 'Status',
      value: (r) => {
        if (!isAr) return r.status;
        switch (r.status) {
          case 'occupied':
            return 'مشغولة';
          case 'available':
            return 'متاحة';
          case 'cleaning':
            return 'تنظيف';
          case 'maintenance':
            return 'صيانة';
          case 'reserved':
            return 'محجوزة';
          default:
            return r.status;
        }
      },
    },
    { header: isAr ? 'السعر (ج.م)' : 'Price (EGP)', value: (r) => r.price },
    { header: isAr ? 'النزيل الحالي' : 'Current Guest', value: (r) => r.guestName ?? (isAr ? 'لا يوجد ضيف' : 'No Guest') },
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  return exportCsv(rooms, columns, `floor-${floor}-rooms-${dateStr}.csv`);
}

export function exportRoomLogCsv(
  room: ManagerRoom,
  language: 'ar' | 'en'
): boolean {
  if (!room.log || room.log.length === 0) {
    // Export at least one header row with room metadata if log is empty
    const dummyLog: RoomLogItem[] = [
      {
        id: 'no-log',
        action: language === 'ar' ? 'لا يوجد نشاط مسجل' : 'No activity logged',
        time: '-',
        details: language === 'ar' ? `الغرفة ${room.number}` : `Room ${room.number}`,
      },
    ];
    return exportRoomLogCsvInternal(room, dummyLog, language);
  }
  return exportRoomLogCsvInternal(room, room.log, language);
}

function exportRoomLogCsvInternal(
  room: ManagerRoom,
  logItems: RoomLogItem[],
  language: 'ar' | 'en'
): boolean {
  const isAr = language === 'ar';
  const columns: CsvColumn<RoomLogItem>[] = [
    { header: isAr ? 'رقم الغرفة' : 'Room Number', value: () => room.number },
    { header: isAr ? 'الطابق' : 'Floor', value: () => room.floor },
    { header: isAr ? 'الإجراء' : 'Action', value: (item) => item.action },
    { header: isAr ? 'الوقت' : 'Time', value: (item) => item.time },
    { header: isAr ? 'التفاصيل' : 'Details', value: (item) => item.details },
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  return exportCsv(logItems, columns, `room-${room.number}-operations-log-${dateStr}.csv`);
}

export function exportRoomsReportCsv(
  stats: ManagerRoomsStats,
  language: 'ar' | 'en'
): boolean {
  if (!stats) return false;
  const isAr = language === 'ar';
  interface ReportRow {
    category: string;
    metric: string;
    value: string | number;
  }

  const rows: ReportRow[] = [
    { category: isAr ? 'ملخص المخزون' : 'Inventory Summary', metric: isAr ? 'إجمالي الغرف' : 'Total Rooms', value: stats.totalRooms },
    { category: isAr ? 'ملخص المخزون' : 'Inventory Summary', metric: isAr ? 'غرف عادية' : 'Standard Rooms', value: stats.standardRooms },
    { category: isAr ? 'ملخص المخزون' : 'Inventory Summary', metric: isAr ? 'غرف VIP' : 'VIP Rooms', value: stats.vipRooms },
    { category: isAr ? 'ملخص المخزون' : 'Inventory Summary', metric: isAr ? 'عدد الطوابق' : 'Total Floors', value: stats.totalFloors },
    { category: isAr ? 'إشغال الطوابق' : 'Floor Occupancy', metric: isAr ? 'الطابق 1' : 'Floor 1', value: `${stats.floorOccupancy?.[1] ?? 0}%` },
    { category: isAr ? 'إشغال الطوابق' : 'Floor Occupancy', metric: isAr ? 'الطابق 2' : 'Floor 2', value: `${stats.floorOccupancy?.[2] ?? 0}%` },
    { category: isAr ? 'إشغال الطوابق' : 'Floor Occupancy', metric: isAr ? 'الطابق 3' : 'Floor 3', value: `${stats.floorOccupancy?.[3] ?? 0}%` },
    { category: isAr ? 'حالات الغرف' : 'Room Statuses', metric: isAr ? 'مشغولة' : 'Occupied', value: stats.statusCounts.occupied },
    { category: isAr ? 'حالات الغرف' : 'Room Statuses', metric: isAr ? 'محجوزة' : 'Reserved', value: stats.statusCounts.reserved },
    { category: isAr ? 'حالات الغرف' : 'Room Statuses', metric: isAr ? 'متاحة' : 'Available', value: stats.statusCounts.available },
    { category: isAr ? 'حالات الغرف' : 'Room Statuses', metric: isAr ? 'تنظيف' : 'Cleaning', value: stats.statusCounts.cleaning },
    { category: isAr ? 'حالات الغرف' : 'Room Statuses', metric: isAr ? 'صيانة' : 'Maintenance', value: stats.statusCounts.maintenance },
  ];

  const columns: CsvColumn<ReportRow>[] = [
    { header: isAr ? 'الفئة' : 'Category', value: (r) => r.category },
    { header: isAr ? 'المؤشر' : 'Metric', value: (r) => r.metric },
    { header: isAr ? 'القيمة' : 'Value', value: (r) => r.value },
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  return exportCsv(rows, columns, `rooms-report-${dateStr}.csv`);
}
