// Pure DTO-to-UI Mapping Functions for Manager Dashboard
// Follows Manager API Contract v1.2

import type {
  DashboardOverviewDto,
  DashboardRevenueDto,
  DashboardIssueDto,
  HotelActivityDto,
  ShiftOverviewDto,
  StaffMemberDto,
  PaymentMethodEnum,
} from '../types/manager-dashboard.dto';

import type {
  DashboardKpis,
  RoomsOverview,
  RevenueOverview,
  PaymentMethodBreakdown,
  CriticalIssueItem,
  RecentActivityItem,
  ShiftOverviewItem,
  StaffActivityOverview,
  DashboardSummary,
} from '../types/manager-dashboard.types';
import { formatClock } from '../../../utils/format';

/**
 * Maps raw DashboardOverviewDto to UI KPI items and RoomsOverview models.
 */
export function mapDashboardOverviewDto(dto: DashboardOverviewDto): {
  kpis: DashboardKpis;
  roomsOverview: RoomsOverview;
} {
  const kpis: DashboardKpis = {
    totalRooms: {
      id: 'total-rooms',
      label: 'إجمالي الغرف',
      value: dto.kpis.total_rooms,
      formattedValue: String(dto.kpis.total_rooms),
      subtitle: '3 طوابق نشطة', // TODO confirm with backend
      icon: 'bed',
      tone: 'teal',
    },
    occupiedRooms: {
      id: 'occupied-rooms',
      label: 'الغرف المشغولة',
      value: dto.kpis.occupied_rooms,
      formattedValue: String(dto.kpis.occupied_rooms),
      subtitle: `${dto.kpis.occupancy_rate}% نسبة الإشغال`, // TODO confirm with backend
      icon: 'users',
      tone: 'teal',
    },
    availableRooms: {
      id: 'available-rooms',
      label: 'غرف متاحة',
      value: dto.kpis.available_rooms,
      formattedValue: String(dto.kpis.available_rooms),
      subtitle: 'جاهزة للتسكين الفوري', // TODO confirm with backend
      icon: 'check',
      tone: 'green',
    },
    cleaningRooms: {
      id: 'cleaning-rooms',
      label: 'قيد التنظيف',
      value: dto.kpis.cleaning_rooms,
      formattedValue: String(dto.kpis.cleaning_rooms),
      subtitle: 'جاري التجهيز للضيوف', // TODO confirm with backend
      icon: 'sparkles',
      tone: 'gold',
    },
    maintenanceRooms: {
      id: 'maintenance-rooms',
      label: 'تحت الصيانة',
      value: dto.kpis.maintenance_rooms,
      formattedValue: String(dto.kpis.maintenance_rooms),
      subtitle: 'تتطلب تدخل فني', // TODO confirm with backend
      icon: 'wrench',
      tone: 'rose',
    },
    occupancyRate: {
      id: 'occupancy-rate',
      label: 'نسبة الإشغال',
      value: dto.kpis.occupancy_rate,
      formattedValue: `${dto.kpis.occupancy_rate}%`,
      subtitle: 'محسوبة من المخزون الحالي', // TODO confirm with backend
      icon: 'file',
      tone: 'green',
    },
    todayRevenue: {
      id: 'today-revenue',
      label: 'إيراد اليوم',
      value: dto.kpis.today_revenue,
      formattedValue: `${Math.round(dto.kpis.today_revenue / 100) / 10}k`, // TODO confirm with backend
      subtitle: dto.kpis.today_revenue_change_pct
        ? `+${dto.kpis.today_revenue_change_pct}% عن الأمس`
        : '+12.4% عن الأمس', // TODO confirm with backend
      icon: 'wallet',
      tone: 'gold',
    },
    pendingTasks: {
      id: 'pending-tasks',
      label: 'مهام معلقة',
      value: dto.kpis.pending_tasks,
      formattedValue: String(dto.kpis.pending_tasks),
      subtitle: 'عبر 3 أقسام', // TODO confirm with backend
      icon: 'clock',
      tone: 'amber',
    },
  };

  const roomsOverview: RoomsOverview = {
    total: dto.room_counts.total,
    occupancyPercent: dto.kpis.occupancy_rate,
    vipCount: dto.room_counts.vip,
    standardCount: dto.room_counts.standard,
    statusCounts: {
      occupied: dto.room_counts.occupied,
      available: dto.room_counts.available,
      reserved: dto.room_counts.reserved,
      cleaning: dto.room_counts.cleaning,
      maintenance: dto.room_counts.maintenance,
    },
    perFloorOccupancy: (dto.floors_occupancy || []).map((floor) => ({
      floorNumber: floor.floor,
      label:
        floor.floor === 1
          ? 'الطابق الأول · 7 عادية / 5 VIP'
          : floor.floor === 2
          ? 'الطابق الثاني · 7 عادية / 5 VIP'
          : 'الطابق الثالث · 7 عادية / 5 VIP', // TODO confirm with backend
      standardCount: floor.standard_count ?? 7,
      vipCount: floor.vip_count ?? 5,
      occupancyPercent: floor.occupancy_pct,
    })),
  };

  return { kpis, roomsOverview };
}

