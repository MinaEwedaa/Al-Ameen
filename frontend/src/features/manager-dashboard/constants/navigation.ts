// Manager Dashboard Local Navigation Targets
// TODO: Switch to core/constants/routes.ts after Member A's shell is merged
export const MANAGER_NAV_TARGETS = {
  maintenance: '/manager/maintenance',
  housekeeping: '/manager/housekeeping',
  payments: '/manager/payments',
  rooms: '/manager/rooms',
  shifts: '/manager/shifts',
  reports: '/manager/reports',
  staff: '/manager/staff',
} as const;

export function getIssueNavigationTarget(issueType: string, icon: string): string {
  if (icon === 'wrench' || issueType.includes('صيانة') || issueType.includes('تسريب')) {
    return MANAGER_NAV_TARGETS.maintenance;
  }
  if (icon === 'sparkles' || issueType.includes('نظافة') || issueType.includes('تجهيز')) {
    return MANAGER_NAV_TARGETS.housekeeping;
  }
  if (icon === 'wallet' || issueType.includes('دفع') || issueType.includes('مالية')) {
    return MANAGER_NAV_TARGETS.payments;
  }
  return MANAGER_NAV_TARGETS.rooms;
}

export function navigateToManagerRoute(target: string): void {
  // If in the local dev-preview harness, redirect room navigation to the harness rooms page
  if (typeof window !== 'undefined' && window.location.pathname.includes('manager-preview.html')) {
    if (target.startsWith(MANAGER_NAV_TARGETS.rooms)) {
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'manager-rooms');
      window.location.href = url.toString();
      return;
    }
  }
  // Standard route navigation for the manager shell
  if (typeof window !== 'undefined') {
    window.location.href = target;
  }
}
