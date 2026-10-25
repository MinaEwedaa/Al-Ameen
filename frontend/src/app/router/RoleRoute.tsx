import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthSession } from '../../core/auth/authManager';
import { ROLES, type Role } from '../../core/constants/roles';
import { ROUTES } from '../../core/constants/routes';

interface RoleRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export function RoleRoute({ children, allowedRoles = [ROLES.manager] }: RoleRouteProps) {
  const session = getAuthSession();

  if (!session) {
    return <Navigate to={ROUTES.login} replace />;
  }

  const userRole = (session.role || '').toLowerCase();
  const allowed = allowedRoles.map((r) => String(r).toLowerCase());

  if (!allowed.includes(userRole) && userRole !== 'admin') {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}
