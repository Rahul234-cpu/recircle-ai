import { Link } from 'react-router-dom';

export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="ReCircle AI home">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#15803D" />
        <path d="M20 9a11 11 0 0 1 10.4 7.4l-3.2 1.1A7.6 7.6 0 0 0 20 12.4z" fill="#FACC15" />
        <path d="M30.6 22.5A11 11 0 0 1 14 30.1l1.8-2.9a7.6 7.6 0 0 0 11.4-5.4z" fill="#fff" />
        <path d="M11.7 27.6A11 11 0 0 1 15 11l1.5 3.1a7.6 7.6 0 0 0-2.3 11.3z" fill="#10B981" />
        <circle cx="20" cy="20" r="3.2" fill="#fff" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        ReCircle<span className="text-brand-600"> AI</span>
      </span>
    </Link>
  );
}
