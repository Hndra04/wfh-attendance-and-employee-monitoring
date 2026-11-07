import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button, Icon } from '@wfh-attendance/ui';

import { useAuth } from '../auth-context';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', {
        replace: true,
        state: { logoutError: 'Server belum dapat mengonfirmasi proses keluar. Silakan coba lagi.' },
      });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="employee-app">
      <aside className="app-sidebar">
        <Link className="brand-lockup" to="/" aria-label="Beranda Absensi">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>
            <strong>Absensi</strong>
            <small>Presensi WFH</small>
          </span>
        </Link>
        <nav className="app-navigation" aria-label="Navigasi utama">
          <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
            <Icon name="home" />
            Hari ini
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => navClass(isActive)}>
            <Icon name="calendar" />
            Riwayat
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => navClass(isActive)}>
            <Icon name="user" />
            Profil
          </NavLink>
          <Button
            variant="ghost"
            className="mobile-logout app-nav-link"
            aria-label="Keluar"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            <Icon name="logout" />
            Keluar
          </Button>
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-avatar" aria-hidden="true">
            {user?.employee?.fullName.charAt(0).toUpperCase() ?? 'E'}
          </span>
          <span className="sidebar-identity">
            <strong>{user?.employee?.fullName ?? user?.email}</strong>
            <small>{user?.employee?.department ?? 'Akun karyawan'}</small>
          </span>
          <Button
            variant="ghost"
            className="logout-button"
            aria-label="Keluar"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            <Icon name="logout" />
          </Button>
        </div>
      </aside>
      <a className="skip-link" href="#main-content">Lewati ke konten</a>
      <div className="app-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
    </div>
  );
}

function navClass(isActive: boolean): string {
  return `app-nav-link${isActive ? ' is-active' : ''}`;
}
