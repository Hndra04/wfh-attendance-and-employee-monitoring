import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  Badge,
  Button,
  EmptyState,
  Modal,
  Pagination,
  SelectField,
  Spinner,
  Table,
  TextField,
  type TableColumn,
} from '@wfh-attendance/ui';

import { apiRequest, errorMessage, type Employee, type PageMeta } from '../api';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; employee: Employee }
  | { kind: 'email'; employee: Employee }
  | { kind: 'password'; employee: Employee }
  | { kind: 'temporary-password'; employee: Employee; password: string }
  | null;

type EmployeeInput = Omit<Employee, 'id' | 'status'> & { status?: Employee['status'] };

const EMPTY_META: PageMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ page: String(page), limit: '10', sort: 'asc' });
    if (search) query.set('search', search);
    if (department) query.set('department', department);
    if (status) query.set('status', status);
    try {
      const result = await apiRequest<{ data: Employee[]; meta: PageMeta }>(`/employees?${query}`);
      setEmployees(result.data);
      setMeta(result.meta);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [department, page, search, status]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  async function saveEmployee(values: EmployeeInput) {
    setActionError('');
    try {
      if (dialog?.kind === 'create') {
        const result = await apiRequest<{ data: Employee; temporaryPassword: string }>('/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        setDialog({
          kind: 'temporary-password',
          employee: result.data,
          password: result.temporaryPassword,
        });
      } else if (dialog?.kind === 'edit') {
        const updates: Partial<EmployeeInput> = { ...values };
        delete updates.email;
        await apiRequest(`/employees/${dialog.employee.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        setDialog(null);
      } else {
        return;
      }
      await loadEmployees();
    } catch (saveError) {
      setActionError(errorMessage(saveError));
    }
  }

  async function changeStatus(employee: Employee) {
    setActionError('');
    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiRequest(`/employees/${employee.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadEmployees();
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  async function deleteEmployee(employee: Employee) {
    if (!window.confirm(`Hapus ${employee.fullName}? Akun karyawan akan dinonaktifkan.`)) return;
    setActionError('');
    try {
      await apiRequest(`/employees/${employee.id}`, { method: 'DELETE' });
      await loadEmployees();
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  async function changeEmail(email: string) {
    if (dialog?.kind !== 'email') return;
    setActionError('');
    try {
      await apiRequest(`/employees/${dialog.employee.id}/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, confirm: true }),
      });
      setDialog(null);
      await loadEmployees();
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  async function resetPassword() {
    if (dialog?.kind !== 'password') return;
    setActionError('');
    setIsResettingPassword(true);
    try {
      const result = await apiRequest<{ data: { temporaryPassword: string } }>(
        `/employees/${dialog.employee.id}/reset-password`,
        { method: 'POST' },
      );
      setDialog({
        kind: 'temporary-password',
        employee: dialog.employee,
        password: result.data.temporaryPassword,
      });
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    } finally {
      setIsResettingPassword(false);
    }
  }

  const columns: TableColumn<Employee>[] = [
    {
      key: 'name',
      header: 'Karyawan',
      render: (employee) => (
        <div className="employee-name-cell">
          <span className="employee-row-avatar" aria-hidden="true">
            {employee.fullName.trim().charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>{employee.fullName}</strong>
            <small>{employee.email}</small>
            <small>ID: {employee.id}</small>
          </span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Departemen',
      render: (employee) => <span>{employee.department}<small className="table-subtext">{employee.position}</small></span>,
    },
    { key: 'join-date', header: 'Tanggal bergabung', render: (employee) => formatDate(employee.joinDate) },
    {
      key: 'status',
      header: 'Status',
      render: (employee) => (
        <Badge tone={employee.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {employee.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Tindakan',
      render: (employee) => (
        <div className="employee-actions">
          <Button variant="secondary" onClick={() => setDialog({ kind: 'edit', employee })}>
            Ubah
          </Button>
          <Button variant="ghost" onClick={() => void changeStatus(employee)}>
            {employee.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button variant="ghost" onClick={() => setDialog({ kind: 'password', employee })}>
            Atur ulang sandi
          </Button>
          <Button variant="danger" onClick={() => void deleteEmployee(employee)}>
            Hapus
          </Button>
        </div>
      ),
    },
  ];

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setDepartment(departmentDraft.trim());
    setPage(1);
  }

  return (
    <section className="admin-content">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">DATA MASTER</p>
          <h1>Karyawan</h1>
          <p>Kelola informasi, akses akun, dan status karyawan.</p>
        </div>
        <Button onClick={() => { setActionError(''); setDialog({ kind: 'create' }); }}>
          Tambah karyawan
        </Button>
      </header>
      {actionError && <p className="admin-error" role="alert">{actionError}</p>}
      <section className="admin-panel employee-list-panel">
        <form className="employee-filters" onSubmit={applyFilters}>
          <TextField
            label="Cari karyawan"
            placeholder="Nama atau email"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <TextField
            label="Departemen"
            placeholder="Nama departemen"
            value={departmentDraft}
            onChange={(event) => setDepartmentDraft(event.target.value)}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </SelectField>
          <Button type="submit">Terapkan</Button>
        </form>
        <div className="employee-list-heading">
          <div><h2>Daftar karyawan</h2><p>{meta.total.toLocaleString('id-ID')} karyawan</p></div>
          <Button
            variant="secondary"
            onClick={() => {
              setSearchDraft('');
              setDepartmentDraft('');
              setSearch('');
              setDepartment('');
              setStatus('');
              setPage(1);
            }}
          >
            Hapus filter
          </Button>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {loading ? (
          <div className="admin-loading-card"><Spinner label="Memuat daftar karyawan" /></div>
        ) : employees.length ? (
          <>
            <Table columns={columns} rows={employees} />
            <Pagination page={page} pageCount={meta.totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="Karyawan tidak ditemukan" description="Ubah filter atau tambahkan data karyawan baru." />
        )}
      </section>

      {dialog?.kind === 'create' && (
        <EmployeeFormModal
          title="Tambah karyawan"
          error={actionError}
          onClose={() => setDialog(null)}
          onSubmit={saveEmployee}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EmployeeFormModal
          title="Ubah data karyawan"
          employee={dialog.employee}
          error={actionError}
          onClose={() => setDialog(null)}
          onSubmit={saveEmployee}
          onChangeEmail={() => {
            setActionError('');
            setDialog({ kind: 'email', employee: dialog.employee });
          }}
        />
      )}
      {dialog?.kind === 'email' && (
        <EmailModal
          employee={dialog.employee}
          error={actionError}
          onClose={() => setDialog(null)}
          onSubmit={changeEmail}
        />
      )}
      {dialog?.kind === 'password' && (
        <Modal open title="Atur ulang kata sandi" onClose={() => setDialog(null)}>
          <p>Buat kata sandi sementara baru untuk {dialog.employee.fullName}. Sesi aktif karyawan akan dicabut.</p>
          {actionError && <p className="admin-error" role="alert">{actionError}</p>}
          <div className="admin-modal-actions">
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={() => void resetPassword()} disabled={isResettingPassword}>
              {isResettingPassword ? 'Membuat…' : 'Buat kata sandi'}
            </Button>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'temporary-password' && (
        <Modal open title="Simpan kata sandi sementara" onClose={() => setDialog(null)}>
          <p>Kirim kata sandi ini secara aman kepada {dialog.employee.fullName}. Kata sandi tidak dapat dilihat lagi.</p>
          <label className="temporary-password-label" htmlFor="temporary-password">Kata sandi sementara</label>
          <input id="temporary-password" className="temporary-password-value" readOnly value={dialog.password} onFocus={(event) => event.target.select()} />
          <p className="admin-warning">Karyawan wajib mengganti kata sandi saat masuk berikutnya.</p>
          <div className="admin-modal-actions"><Button onClick={() => setDialog(null)}>Selesai</Button></div>
        </Modal>
      )}
    </section>
  );
}

function EmployeeFormModal({
  title,
  employee,
  error,
  onClose,
  onSubmit,
  onChangeEmail,
}: {
  title: string;
  employee?: Employee;
  error: string;
  onClose: () => void;
  onSubmit: (values: EmployeeInput) => Promise<void>;
  onChangeEmail?: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const form = new FormData(event.currentTarget);
    const values: EmployeeInput = {
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      department: String(form.get('department') ?? ''),
      position: String(form.get('position') ?? ''),
      joinDate: String(form.get('joinDate') ?? ''),
      phone: String(form.get('phone') ?? '') || null,
      address: String(form.get('address') ?? '') || null,
      status: String(form.get('status') ?? 'ACTIVE') as Employee['status'],
    };
    try {
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open title={title} onClose={onClose}>
      <form className="employee-form" onSubmit={(event) => void submit(event)}>
        <TextField label="Nama lengkap" name="fullName" required maxLength={150} defaultValue={employee?.fullName} />
        {employee ? (
          <div className="email-readonly-row">
            <TextField label="Email masuk" type="email" value={employee.email} readOnly />
            <Button type="button" variant="secondary" onClick={onChangeEmail}>Ganti email</Button>
          </div>
        ) : (
          <TextField label="Email masuk" name="email" type="email" required maxLength={150} />
        )}
        <div className="employee-form-grid">
          <TextField label="Departemen" name="department" required maxLength={100} defaultValue={employee?.department} />
          <TextField label="Jabatan" name="position" required maxLength={100} defaultValue={employee?.position} />
          <TextField label="Tanggal bergabung" name="joinDate" type="date" required defaultValue={employee?.joinDate.slice(0, 10)} />
          <TextField label="Nomor telepon" name="phone" type="tel" maxLength={30} defaultValue={employee?.phone ?? ''} />
        </div>
        <TextField label="Alamat" name="address" maxLength={65535} defaultValue={employee?.address ?? ''} />
        <SelectField label="Status akun" name="status" defaultValue={employee?.status ?? 'ACTIVE'}>
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Nonaktif</option>
        </SelectField>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? 'Menyimpan…' : 'Simpan data'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EmailModal({
  employee,
  error,
  onClose,
  onSubmit,
}: {
  employee: Employee;
  error: string;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(email);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open title="Konfirmasi perubahan email" onClose={onClose}>
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <p>Email baru akan menjadi identitas masuk karyawan <strong>{employee.fullName}</strong>.</p>
        <TextField
          label="Email baru"
          type="email"
          required
          maxLength={150}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="admin-confirm">
          <input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          Saya mengonfirmasi perubahan email masuk ini.
        </label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={!confirmed || isSaving}>{isSaving ? 'Menyimpan…' : 'Konfirmasi email'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}
