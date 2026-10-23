import { exportCsv, type CsvColumn } from '../../../utils/exportCsv';
import type { DashboardSummary, StaffActivityItem } from '../types/manager-dashboard.types';

interface SummaryCsvRow {
  category: string;
  metric: string;
  value: string | number;
}

export function exportDashboardSummaryCsv(data: DashboardSummary, language: 'ar' | 'en'): boolean {
  const isAr = language === 'ar';

  const columns: CsvColumn<SummaryCsvRow>[] = [
    {
      header: isAr ? 'القسم' : 'Category',
      value: (row) => row.category,
    },
    {
      header: isAr ? 'المؤشر' : 'Metric',
      value: (row) => row.metric,
    },
    {
      header: isAr ? 'القيمة' : 'Value',
      value: (row) => row.value,
    },
  ];

  const rows: SummaryCsvRow[] = [
    // KPIs
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'إجمالي الغرف' : 'Total Rooms',
      value: data.kpis.totalRooms.value,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'غرف مشغولة' : 'Occupied Rooms',
      value: data.kpis.occupiedRooms.value,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'غرف متاحة' : 'Available Rooms',
      value: data.kpis.availableRooms.value,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'قيد التنظيف' : 'Under Cleaning',
      value: data.kpis.cleaningRooms.value,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'تحت الصيانة' : 'Under Maintenance',
      value: data.kpis.maintenanceRooms.value,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'نسبة الإشغال' : 'Occupancy Rate',
      value: `${data.kpis.occupancyRate.value}%`,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'إيراد اليوم' : "Today's Revenue",
      value: data.kpis.todayRevenue.value,
    },
    {
      category: isAr ? 'مؤشرات الأداء' : 'KPIs',
      metric: isAr ? 'مهام معلقة' : 'Pending Tasks',
      value: data.kpis.pendingTasks.value,
    },

    // Revenue
    {
      category: isAr ? 'الإيرادات' : 'Revenue',
      metric: isAr ? 'اليوم' : 'Today',
      value: data.revenue.today,
    },
    {
      category: isAr ? 'الإيرادات' : 'Revenue',
      metric: isAr ? 'الأسبوع' : 'Week',
      value: data.revenue.week,
    },
    {
      category: isAr ? 'الإيرادات' : 'Revenue',
      metric: isAr ? 'الشهر' : 'Month',
      value: data.revenue.month,
    },
    {
      category: isAr ? 'الإيرادات' : 'Revenue',
      metric: isAr ? 'العام' : 'Year',
      value: data.revenue.year,
    },
    {
      category: isAr ? 'الإيرادات' : 'Revenue',
      metric: isAr ? 'نسبة التغير' : 'Change Rate',
      value: `+${data.revenue.changePercent}%`,
    },

    // Rooms Overview
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'إجمالي الغرف' : 'Total Rooms',
      value: data.roomsOverview.total,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'غرف عادية' : 'Standard Rooms',
      value: data.roomsOverview.standardCount,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'غرف VIP' : 'VIP Rooms',
      value: data.roomsOverview.vipCount,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'مشغولة' : 'Occupied',
      value: data.roomsOverview.statusCounts.occupied,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'متاحة' : 'Available',
      value: data.roomsOverview.statusCounts.available,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'محجوزة' : 'Reserved',
      value: data.roomsOverview.statusCounts.reserved,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'تنظيف' : 'Cleaning',
      value: data.roomsOverview.statusCounts.cleaning,
    },
    {
      category: isAr ? 'نظرة الغرف' : 'Rooms Overview',
      metric: isAr ? 'صيانة' : 'Maintenance',
      value: data.roomsOverview.statusCounts.maintenance,
    },
  ];

  const fileName = `manager-dashboard-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  return exportCsv(rows, columns, fileName);
}

export function exportStaffActivityCsv(
  staffList: StaffActivityItem[],
  language: 'ar' | 'en',
): boolean {
  const isAr = language === 'ar';

  const columns: CsvColumn<StaffActivityItem>[] = [
    {
      header: isAr ? 'الموظف' : 'Employee',
      value: (row) => row.name,
    },
    {
      header: isAr ? 'الدور' : 'Role',
      value: (row) => row.role,
    },
    {
      header: isAr ? 'الوردية' : 'Shift',
      value: (row) => row.shift,
    },
    {
      header: isAr ? 'المهام المكتملة' : 'Completed Tasks',
      value: (row) => (row.completedTasks !== null ? row.completedTasks : 0),
    },
    {
      header: isAr ? 'المهام المعلقة' : 'Pending Tasks',
      value: (row) => row.pendingTasks,
    },
    {
      header: isAr ? 'الحالة' : 'Status',
      value: (row) => row.statusLabel,
    },
  ];

  const fileName = `staff-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  return exportCsv(staffList, columns, fileName);
}
