import type { ReactNode } from 'react';
import { Logo } from '../../components/common/Logo';
import './AuthLayout.css';

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-layout"><section className="auth-layout__brand"><Logo className="auth-layout__logo" /></section>{children}</main>;
}
