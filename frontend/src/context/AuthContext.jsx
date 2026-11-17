import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthAPI, tokenStore } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const startSession = useCallback((token, u) => {
    tokenStore.set(token);
    setUser(u);
    connectSocket(token);
  }, []);

  const logout = useCallback(async () => {
    try { await AuthAPI.logout(); } catch { /* token may already be invalid */ }
    tokenStore.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: u } = await AuthAPI.me();
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) { setReady(true); return; }
    AuthAPI.me()
      .then(({ user: u }) => { setUser(u); connectSocket(token); })
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onExpired = () => { disconnectSocket(); setUser(null); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    isAuthenticated: Boolean(user),
    login: async (email, password) => {
      const res = await AuthAPI.login({ email, password });
      startSession(res.token, res.user);
      return res.user;
    },
    register: async (body) => {
      const res = await AuthAPI.register(body);
      startSession(res.token, res.user);
      return res.user;
    },
    startSession,
    logout,
    refreshUser,
    setUser,
  }), [user, ready, startSession, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
