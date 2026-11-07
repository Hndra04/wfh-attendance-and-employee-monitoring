import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', type = 'button', variant = 'primary', ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
    />
  ),
);
Button.displayName = 'Button';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
};

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className' | 'aria-describedby'
> &
  FieldProps;

export function TextField({
  label,
  hint,
  error,
  id,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        className="ui-input"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? descriptionId : undefined}
      />
      {(hint || error) && (
        <span
          id={descriptionId}
          className={error ? 'ui-field__error' : 'ui-field__hint'}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className' | 'aria-describedby'
> &
  FieldProps & {
    children: ReactNode;
  };

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = `${selectId}-description`;

  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        {...selectProps}
        id={selectId}
        className="ui-input"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hint || error ? descriptionId : undefined}
      >
        {children}
      </select>
      {(hint || error) && (
        <span
          id={descriptionId}
          className={error ? 'ui-field__error' : 'ui-field__hint'}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="ui-spinner" role="status">
      <span className="ui-spinner__mark" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Toast({
  message,
  onDismiss,
  tone = 'info',
}: {
  message: string;
  onDismiss: () => void;
  tone?: 'info' | 'success' | 'error';
}) {
  return (
    <div
      className={`ui-toast ui-toast--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <span>{message}</span>
      <Button
        aria-label="Dismiss notification"
        variant="ghost"
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="ui-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="ui-modal__header">
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="ghost"
          aria-label="Close dialog"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      {children}
    </dialog>
  );
}

export type TableColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
};

export function Table<Row extends { id: string }>({
  columns,
  rows,
  emptyMessage = 'No results found.',
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, pageCount);
  const currentPage = Math.min(Math.max(1, page), lastPage);

  return (
    <nav className="ui-pagination" aria-label="Pagination">
      <Button
        variant="secondary"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </Button>
      <span aria-live="polite">
        Page {currentPage} of {lastPage}
      </span>
      <Button
        variant="secondary"
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <fieldset className="ui-date-range">
      <legend>Date range</legend>
      <TextField
        label="From"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => onFromChange(event.target.value)}
      />
      <TextField
        label="To"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => onToChange(event.target.value)}
      />
    </fieldset>
  );
}

export function ProtectedRoute({
  isAuthenticated,
  redirectTo = '/login',
}: {
  isAuthenticated: boolean;
  redirectTo?: string;
}) {
  const location = useLocation();

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={redirectTo} replace state={{ from: location }} />
  );
}
