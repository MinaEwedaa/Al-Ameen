import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/Toast';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { RoomsPage } from '../features/rooms/pages/RoomsPage';
import { DashboardLayout } from '../layouts/DashboardLayout/DashboardLayout';
import '../styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
});

export function PreviewRouteNotice() {
  const { pathname } = useLocation();

  return (
    <section className="ui-card" role="status">
      <h1>Development preview</h1>
      <p>Preview route: {pathname}</p>
      <p>This feature is not included in the Dashboard and Rooms preview.</p>
    </section>
  );
}

export function DashboardPreview() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="*" element={<PreviewRouteNotice />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider><DashboardPreview /></ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);