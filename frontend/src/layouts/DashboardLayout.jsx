import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Store, X } from 'lucide-react';
import Logo from '../components/Logo';
import NotificationBell from '../components/NotificationBell';
import ChatbotWidget from '../components/ChatbotWidget';
import { Avatar } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { NAV } from './navConfig';
import { titleCase } from '../utils/format';

function Sidebar({ items, onNavigate }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {items.map(([label, to, Icon]) => (
        <NavLink
          key={to}
          to={to}
          end={to.split('/').length <= 2}
          onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-50 hover:text-ink'}`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[user.role] || [];

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const pending = user.role === 'collector' && user.collectorProfile?.verificationStatus !== 'approved';

  const sidebarFooter = (
    <div className="border-t border-gray-100 p-3">
      <button type="button" onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700">
        <LogOut className="h-[18px] w-[18px]" /> Logout
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-100 bg-white lg:flex">
        <div className="flex h-16 items-center px-5"><Logo /></div>
        <Sidebar items={items} />
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
            {sidebarFooter}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg p-2 hover:bg-gray-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <span className="hidden text-sm text-gray-500 sm:block">{titleCase(user.role)} workspace</span>
          </div>
          <div className="flex items-center gap-2">
            {user.role !== 'admin' && <Link to="/products" className="btn-ghost hidden sm:inline-flex"><Store className="h-4 w-4" /> Marketplace</Link>}
            <NotificationBell />
            <Link to={user.role === 'admin' ? '/admin/settings' : `/${user.role}/profile`} className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-gray-50">
              <Avatar name={user.name} src={user.profileImage} size="h-8 w-8" />
              <span className="hidden text-sm font-medium md:block">{user.name.split(' ')[0]}</span>
            </Link>
          </div>
        </header>
        {pending && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-800">
            {user.collectorProfile?.verificationStatus === 'rejected'
              ? 'Your collector application was not approved. Check your notifications for the reason or contact support.'
              : 'Your collector account is awaiting admin verification. You will start receiving pickup requests once approved.'}
          </div>
        )}
        <main className="container-page py-6 sm:py-8"><Outlet /></main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
