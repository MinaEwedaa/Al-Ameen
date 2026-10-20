export const ROLES = {
  admin: 'Admin',
  manager: 'Manager',
  receptionist: 'Receptionist',
  housekeeping: 'Housekeeping',
  maintenance: 'Maintenance',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
