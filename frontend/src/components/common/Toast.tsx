import type { ReactNode } from 'react';

/**
 * Common ToastProvider is now unified with the core UI ToastProvider.
 * This remains as a pass-through wrapper for backwards compatibility.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

