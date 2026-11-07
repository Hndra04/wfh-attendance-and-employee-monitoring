import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { Button, TextField } from '@wfh-attendance/ui';

import { getErrorMessage } from '../api';
import { useAuth } from '../auth-context';

export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirect = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const returnTo = redirect && redirect !== '/change-password' ? redirect : '/';
  const logoutError = (location.state as { logoutError?: string } | null)?.logoutError;

  if (user) {
    return (
      <Navigate
        to={user.mustChangePassword ? '/change-password' : returnTo}
        replace
      />
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story" aria-label="Informasi presensi karyawan">
        <div className="brand-lockup brand-lockup--light">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>
            <strong>Absensi</strong>
            <small>Presensi WFH</small>
          </span>
        </div>
        <div className="login-story-copy">
          <p className="eyebrow-light">Mulai hari kerja dengan lebih teratur</p>
          <h1>Presensi kerja Anda, tercatat.</h1>
          <p>Lakukan presensi dengan aman, lihat riwayat kehadiran, lalu lanjutkan pekerjaan.</p>
        </div>
        <div className="login-time-card">
          <span className="time-indicator" aria-hidden="true" />
          <span>
            <strong>Waktu Jakarta</strong>
            <small>Tanggal presensi mengikuti UTC+07.00</small>
          </span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">PORTAL KARYAWAN</p>
          <h2>Masuk</h2>
          <p className="muted-copy">Gunakan akun kerja yang diberikan oleh tim HR.</p>
          {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
          <form className="form-stack" onSubmit={(event) => void submit(event)}>
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
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" className="button-wide" disabled={isSubmitting}>
              {isSubmitting ? 'Memproses…' : 'Masuk ke presensi'}
            </Button>
          </form>
          <p className="login-help">Belum memiliki akses? Hubungi administrator HR Anda.</p>
        </div>
      </section>
    </main>
  );
}
