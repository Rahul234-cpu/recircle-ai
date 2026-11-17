import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './ui';
import { ROLE_HOME } from '../utils/constants';

/** Frontend role guard (the backend enforces the same rules independently). */
export default function ProtectedRoute({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loader label="Checking your session…" className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  return children;
}
