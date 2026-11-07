import { useCallback, useEffect, useState } from 'react';
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

import {
  apiRequest,
  getErrorMessage,
  type AttendanceRecord,
  type PageMeta,
} from '../api';
import { AuthenticatedPhoto } from '../components/AuthenticatedPhoto';
import { formatDate, formatTime } from './TodayPage';

interface AttendanceRow extends AttendanceRecord {
  id: string;
}

export function HistoryPage() {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');
    const query = new URLSearchParams({ page: String(page), limit: '10', sort: 'desc' });
    if (from) query.set('from', from);
    if (to) query.set('to', to);

    try {
      const result = await apiRequest<{ data: AttendanceRow[]; meta: PageMeta }>(
        `/attendances/me?${query}`,
      );
      setRecords(result.data);
      setMeta(result.meta);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [from, page, to]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function changeMonth(value: string) {
    setMonth(value);
    setPage(1);
    if (!value) {
      setFrom('');
      setTo('');
      return;
    }
    const [year, selectedMonth] = value.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, selectedMonth, 0)).getUTCDate();
    setFrom(`${value}-01`);
    setTo(`${value}-${String(lastDay).padStart(2, '0')}`);
  }

  const columns: TableColumn<AttendanceRow>[] = [
    {
      key: 'date',
      header: 'Tanggal',
      render: (record) => (
        <Link className="table-link" to={`/history/${record.id}`}>
          {formatDate(record.attendanceDate)}
        </Link>
      ),
    },
    { key: 'check-in',     header: 'Masuk', render: (record) => formatTime(record.checkInAt) },
    { key: 'check-out',     header: 'Pulang', render: (record) => formatTime(record.checkOutAt) },
    {
      key: 'duration',
      header: 'Durasi',
      render: (record) => formatDuration(record.durationMinutes),
    },
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
      header: 'Foto',
      render: (record) => (
        <Link to={`/history/${record.id}`}         aria-label={`Lihat detail ${formatDate(record.attendanceDate)}`}>
          <AuthenticatedPhoto
            path={record.checkInPhotoUrl}
            alt={`Foto presensi masuk ${formatDate(record.attendanceDate)}`}
            className="history-thumbnail"
          />
        </Link>
      ),
    },
  ];

  return (
    <section className="content-page">
      <header className="content-heading">
        <div>
          <p className="eyebrow">CATATAN ANDA</p>
          <h1>Riwayat presensi</h1>
          <p>Lihat riwayat presensi masuk dan pulang Anda.</p>
        </div>
        <span className="result-count">{meta.total} catatan</span>
      </header>

      <section className="filter-panel" aria-label="Filter riwayat presensi">
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={(value) => {
            setFrom(value);
            setMonth('');
            setPage(1);
          }}
          onToChange={(value) => {
            setTo(value);
            setMonth('');
            setPage(1);
          }}
        />
        <div className="month-filter">
          <label htmlFor="history-month">Pilih bulan</label>
          <input
            id="history-month"
            className="ui-input"
            type="month"
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setFrom('');
            setTo('');
            setMonth('');
            setPage(1);
          }}
        >
          Hapus filter
        </Button>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="history-table-panel" aria-label="Catatan presensi">
        {isLoading ? (
          <div className="loading-panel"><Spinner label="Memuat riwayat presensi" /></div>
        ) : records.length ? (
          <>
            <Table columns={columns} rows={records} />
            <Pagination
              page={page}
              pageCount={meta.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            title="Belum ada catatan presensi"
            description="Coba rentang tanggal lain atau lakukan presensi masuk untuk memulai."
          />
        )}
      </section>
    </section>
  );
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours} jam ${remainingMinutes} menit` : `${remainingMinutes} menit`;
}
