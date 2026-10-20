import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '../../layouts/DashboardLayout/DashboardLayout';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { RoomsPage } from '../../features/rooms/pages/RoomsPage';
import { HousekeepingPage } from '../../features/housekeeping/pages/HousekeepingPage';
import { MaintenancePage } from '../../features/maintenance/pages/MaintenancePage';
import { PaymentsPage } from '../../features/payments/pages/PaymentsPage';
import { ShiftHandoverPage } from '../../features/shift-handover/pages/ShiftHandoverPage';
import { ShiftReportPage } from '../../features/shift-report/pages/ShiftReportPage';
import { ProfilePage } from '../../features/profile/pages/ProfilePage';
import { SettingsPage } from '../../features/settings/pages/SettingsPage';
import { ROUTES } from '../../core/constants/routes';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.rooms} element={<RoomsPage />} />
          <Route path={ROUTES.housekeeping} element={<HousekeepingPage />} />
          <Route path={ROUTES.maintenance} element={<MaintenancePage />} />
          <Route path={ROUTES.payments} element={<PaymentsPage />} />
          <Route path={ROUTES.shiftHandover} element={<ShiftHandoverPage />} />
          <Route path={ROUTES.shiftReport} element={<ShiftReportPage />} />
          <Route path={ROUTES.profile} element={<ProfilePage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
        </Route>
          {import.meta.env.DEV && (
            <Route path="/__dev/shift-handover" element={<DashboardLayout />}>
              <Route index element={<ShiftHandoverPage />} />
            </Route>
          )}
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
