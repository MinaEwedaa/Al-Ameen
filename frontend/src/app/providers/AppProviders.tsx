import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider as CommonToastProvider } from '../../components/common/Toast';
import { ToastProvider } from '../../components/ui/Toast';
import { LanguageProvider } from '../../core/i18n/LanguageContext';
import { ThemeProvider } from '../../core/theme/ThemeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
    // Mutations (payments, reservations, check-in...) must never be retried automatically
    mutations: { retry: false },
  },
});

// نظام الـ Toast موحد الآن عبر ToastProvider الأساسي، وCommonToastProvider يعمل كـ wrapper للتوافقية.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <CommonToastProvider>{children}</CommonToastProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}