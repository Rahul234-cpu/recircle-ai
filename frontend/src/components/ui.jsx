import { useEffect } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, Star, X } from 'lucide-react';
import { STATUS_STYLES } from '../utils/constants';
import { initials } from '../utils/format';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-700 ${className}`} aria-hidden />;
}

export function Loader({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-16 text-sm text-gray-500 ${className}`} role="status">
      <Spinner /> {label}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-brand-50 p-3"><Icon className="h-6 w-6 text-brand-700" /></div>
      <h3 className="text-base font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-red-600" />
      <p className="text-sm text-red-700">{message || 'Could not load data.'}</p>
      {onRetry && <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Renders loading / error / empty / content consistently. */
export function AsyncView({ loading, error, onRetry, empty, emptyProps, children }) {
  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState {...emptyProps} />;
  return children;
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    accent: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <div className="card card-pad flex items-start gap-4">
      {Icon && <div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>}
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-bold text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>{String(status).replace('_', ' ')}</span>;
}

export function DemoBadge({ show = true }) {
  if (!show) return null;
  return <span className="badge bg-accent-300/40 text-amber-800 ring-1 ring-amber-200" title="Seeded demonstration data, not a real transaction">Demo data</span>;
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back}
        <h1 className="text-2xl font-bold sm:text-[1.65rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, required }) {
  return (
    <div>
      {label && <label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full ${size} overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, busy, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{confirmLabel}</button>
        </>
      )}
    >
      {message && <p className="text-sm text-gray-600">{message}</p>}
      {children}
    </Modal>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  return (
    <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
      <span>{total} results · page {page} of {pages}</span>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Prev</button>
        <button type="button" className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function RatingStars({ value = 0, size = 'h-4 w-4', onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = <Star className={`${size} ${filled ? 'fill-accent-400 text-accent-400' : 'text-gray-300'}`} />;
        return onChange ? (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} star`} className="p-0.5">{star}</button>
        ) : <span key={i}>{star}</span>;
      })}
    </div>
  );
}

export function Avatar({ name, src, size = 'h-9 w-9' }) {
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover`} />;
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800`}>{initials(name)}</div>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
      {tabs.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${value === key ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600 hover:text-ink'}`}
        >
          {label}{count != null && <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 text-xs">{count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ConfidenceBar({ value }) {
  const pctVal = Math.round((value || 0) * 100);
  const tone = pctVal >= 70 ? 'bg-brand-600' : pctVal >= 45 ? 'bg-accent-400' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${tone}`} style={{ width: `${pctVal}%` }} /></div>
      <span className="w-10 text-right text-xs font-semibold text-gray-600">{pctVal}%</span>
    </div>
  );
}
