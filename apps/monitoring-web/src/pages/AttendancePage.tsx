import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  DateRangePicker,
  EmptyState,
  Pagination,
  Spinner,
  Table,
  type TableColumn,
} from '@wfh-attendance/ui';

import { apiRequest, errorMessage, type Attendance, type PageMeta } from '../api';
import { AuthenticatedImage } from '../components/AuthenticatedImage';

const EMPTY_META: PageMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [page, setPage] = useState(1);
  const [employeeDraft, setEmployeeDraft] = useState('');
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [filters, setFilters] = useState({
    employeeId: '',
    department: '',
    from: '',
    to: '',
    status: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ page: String(page), limit: '10', sort: 'desc' });
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
    try {
      const result = await apiRequest<{ data: Attendance[]; meta: PageMeta }>(
        `/attendances?${query}`,
      );
      setRecords(result.data);
      setMeta(result.meta);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({
      employeeId: employeeDraft.trim(),
      department: departmentDraft.trim(),
      from: fromDraft,
      to: toDraft,
      status: statusDraft,
    });
  }

  function clearFilters() {
    setEmployeeDraft('');
    setDepartmentDraft('');
    setFromDraft('');
    setToDraft('');
    setStatusDraft('');
    setFilters({ employeeId: '', department: '', from: '', to: '', status: '' });
    setPage(1);
  }

  const columns: TableColumn<Attendance>[] = [
    {
      key: 'employee',
      header: 'Karyawan',
      render: (record) => (
        <span>
          <strong>{record.employee?.fullName ?? 'Data karyawan tidak tersedia'}</strong>
          <small className="table-subtext">{record.employee?.department ?? '—'}</small>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Tanggal',
      render: (record) => (
        <Link className="admin-table-link" to={`/attendance/${record.id}`}>
          {formatDate(record.attendanceDate)}
        </Link>
      ),
    },
    { key: 'check-in', header: 'Masuk', render: (record) => formatTime(record.checkInAt) },
    { key: 'check-out', header: 'Pulang', render: (record) => formatTime(record.checkOutAt) },
    { key: 'duration', header: 'Durasi', render: (record) => formatDuration(record.durationMinutes) },
    {
      key: 'status',
      header: 'Status',
      render: (record) => (
        <Badge tone={record.status === 'LATE' ? 'warning' : 'success'}>
          {record.status === 'LATE' ? 'Terlambat' : 'Hadir'}
        </Badge>
      ),
    },
    {
      key: 'photo',
      header: 'Foto masuk',
      render: (record) => (
        <Link to={`/attendance/${record.id}`} aria-label={`Lihat detail ${formatDate(record.attendanceDate)}`}>
          <AuthenticatedImage
            path={record.checkInPhotoUrl}
            alt={`Foto presensi ${record.employee?.fullName ?? ''}`}
            className="attendance-thumbnail"
          />
        </Link>
      ),
    },
  ];

  return (
    <section className="admin-content">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">PEMANTAUAN PRESENSI</p>
          <h1>Presensi karyawan</h1>
          <p>Tinjau catatan kehadiran seluruh karyawan. Data ini hanya dapat dibaca.</p>
        </div>
        <span className="admin-record-total">{meta.total.toLocaleString('id-ID')} catatan</span>
      </header>
      <section className="admin-panel attendance-list-panel">
        <form className="attendance-filters" onSubmit={applyFilters}>
          <div className="attendance-filter-fields">
            <label className="ui-field">
              <span className="ui-label">ID karyawan</span>
              <input className="ui-input" value={employeeDraft} onChange={(event) => setEmployeeDraft(event.target.value)} />
              <small className="ui-field__hint">Salin ID dari tabel karyawan.</small>
            </label>
            <label className="ui-field">
              <span className="ui-label">Departemen</span>
              <input className="ui-input" value={departmentDraft} onChange={(event) => setDepartmentDraft(event.target.value)} />
            </label>
            <DateRangePicker
              from={fromDraft}
              to={toDraft}
              onFromChange={setFromDraft}
              onToChange={setToDraft}
            />
            <label className="ui-field">
              <span className="ui-label">Status</span>
              <select className="ui-input" value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                <option value="">Semua status</option>
                <option value="PRESENT">Hadir</option>
                <option value="LATE">Terlambat</option>
              </select>
            </label>
          </div>
          <div className="attendance-filter-actions">
            <Button type="submit">Terapkan filter</Button>
            <Button type="button" variant="secondary" onClick={clearFilters}>Hapus filter</Button>
          </div>
        </form>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {loading ? (
          <div className="admin-loading-card"><Spinner label="Memuat catatan presensi" /></div>
        ) : records.length ? (
          <>
            <Table columns={columns} rows={records} />
            <Pagination page={page} pageCount={meta.totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="Catatan presensi tidak ditemukan" description="Coba ubah filter tanggal atau karyawan." />
        )}
      </section>
    </section>
  );
}

export function formatTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} jam ${remainder} menit` : `${remainder} menit`;
}
