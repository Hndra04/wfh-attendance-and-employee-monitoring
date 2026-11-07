import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@wfh-attendance/ui';

import { AuthProvider, useAuth } from './auth-context';
import { AdminShell } from './components/AdminShell';
import { AttendanceDetailPage } from './pages/AttendanceDetailPage';
import { AttendancePage } from './pages/AttendancePage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  return (
    <AuthProvider>
      <AdminRoutes />
    </AuthProvider>
  );
}

function AdminRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <main className="admin-loading"><p>Memulihkan sesi…</p></main>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute isAuthenticated={Boolean(user)} />}>
        <Route element={<AdminShell />}>
          <Route
            path="/change-password"
            element={user?.mustChangePassword ? <ChangePasswordPage /> : <Navigate to="/" replace />}
          />
          <Route element={<AdminAccess mustChangePassword={user?.mustChangePassword ?? true} />}>
            <Route index element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/attendance/:attendanceId" element={<AttendanceDetailPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminAccess({ mustChangePassword }: { mustChangePassword: boolean }) {
  return mustChangePassword ? <Navigate to="/change-password" replace /> : <Outlet />;
}