/**
 * Localizes payment method name and maps tone based on confirmed enum.
 */
function mapPaymentMethod(
  method: PaymentMethodEnum,
  percent: number,
  amount?: number
): PaymentMethodBreakdown {
  switch (method) {
    case 'CASH':
      return {
        id: 'cash',
        name: 'كاش',
        percent,
        amount,
        tone: 'primary',
      };
    case 'INSTAPAY':
      return {
        id: 'instapay',
        name: 'انستاباي',
        percent,
        amount,
        tone: 'teal',
      };
    case 'VODAFONE_CASH':
      return {
        id: 'vodafone',
        name: 'فودافون كاش',
        percent,
        amount,
        tone: 'gold',
      };
    case 'CARD':
    default:
      return {
        id: 'card',
        name: 'بطاقة بنكية',
        percent,
        amount,
        tone: 'neutral',
      };
  }
}

/**
 * Maps raw DashboardRevenueDto to UI RevenueOverview model.
 * Note: Contract v1.2 does not guarantee week/month/year totals.
 * Fallbacks are documented as TODO confirm with backend.
 */
export function mapDashboardRevenueDto(dto: DashboardRevenueDto): RevenueOverview {
  const chartPoints = (dto.chart_series || []).map((p) => p.revenue);
  const chartLabels = (dto.chart_series || []).map(
    (p) => p.day_label || p.date || ''
  );

  // TODO confirm with backend: week, month, year totals aggregation not guaranteed in v1.2
  const computedWeekTotal =
    dto.week_total ??
    (chartPoints.length > 0
      ? chartPoints.reduce((acc, curr) => acc + curr, 0)
      : dto.today_revenue * 7);

  const computedMonthTotal = dto.month_total ?? dto.today_revenue * 27.5;
  const computedYearTotal = dto.year_total ?? dto.today_revenue * 300;

  const paymentMethods: PaymentMethodBreakdown[] = (dto.payment_methods || []).map(
    (pm) => mapPaymentMethod(pm.method, pm.percentage, pm.amount)
  );

  return {
    today: dto.today_revenue,
    week: computedWeekTotal,
    month: computedMonthTotal,
    year: computedYearTotal,
    changePercent: dto.comparison_percentage,
    paymentMethods,
    chartSeries: {
      points: chartPoints,
      labels: chartLabels,
      data: (dto.chart_series || []).map((p) => ({
        day: p.day_label || p.date,
        value: p.revenue,
      })),
    },
  };
}

function formatIsoOrRelativeTime(timestamp: string): string {
  if (!timestamp) return '';
  if (timestamp.includes('T')) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      const diffMs = Math.max(0, Date.now() - d.getTime());
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes <= 1) return 'الآن';
      if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours === 1) return 'منذ ساعة';
      if (diffHours === 2) return 'منذ ساعتين';
      if (diffHours < 24) return `منذ ${diffHours} ساعات`;
      return formatClock(d, 'ar');
    }
  }
  return timestamp;
}

/**
 * Maps raw DashboardIssueDto array to UI CriticalIssueItem array.
 */
export function mapDashboardIssuesDto(dtos: DashboardIssueDto[]): CriticalIssueItem[] {
  return (dtos || []).map((issue) => {
    const isCritical = issue.priority === 'critical';
    const isHigh = issue.priority === 'high';
    const severity = isCritical ? 'critical' : isHigh ? 'high' : 'medium';
    const severityLabel = isCritical ? 'عاجل' : isHigh ? 'مرتفع' : 'متابعة';

    const icon =
      issue.issue_type === 'housekeeping'
        ? 'sparkles'
        : issue.issue_type === 'maintenance'
        ? 'wrench'
        : 'file';

    return {
      id: issue.id,
      title: issue.title,
      roomNumber: issue.room_number ?? '',
      issueType: issue.issue_type,
      severity,
      severityLabel,
      icon,
      createdAt: formatIsoOrRelativeTime(issue.reported_at),
    };
  });
}

/**
 * Maps raw HotelActivityDto array to UI RecentActivityItem array.
 */
export function mapHotelActivitiesDto(dtos: HotelActivityDto[]): RecentActivityItem[] {
  return (dtos || []).map((activity) => {
    let type: RecentActivityItem['type'] = 'payment';
    let icon = 'wallet';
    let tone: RecentActivityItem['tone'] = 'teal';

    if (activity.category === 'room') {
      type = 'checkin';
      icon = 'check';
      tone = 'primary';
    } else if (activity.category === 'payment') {
      type = 'payment';
      icon = 'wallet';
      tone = 'teal';
    } else if (activity.category === 'shift') {
      type = 'cleaning';
      icon = 'sparkles';
      tone = 'gold';
    } else {
      type = 'maintenance';
      icon = 'wrench';
      tone = 'amber';
    }

    return {
      id: activity.id,
      type,
      title: activity.title,
      description: activity.description,
      time: formatIsoOrRelativeTime(activity.timestamp),
      icon,
      tone,
    };
  });
}

