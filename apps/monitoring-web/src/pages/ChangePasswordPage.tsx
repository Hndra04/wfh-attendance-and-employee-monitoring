import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, TextField } from '@wfh-attendance/ui';

import { errorMessage } from '../api';
import { useAuth } from '../auth-context';

export function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(errorMessage(passwordError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-password-page">
      <section className="admin-password-card">
        <p className="admin-eyebrow">KEAMANAN AKUN</p>
        <h1>Buat kata sandi baru</h1>
        <p>Ganti kata sandi sementara sebelum membuka panel monitoring.</p>
        <form className="admin-form" onSubmit={(event) => void submit(event)}>
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
          {error && <p className="admin-error" role="alert">{error}</p>}
          <Button type="submit" className="admin-wide-button" disabled={isSubmitting}>
            {isSubmitting ? 'Memperbarui…' : 'Perbarui kata sandi'}
          </Button>
        </form>
      </section>
    </main>
  );
}
