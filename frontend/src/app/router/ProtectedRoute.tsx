import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthSession } from '../../core/auth/authManager';
import { ROUTES } from '../../core/constants/routes';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = getAuthSession();
  if (!session) {
    return <Navigate to={ROUTES.login} replace />;
  }

  const role = (session.role || '').toLowerCase();
  if (role === 'manager' || role === 'admin') {
    return <Navigate to={ROUTES.managerDashboard} replace />;
  }

  return <>{children}</>;
}

