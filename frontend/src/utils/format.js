export const inr = (n, opts = {}) => (n == null || Number.isNaN(Number(n))
  ? '—'
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: opts.decimals ?? 0 }).format(n));

export const num = (n, d = 1) => (n == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: d }).format(n));

export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return date(d);
}

export const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export const titleCase = (s = '') => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const initials = (name = '') => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
