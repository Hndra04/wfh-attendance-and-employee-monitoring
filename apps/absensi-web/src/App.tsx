import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@wfh-attendance/ui';

import { AuthProvider, useAuth } from './auth-context';
import { AppShell } from './components/AppShell';
import { AttendanceDetailPage } from './pages/AttendanceDetailPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { HistoryPage } from './pages/HistoryPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { TodayPage } from './pages/TodayPage';

export default function App() {
  return (
    <AuthProvider>
      <EmployeeRoutes />
    </AuthProvider>
  );
}

function EmployeeRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="auth-loading">
        <span className="loading-mark" aria-hidden="true">A</span>
        <p>Memulihkan sesi Anda…</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute isAuthenticated={Boolean(user)} />}>
        <Route element={<AppShell />}>
          <Route
            path="/change-password"
            element={user?.mustChangePassword ? <ChangePasswordPage /> : <Navigate to="/" replace />}
          />
          <Route element={<AttendanceAccess mustChangePassword={user?.mustChangePassword ?? true} />}>
            <Route index element={<TodayPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:attendanceId" element={<AttendanceDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AttendanceAccess({ mustChangePassword }: { mustChangePassword: boolean }) {
  return mustChangePassword ? <Navigate to="/change-password" replace /> : <Outlet />;
}
