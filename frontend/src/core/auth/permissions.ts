import type { Role } from '../constants/roles';

export type Permission = 'dashboard' | 'rooms' | 'housekeeping' | 'maintenance' | 'payments' | 'shift';

export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: ['dashboard', 'rooms', 'housekeeping', 'maintenance', 'payments', 'shift'],
  Manager: ['dashboard', 'rooms', 'housekeeping', 'maintenance', 'payments', 'shift'],
  Receptionist: ['dashboard', 'rooms', 'housekeeping', 'maintenance', 'payments', 'shift'],
  Housekeeping: ['housekeeping', 'shift'],
  Maintenance: ['maintenance', 'shift'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return DEFAULT_PERMISSIONS[role].includes(permission);
}
