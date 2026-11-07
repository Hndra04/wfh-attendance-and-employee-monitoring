import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { Button, TextField } from '@wfh-attendance/ui';

import { errorMessage } from '../api';
import { useAuth } from '../auth-context';

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const state = location.state as { from?: { pathname?: string }; logoutError?: string } | null;
  const returnTo = state?.from?.pathname ?? '/';

  if (user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : returnTo} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login-story" aria-label="Informasi monitoring karyawan">
        <div className="admin-brand admin-brand--light">
          <span className="admin-brand-mark" aria-hidden="true">M</span>
          <span><strong>Monitoring</strong><small>Panel HRD</small></span>
        </div>
        <div className="admin-login-copy">
          <p className="admin-eyebrow-light">Portal administrasi HR</p>
          <h1>Data karyawan dan presensi.</h1>
          <p>Masuk untuk mengelola data karyawan dan meninjau catatan presensi.</p>
        </div>
        <div className="admin-login-foot">Akses khusus administrator HR</div>
      </section>
      <section className="admin-login-panel">
        <div className="admin-login-form">
          <p className="admin-eyebrow">PORTAL ADMINISTRATOR</p>
          <h2>Masuk</h2>
          <p>Gunakan akun administrator HR yang telah disediakan.</p>
          {state?.logoutError && <p className="admin-error" role="alert">{state.logoutError}</p>}
          <form className="admin-form" onSubmit={(event) => void submit(event)}>
            <TextField
              label="Email kerja"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Kata sandi"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <p className="admin-error" role="alert">{error}</p>}
            <Button type="submit" className="admin-wide-button" disabled={isSubmitting}>
              {isSubmitting ? 'Memproses…' : 'Masuk ke monitoring'}
            </Button>
          </form>
          <p className="admin-login-help">Butuh akses? Hubungi pengelola sistem.</p>
        </div>
      </section>
    </main>
  );
}