/** ISO time from the contract -> "07:00 ص" in Cairo time */
function formatShiftClock(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Cairo' }).format(date);
}

/**
 * Maps raw ShiftOverviewDto array to UI ShiftOverviewItem array.
 */
export function mapShiftsOverviewDto(dtos: ShiftOverviewDto[]): ShiftOverviewItem[] {
  return (dtos || []).map((shift) => {
    const shiftName =
      shift.shift_type === 'MORNING'
        ? 'الوردية الصباحية'
        : shift.shift_type === 'EVENING'
        ? 'الوردية المسائية'
        : 'الوردية الليلية'; // Confirmed enum MORNING | EVENING | NIGHT

    const status =
      shift.status === 'ACTIVE'
        ? 'active'
        : shift.status === 'SCHEDULED'
        ? 'upcoming'
        : 'completed'; // Confirmed enum SCHEDULED | ACTIVE | COMPLETED | CANCELLED

    const statusLabel =
      status === 'active' ? 'نشطة' : status === 'upcoming' ? 'قادمة' : 'مكتملة';

    return {
      id: shift.shift_id ?? shift.shift_type,
      name: shiftName,
      timeRange: `${formatShiftClock(shift.start_time)} - ${formatShiftClock(shift.end_time)}`,
      staffName: shift.staff?.full_name ?? '—',
      revenue: shift.gross_revenue,
      roomsCount: shift.rooms_handled,
      status,
      statusLabel,
    };
  });
}

/**
 * Maps raw StaffMemberDto array to UI StaffActivityOverview model.
 */
export function mapStaffMembersDto(dtos: StaffMemberDto[]): StaffActivityOverview {
  // On shift = checked in on today's running shift (contract: today_shift.presence, null = not checked in)
  const isOnShift = (s: StaffMemberDto) => s.today_shift?.status === 'ACTIVE' && Boolean(s.today_shift.presence);
  const activeStaff = (dtos || []).filter(isOnShift);

  const staffList = (dtos || []).map((staff) => {
    // Map contract role enum to Arabic label
    const roleLabel =
      staff.staff_type === 'MANAGER'
        ? 'مدير'
        : staff.staff_type === 'RECEPTIONIST'
        ? 'استقبال'
        : staff.staff_type === 'HOUSEKEEPER'
        ? 'تنظيف'
        : staff.staff_type === 'TECHNICIAN'
        ? 'صيانة'
        : 'إدارة';

    const presence = staff.today_shift?.presence ?? null;
    const status: 'on_shift' | 'available' | 'on_break' =
      presence === 'ON_DUTY' ? 'on_shift' : presence === 'ON_BREAK' ? 'on_break' : 'available';
    const statusLabel =
      status === 'on_shift'
        ? 'في الوردية'
        : status === 'available'
        ? 'متاح'
        : 'استراحة';
    const shiftName =
      staff.today_shift?.shift_type === 'MORNING'
        ? 'الصباحية'
        : staff.today_shift?.shift_type === 'EVENING'
        ? 'المسائية'
        : staff.today_shift?.shift_type === 'NIGHT'
        ? 'الليلية'
        : 'الوردية الحالية';

    return {
      id: staff.staff_id,
      name: staff.full_name,
      avatarLetter: staff.full_name.trim().charAt(0) || 'م',
      role: roleLabel,
      shift: shiftName,
      completedTasks: staff.workload?.completed_today ?? null,
      pendingTasks: staff.workload?.open ?? 0,
      status,
      statusLabel,
    };
  });

  return {
    activeStaffCount: activeStaff.length > 0 ? activeStaff.length : staffList.length,
    staffList,
  };
}

/**
 * Composes all mapped sections into the complete DashboardSummary UI model.
 */
export function mapCompositeDashboardSummary(
  overview: DashboardOverviewDto,
  revenue: DashboardRevenueDto,
  issues: DashboardIssueDto[],
  activities: HotelActivityDto[],
  shifts: ShiftOverviewDto[],
  staff: StaffMemberDto[]
): DashboardSummary {
  const { kpis, roomsOverview } = mapDashboardOverviewDto(overview);
  const revenueOverview = mapDashboardRevenueDto(revenue);
  const criticalIssues = mapDashboardIssuesDto(issues);
  const recentActivities = mapHotelActivitiesDto(activities);
  const shiftsOverview = mapShiftsOverviewDto(shifts);
  const staffActivity = mapStaffMembersDto(staff);

  return {
    kpis,
    revenue: revenueOverview,
    roomsOverview,
    criticalIssues,
    shifts: shiftsOverview,
    activities: recentActivities,
    staffActivity,
  };
}
