import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { Badge, EmptyState, Spinner } from '@wfh-attendance/ui';

import { apiRequest, errorMessage, type Attendance } from '../api';
import { AuthenticatedImage } from '../components/AuthenticatedImage';
import { formatDate, formatTime } from './AttendancePage';

export function AttendanceDetailPage() {
  const { attendanceId } = useParams();
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!attendanceId) return;
    apiRequest<{ data: Attendance }>(`/attendances/${encodeURIComponent(attendanceId)}`)
      .then((result) => {
        if (active) setAttendance(result.data);
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attendanceId]);

  if (!attendanceId) return <Navigate to="/attendance" replace />;
  return (
    <section className="admin-content">
      <Link to="/attendance" className="admin-back-link">← Kembali ke presensi</Link>
      {loading ? (
        <div className="admin-loading-card"><Spinner label="Memuat detail presensi" /></div>
      ) : error ? (
        <p className="admin-error" role="alert">{error}</p>
      ) : attendance ? (
        <>
          <header className="admin-page-heading attendance-detail-heading">
            <div>
              <p className="admin-eyebrow">DETAIL PRESENSI</p>
              <h1>{attendance.employee?.fullName ?? 'Karyawan'}</h1>
              <p>{attendance.employee?.department ?? '—'} · {formatDate(attendance.attendanceDate)}</p>
            </div>
            <Badge tone={attendance.status === 'LATE' ? 'warning' : 'success'}>
              {attendance.status === 'LATE' ? 'Terlambat' : 'Hadir'}
            </Badge>
          </header>
          <section className="attendance-detail-times" aria-label="Waktu presensi">
            <div><span>Presensi masuk</span><strong>{formatTime(attendance.checkInAt)}</strong></div>
            <div><span>Presensi pulang</span><strong>{formatTime(attendance.checkOutAt)}</strong></div>
            <div><span>Durasi kerja</span><strong>{formatDuration(attendance.durationMinutes)}</strong></div>
          </section>
          <section className="attendance-detail-photos" aria-label="Foto presensi">
            <PhotoPanel label="Foto masuk" time={attendance.checkInAt} path={attendance.checkInPhotoUrl} />
            <PhotoPanel label="Foto pulang" time={attendance.checkOutAt} path={attendance.checkOutPhotoUrl} />
          </section>
        </>
      ) : (
        <EmptyState title="Catatan presensi tidak ditemukan" />
      )}
    </section>
  );
}

function PhotoPanel({ label, time, path }: { label: string; time: string | null; path: string | null }) {
  return (
    <figure className="attendance-photo-panel">
      <div><strong>{label}</strong><span>{formatTime(time)} · Jakarta</span></div>
      {path ? (
        <AuthenticatedImage path={path} alt={label} className="attendance-detail-photo" />
      ) : (
        <EmptyState title={`Belum ada ${label.toLowerCase()}`} />
      )}
    </figure>
  );
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return '—';
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}
