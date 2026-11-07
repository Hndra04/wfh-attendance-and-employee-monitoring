import { Badge } from '@wfh-attendance/ui';

import { useAuth } from '../auth-context';

export function ProfilePage() {
  const { user } = useAuth();
  const employee = user?.employee;

  return (
    <section className="content-page">
      <header className="content-heading">
        <div>
          <p className="eyebrow">AKUN ANDA</p>
          <h1>Profil</h1>
          <p>Informasi karyawan dan identitas akun Anda.</p>
        </div>
      </header>
      <section className="profile-card">
        <div className="profile-avatar" aria-hidden="true">
          {employee?.fullName.charAt(0).toUpperCase() ?? 'E'}
        </div>
        <div className="profile-header">
          <div>
            <h2>{employee?.fullName ?? 'Karyawan'}</h2>
            <p>{employee?.position ?? 'Akun karyawan'}</p>
          </div>
          <Badge tone="success">Akun aktif</Badge>
        </div>
        <dl className="profile-details">
          <div><dt>Email kerja</dt><dd>{user?.email}</dd></div>
          <div><dt>Departemen</dt><dd>{employee?.department ?? '—'}</dd></div>
          <div><dt>Jabatan</dt><dd>{employee?.position ?? '—'}</dd></div>
          <div><dt>ID karyawan</dt><dd>{employee?.id ?? '—'}</dd></div>
        </dl>
        <p className="profile-note">Untuk memperbarui informasi karyawan, hubungi administrator HR Anda.</p>
      </section>
    </section>
  );
}
