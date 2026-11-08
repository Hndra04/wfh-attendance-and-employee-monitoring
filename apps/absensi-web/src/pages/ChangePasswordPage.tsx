import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { Button, TextField } from '@wfh-attendance/ui';

import { getErrorMessage } from '../api';
import { useAuth } from '../auth-context';

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user?.mustChangePassword) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('Kata sandi baru tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/login', { replace: true });
    } catch (passwordError) {
      setError(getErrorMessage(passwordError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="password-page">
      <section className="password-card">
        <span className="password-icon" aria-hidden="true">⌑</span>
        <p className="eyebrow">KEAMANAN AKUN</p>
        <h1>Buat kata sandi baru</h1>
        <p className="muted-copy">
          Anda perlu mengganti kata sandi sebelum dapat melakukan presensi.
        </p>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <TextField
            label="Kata sandi sementara"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextField
            label="Kata sandi baru"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            hint="Gunakan minimal 8 karakter."
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            label="Konfirmasi kata sandi baru"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" className="button-wide" disabled={isSubmitting}>
            {isSubmitting ? 'Memperbarui…' : 'Perbarui kata sandi'}
          </Button>
        </form>
      </section>
    </main>
  );
}
