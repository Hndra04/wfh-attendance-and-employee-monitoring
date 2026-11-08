import { useCallback, useEffect, useState } from 'react';

import { Badge, Button, EmptyState, Spinner } from '@wfh-attendance/ui';

import { apiRequest, getErrorMessage, type AttendanceRecord } from '../api';
import { AuthenticatedPhoto } from '../components/AuthenticatedPhoto';
import { PhotoCapture } from '../components/PhotoCapture';

type CaptureMode = 'check-in' | 'check-out' | null;

export function TodayPage() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);
  const [notice, setNotice] = useState('');

  const loadToday = useCallback(async () => {
    setError('');
    try {
      const result = await apiRequest<{ data: AttendanceRecord | null }>('/attendances/today');
      setAttendance(result.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  async function submitAttendance(photo: File, notes: string) {
    if (!captureMode) return;
    const formData = new FormData();
    formData.append('photo', photo);
    if (captureMode === 'check-in' && notes.trim()) formData.append('notes', notes.trim());

    await apiRequest(`/attendances/${captureMode}`, {
      method: 'POST',
      body: formData,
    });
    setCaptureMode(null);
    setNotice(captureMode === 'check-in' ? 'You are checked in.' : 'You are checked out.');
    await loadToday();
  }

  const jakartaDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  return (
    <section className="content-page">
      <header className="content-heading">
        <div>
          <p className="eyebrow">RUANG KERJA ANDA</p>
          <h1>Hari ini</h1>
          <p>{jakartaDate} <span className="date-zone">· Jakarta (UTC+7)</span></p>
        </div>
        <Button variant="secondary" onClick={() => void loadToday()}>
          Muat ulang
        </Button>
      </header>

      {notice && (
        <div className="inline-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Tutup pesan">×</button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      {isLoading ? (
        <div className="loading-panel"><Spinner label="Memuat presensi hari ini" /></div>
      ) : (
        <div className="today-grid">
          <section className="today-primary">
            {attendance ? (
              <>
                <div className="today-status-row">
                  <div>
                    <p className="eyebrow">STATUS PRESENSI</p>
                    <h2>{attendance.checkOutAt ? 'Hari kerja selesai' : 'Anda sudah presensi masuk'}</h2>
                  </div>
                  <Badge tone={attendance.status === 'LATE' ? 'warning' : 'success'}>
                    {attendance.status === 'LATE' ? 'Terlambat' : 'Tepat waktu'}
                  </Badge>
                </div>
                <div className="time-grid">
                  <TimeCard label="Presensi masuk" value={attendance.checkInAt} />
                  <TimeCard label="Presensi pulang" value={attendance.checkOutAt} />
                </div>
                {attendance.notes && (
                  <div className="note-block">
                    <span>Catatan</span>
                    <p>{attendance.notes}</p>
                  </div>
                )}
                {!attendance.checkOutAt && (
                  <Button onClick={() => setCaptureMode('check-out')}>
                    Presensi pulang
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="check-in-mark" aria-hidden="true">↗</div>
                <p className="eyebrow">SIAP MEMULAI HARI</p>
                <h2>Mulai hari kerja Anda</h2>
                <p className="muted-copy">
                  Lakukan presensi masuk dengan foto. Waktu akan tercatat otomatis.
                </p>
                <Button onClick={() => setCaptureMode('check-in')}>Presensi masuk</Button>
              </>
            )}
          </section>
          <aside className="today-secondary">
            <div className="panel-title">
              <div>
                <p className="eyebrow">CATATAN HARI INI</p>
                <h2>Foto presensi</h2>
              </div>
              {attendance && <span className="record-date">{formatDate(attendance.attendanceDate)}</span>}
            </div>
            {attendance ? (
              <div className="photo-pair">
                <div>
                  <AuthenticatedPhoto
                    path={attendance.checkInPhotoUrl}
                    alt="Foto presensi masuk"
                    className="attendance-photo"
                  />
                  <span>Masuk · {formatTime(attendance.checkInAt)}</span>
                </div>
                <div>
                  <AuthenticatedPhoto
                    path={attendance.checkOutPhotoUrl}
                    alt="Foto presensi pulang"
                    className="attendance-photo"
                  />
                  <span>Pulang · {formatTime(attendance.checkOutAt)}</span>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Belum ada presensi masuk"
                description="Foto presensi Anda akan muncul di sini setelah presensi masuk."
              />
            )}
          </aside>
        </div>
      )}

      <PhotoCapture
        open={captureMode !== null}
        notesEnabled={captureMode === 'check-in'}
        onClose={() => setCaptureMode(null)}
        onSubmit={submitAttendance}
      />
    </section>
  );
}

function TimeCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="time-card">
      <span>{label}</span>
      <strong>{formatTime(value)}</strong>
      <small>{value ? 'Waktu Jakarta' : 'Belum tercatat'}</small>
    </div>
  );
}

export function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}
