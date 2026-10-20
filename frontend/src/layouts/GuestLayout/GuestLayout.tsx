import type { ReactNode } from 'react';

export function GuestLayout({ children }: { children: ReactNode }) {
  return <main className="guest-layout">{children}</main>;
}
