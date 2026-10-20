import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthSession } from '../../core/auth/authManager';
import { ROUTES } from '../../core/constants/routes';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!getAuthSession()) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return children;
}

