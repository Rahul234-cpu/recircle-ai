import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MiscAPI } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [tick, setTick] = useState(0); // bumps on any realtime event so pages can refetch

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await MiscAPI.notifications({ limit: 15 });
      setItems(res.items);
      setUnread(res.unread);
    } catch { /* non-critical */ }
  }, [user]);

  useEffect(() => {
    if (!user) { setItems([]); setUnread(0); return undefined; }
    load();
    let socket = getSocket();
    let attached = false;
    const onNotification = (n) => {
      setItems((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
      setTick((t) => t + 1);
      toast.info(n.message, n.title);
    };
    const onMessage = () => setTick((t) => t + 1);
    let timer = null;
    const attach = () => {
      socket = getSocket();
      if (!socket || attached) return;
      socket.on('notification', onNotification);
      socket.on('message', onMessage);
      attached = true;
      if (timer) { clearInterval(timer); timer = null; }
    };
    attach();
    if (!attached) timer = setInterval(attach, 500); // socket may be created slightly after login
    return () => {
      if (timer) clearInterval(timer);
      if (socket) { socket.off('notification', onNotification); socket.off('message', onMessage); }
    };
  }, [user, load, toast]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await MiscAPI.readNotification(id); } catch { /* ignore */ }
  }, []);

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnread(0);
    try { await MiscAPI.readAll(); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ items, unread, tick, markRead, markAll, reload: load }), [items, unread, tick, markRead, markAll, load]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
