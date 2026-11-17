import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../components/Logo';
import ChatbotWidget from '../components/ChatbotWidget';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../utils/constants';

const LINKS = [
  ['How It Works', '/how-it-works'],
  ['Waste Collection', '/waste-collection'],
  ['Marketplace', '/marketplace'],
  ['Become an EcoPartner', '/become-ecopartner'],
  ['About', '/about'],
];

function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([l, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'text-brand-700' : 'text-gray-600 hover:text-ink'}`}>{l}</NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Link to={ROLE_HOME[user.role]} className="btn-primary">Go to dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </div>
        <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {open && (
        <div className="border-t border-gray-100 bg-white lg:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {[...LINKS, ['Browse Products', '/products'], ['FAQ', '/faq'], ['Contact', '/contact']].map(([l, to]) => (
              <NavLink key={to} to={to} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{l}</NavLink>
            ))}
            <div className="mt-2 flex gap-2">
              {user ? <Link to={ROLE_HOME[user.role]} className="btn-primary flex-1">Dashboard</Link> : (
                <>
                  <Link to="/login" className="btn-secondary flex-1">Log in</Link>
                  <Link to="/register" className="btn-primary flex-1">Get started</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const cols = [
    ['Platform', [['Sell Waste', '/waste-collection'], ['Browse Products', '/products'], ['Second-Hand Marketplace', '/marketplace'], ['How It Works', '/how-it-works']]],
    ['Partners', [['Become an EcoPartner', '/become-ecopartner'], ['Collector Login', '/login']]],
    ['Company', [['About Us', '/about'], ['Contact', '/contact'], ['FAQ', '/faq']]],
  ];
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-gray-500">Give Waste a Value. Give Products a Second Life. ReCircle AI connects households with verified EcoPartners and a trusted second-hand marketplace.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <p className="text-sm font-semibold">{title}</p>
            <ul className="mt-3 space-y-2">
              {links.map(([l, to]) => <li key={to + l}><Link to={to} className="text-sm text-gray-500 hover:text-brand-700">{l}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">© {new Date().getFullYear()} ReCircle AI · Final-year B.Tech project · Rates and impact figures are indicative.</div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}
