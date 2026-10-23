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
import { RoleRoute } from './RoleRoute';
import { ManagerLayout } from '../../layouts/ManagerLayout';
import { ComingSoonPage } from '../../components/common/ComingSoonPage';
import { ManagerDashboardPage } from '../../features/manager-dashboard';
import { ManagerRoomsPage } from '../../features/manager-rooms';
import { ManagerEmployeesPage } from '../../features/manager-employees';
import { ManagerShiftsPage } from '../../features/manager-shifts';
import { ManagerPasswordRequestsPage } from '../../features/manager-password-requests';
import { ManagerRoomTypesPage } from '../../features/manager-room-types';
import { ManagerProfilePage } from '../../features/manager-profile';
import { ManagerSettingsPage } from '../../features/manager-settings';

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
        <Route element={<RoleRoute><ManagerLayout /></RoleRoute>}>
          <Route path="/manager" element={<Navigate to={ROUTES.managerDashboard} replace />} />
          <Route path={ROUTES.managerDashboard} element={<ManagerDashboardPage />} />
          <Route path={ROUTES.managerRooms} element={<ManagerRoomsPage />} />
          <Route path={ROUTES.managerEmployees} element={<ManagerEmployeesPage />} />
          <Route path={ROUTES.managerHousekeeping} element={<ComingSoonPage />} />
          <Route path={ROUTES.managerMaintenance} element={<ComingSoonPage />} />
          <Route path={ROUTES.managerFinance} element={<ComingSoonPage />} />
          <Route path={ROUTES.managerReports} element={<ComingSoonPage />} />
          <Route path={ROUTES.managerRefunds} element={<ComingSoonPage />} />
          <Route path={ROUTES.managerPasswordRequests} element={<ManagerPasswordRequestsPage />} />
          <Route path={ROUTES.managerShifts} element={<ManagerShiftsPage />} />
          <Route path={ROUTES.managerRoomTypes} element={<ManagerRoomTypesPage />} />
          <Route path={ROUTES.managerProfile} element={<ManagerProfilePage />} />
          <Route path={ROUTES.managerSettings} element={<ManagerSettingsPage />} />
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
