import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, CheckCircle2, IndianRupee, Leaf, Package, PackagePlus, Recycle, Scale, Store } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../../hooks/useFetch';
import { MiscAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, DemoBadge, EmptyState, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { date, inr, num, titleCase } from '../../utils/format';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { tick } = useNotifications();
  const { data, loading, error, refetch } = useFetch(() => MiscAPI.customerDashboard(), [tick]);
  const s = data?.stats;

  return (
    <>
      <PageHeader
        title={`Namaste, ${user.name.split(' ')[0]} 👋`}
        subtitle="Here's what's happening with your pickups, listings and impact."
        actions={(
          <>
            <Link to="/customer/sell-waste" className="btn-primary"><Recycle className="h-4 w-4" /> Sell waste</Link>
            <Link to="/customer/sell-product" className="btn-secondary"><PackagePlus className="h-4 w-4" /> Sell a product</Link>
          </>
        )}
      />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Scale} label="Total waste sold" value={`${num(s.totalWasteSoldKg)} kg`} hint="Collector-verified weight" />
              <StatCard icon={IndianRupee} label="Total earnings" value={inr(s.totalEarnings)} hint={`Scrap ${inr(s.scrapEarnings)} · Sales ${inr(s.salesEarnings)}`} tone="accent" />
              <StatCard icon={Package} label="Products listed" value={s.productsListed} tone="sky" />
              <StatCard icon={Leaf} label="Eco-reward points" value={num(s.ecoPoints, 0)} tone="violet" />
              <StatCard icon={CalendarClock} label="Active bookings" value={s.activeBookings} tone="sky" />
              <StatCard icon={CheckCircle2} label="Completed bookings" value={s.completedBookings} />
              <StatCard icon={Recycle} label="Paper & cardboard recycled" value={`${num(data.impact.paperKg)} kg`} />
              <StatCard icon={Store} label="Products reused" value={data.impact.productsReused} hint="Sold or bought second-hand" tone="violet" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <div className="card card-pad lg:col-span-3">
                <div className="flex items-center justify-between"><h2 className="font-semibold">Recent bookings</h2><Link to="/customer/bookings" className="text-sm font-medium text-brand-700">View all</Link></div>
                {data.recentBookings.length ? (
                  <ul className="mt-4 divide-y divide-gray-50">
                    {data.recentBookings.map((b) => (
                      <li key={b._id}>
                        <Link to={`/customer/bookings/${b._id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{b.materialSummary.map((m) => m.name).join(', ')}</p><p className="text-xs text-gray-400">{b.bookingRef} · {date(b.preferredDate)}</p></div>
                          <div className="text-right"><StatusBadge status={b.status} /><p className="mt-1 text-xs text-gray-500">{inr(b.finalPrice ?? b.estimatedPrice)}{b.finalPrice == null && ' est.'}</p></div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <div className="mt-4"><EmptyState title="No pickups yet" message="Book your first doorstep collection in under a minute." action={<Link to="/customer/sell-waste" className="btn-primary">Sell waste</Link>} /></div>}
              </div>

              <div className="card card-pad lg:col-span-2">
                <h2 className="font-semibold">Recycled by material</h2>
                {data.impact.materials.length ? (
                  <div className="mt-4 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.impact.materials.map((m) => ({ ...m, material: titleCase(m.material) }))}>
                        <XAxis dataKey="material" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} unit="kg" width={48} />
                        <Tooltip formatter={(v) => `${v} kg`} />
                        <Bar dataKey="kg" fill="#15803D" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="mt-4 text-sm text-gray-500">Complete a pickup to see your recycling breakdown.</p>}
                <Link to="/customer/impact" className="mt-2 inline-block text-sm font-medium text-brand-700">See full eco impact →</Link>
              </div>
            </div>

            <div className="card card-pad mt-6">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Recent transactions</h2><Link to="/customer/wallet" className="text-sm font-medium text-brand-700">Wallet</Link></div>
              {data.recentTransactions.length ? (
                <ul className="mt-4 divide-y divide-gray-50">
                  {data.recentTransactions.map((t) => (
                    <li key={t._id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${t.direction === 'in' ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-600'}`}>{t.direction === 'in' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>
                        <div><p className="text-sm font-medium">{t.type === 'scrap_collection' ? 'Scrap pickup' : 'Marketplace sale'} <DemoBadge show={t.isDemo} /></p><p className="text-xs text-gray-400">{t.transactionId} · {date(t.createdAt)}</p></div>
                      </div>
                      <p className={`font-semibold ${t.direction === 'in' ? 'text-brand-700' : 'text-rose-600'}`}>{t.direction === 'in' ? '+' : '−'}{inr(t.amount)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 text-sm text-gray-500">No transactions yet.</p>}
            </div>
          </>
        )}
      </AsyncView>
    </>
  );
}
