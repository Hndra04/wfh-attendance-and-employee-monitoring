import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { Badge, Button, EmptyState, Spinner } from '@wfh-attendance/ui';

import { apiRequest, getErrorMessage, type AttendanceRecord } from '../api';
import { AuthenticatedPhoto } from '../components/AuthenticatedPhoto';
import { formatDate, formatTime } from './TodayPage';

export function AttendanceDetailPage() {
  const { attendanceId } = useParams();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!attendanceId) return;

    apiRequest<{ data: AttendanceRecord }>(`/attendances/me/${encodeURIComponent(attendanceId)}`)
      .then((result) => {
        if (active) setRecord(result.data);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attendanceId]);

  if (!attendanceId) return <Navigate to="/history" replace />;

  return (
    <section className="content-page">
      <Link to="/history" className="back-link">← Kembali ke riwayat</Link>
      {isLoading ? (
        <div className="loading-panel"><Spinner label="Memuat detail presensi" /></div>
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : record ? (
        <>
          <header className="content-heading detail-heading">
            <div>
              <p className="eyebrow">DETAIL PRESENSI</p>
              <h1>{formatDate(record.attendanceDate)}</h1>
              <p>Waktu ditampilkan dalam zona Jakarta (UTC+7).</p>
            </div>
            <Badge tone={record.status === 'LATE' ? 'warning' : 'success'}>
              {record.status === 'LATE' ? 'Terlambat' : 'Hadir'}
            </Badge>
          </header>
          <div className="detail-summary">
            <DetailTime label="Presensi masuk" value={formatTime(record.checkInAt)} />
            <DetailTime label="Presensi pulang" value={formatTime(record.checkOutAt)} />
            <DetailTime label="Durasi" value={formatDetailDuration(record.durationMinutes)} />
          </div>
          {record.notes && (
            <section className="detail-note">
              <h2>Catatan</h2>
              <p>{record.notes}</p>
            </section>
          )}
          <section className="detail-photos">
            <PhotoPanel label="Foto presensi masuk" timestamp={record.checkInAt} path={record.checkInPhotoUrl} />
            {record.checkOutPhotoUrl ? (
              <PhotoPanel label="Foto presensi pulang" timestamp={record.checkOutAt} path={record.checkOutPhotoUrl} />
            ) : (
              <EmptyState title="Tidak ada foto presensi pulang" description="Catatan ini tidak memiliki foto presensi pulang." />
            )}
          </section>
        </>
      ) : (
        <EmptyState title="Catatan presensi tidak ditemukan" />
      )}
    </section>
  );
}

function DetailTime({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}

function PhotoPanel({
  label,
  timestamp,
  path,
}: {
  label: string;
  timestamp: string | null;
  path: string | null;
}) {
  return (
    <figure className="detail-photo-panel">
      <div className="detail-photo-meta">
        <strong>{label}</strong>
        <span>{formatTime(timestamp)}</span>
      </div>
      <AuthenticatedPhoto path={path} alt={label} className="detail-photo" />
    </figure>
  );
}

function formatDetailDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}
