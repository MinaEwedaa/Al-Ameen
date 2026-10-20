export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  rooms: '/rooms',
  housekeeping: '/housekeeping',
  maintenance: '/maintenance',
  payments: '/payments',
  shiftHandover: '/shift-handover',
  shiftReport: '/shift-report',
  profile: '/profile',
  settings: '/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
