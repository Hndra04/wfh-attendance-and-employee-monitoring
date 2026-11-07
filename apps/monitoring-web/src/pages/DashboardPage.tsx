import { useCallback, useEffect, useState } from 'react';

import { Button, Spinner } from '@wfh-attendance/ui';

import { apiRequest, errorMessage, type DashboardSummary } from '../api';

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await apiRequest<{ data: DashboardSummary }>('/dashboard/summary');
      setSummary(result.data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <section className="admin-content">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">RINGKASAN HARIAN</p>
          <h1>Selamat datang kembali.</h1>
          <p>Pantau aktivitas presensi dan kelola tim Anda.</p>
        </div>
        <Button variant="secondary" onClick={() => void loadSummary()} disabled={loading}>
          Muat ulang
        </Button>
      </header>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading && !summary ? (
        <div className="admin-loading-card"><Spinner label="Memuat ringkasan" /></div>
      ) : summary ? (
        <>
          <div className="admin-date-strip">
            <span className="admin-date-mark" aria-hidden="true">◷</span>
            <span><strong>Presensi hari ini</strong><small>{formatDate(summary.date)} · Waktu Jakarta</small></span>
          </div>
          <div className="summary-grid">
            <SummaryCard label="Karyawan aktif" value={summary.totalActiveEmployees} detail="Akun aktif" tone="blue" />
            <SummaryCard label="Sudah masuk" value={summary.checkedIn} detail="Presensi hari ini" tone="green" />
            <SummaryCard label="Belum masuk" value={summary.notCheckedIn} detail="Belum tercatat hari ini" tone="amber" />
            <SummaryCard label="Sudah pulang" value={summary.checkedOut} detail="Presensi pulang hari ini" tone="slate" />
          </div>
          <section className="admin-panel chart-panel">
            <div className="admin-panel-heading">
              <div><p className="admin-eyebrow">7 HARI TERAKHIR</p><h2>Aktivitas presensi</h2></div>
              <span className="chart-legend"><i /> Jumlah presensi</span>
            </div>
            <AttendanceChart series={summary.series} />
          </section>
        </>
      ) : (
        <div className="admin-panel"><p>Ringkasan belum tersedia.</p></div>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <div className="summary-card-top"><span>{label}</span><span className="summary-card-dot" /></div>
      <strong>{value.toLocaleString('id-ID')}</strong>
      <small>{detail}</small>
    </article>
  );
}

function AttendanceChart({ series }: { series: DashboardSummary['series'] }) {
  const max = Math.max(1, ...series.map((item) => item.total));
  const chartHeight = 178;
  const barWidth = series.length ? Math.min(42, 360 / series.length) : 32;

  return (
    <div className="chart-wrap">
      <svg
        className="attendance-chart"
        viewBox="0 0 720 240"
        role="img"
        aria-label={`Grafik jumlah presensi selama ${series.length} hari`}
      >
        {[0, 1, 2, 3].map((line) => {
          const y = 24 + line * 54;
          return <line key={line} x1="42" x2="700" y1={y} y2={y} className="chart-grid-line" />;
        })}
        {series.map((item, index) => {
          const slotWidth = 658 / Math.max(1, series.length);
          const height = (item.total / max) * chartHeight;
          const x = 42 + index * slotWidth + (slotWidth - barWidth) / 2;
          const y = 204 - height;
          return (
            <g key={item.date}>
              <rect x={x} y={y} width={barWidth} height={height} rx="5" className="chart-bar" />
              <text x={x + barWidth / 2} y="228" textAnchor="middle" className="chart-date">
                {formatDay(item.date)}
              </text>
              <text x={x + barWidth / 2} y={Math.max(14, y - 8)} textAnchor="middle" className="chart-value">
                {item.total}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}
