import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { timeAgo } from '../utils/format';

export default function NotificationBell() {
  const { items, unread, markRead, markAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = (n) => {
    markRead(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2 text-gray-600 hover:bg-gray-100" aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-500">You're all caught up.</p>}
            {items.map((n) => (
              <button key={n._id} type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${n.readAt ? '' : 'bg-brand-50/50'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand-600'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{n.title}</span>
                  {n.message && <span className="line-clamp-2 block text-xs text-gray-500">{n.message}</span>}
                  <span className="mt-0.5 block text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
