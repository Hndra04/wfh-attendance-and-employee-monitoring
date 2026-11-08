import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@wfh-attendance/ui';

import { useAuth } from '../auth-context';

export function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setLogoutError('');
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Server belum dapat mengonfirmasi proses keluar. Silakan coba lagi.');
      navigate('/login', {
        replace: true,
        state: { logoutError: 'Server belum dapat mengonfirmasi proses keluar. Silakan coba lagi.' },
      });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/" aria-label="Beranda Monitoring">
          <span className="admin-brand-mark" aria-hidden="true">M</span>
          <span><strong>Monitoring</strong><small>Panel HRD</small></span>
        </Link>
        <nav className="admin-navigation" aria-label="Navigasi utama">
          <NavLink to="/" end className={({ isActive }) => navigationClass(isActive)}>
            <span aria-hidden="true">▦</span>Ringkasan
          </NavLink>
          <NavLink to="/employees" className={({ isActive }) => navigationClass(isActive)}>
            <span aria-hidden="true">♙</span>Karyawan
          </NavLink>
          <NavLink to="/attendance" className={({ isActive }) => navigationClass(isActive)}>
            <span aria-hidden="true">◷</span>Presensi
          </NavLink>
          <Button
            variant="ghost"
            className="admin-mobile-logout"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            <span aria-hidden="true">↗</span>Keluar
          </Button>
        </nav>
        <div className="admin-user">
          <span className="admin-avatar" aria-hidden="true">
            {user?.email.charAt(0).toUpperCase() ?? 'H'}
          </span>
          <span className="admin-user-copy"><strong>Administrator HR</strong><small>{user?.email}</small></span>
          <Button
            variant="ghost"
            className="admin-desktop-logout"
            aria-label="Keluar"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
          >
            ↗
          </Button>
        </div>
      </aside>
      <a className="admin-skip-link" href="#admin-main">Lewati ke konten</a>
      <main className="admin-main" id="admin-main" tabIndex={-1}>
        {logoutError && <p className="admin-error" role="alert">{logoutError}</p>}
        <Outlet />
      </main>
    </div>
  );
}

function navigationClass(isActive: boolean) {
  return `admin-nav-link${isActive ? ' is-active' : ''}`;
}
