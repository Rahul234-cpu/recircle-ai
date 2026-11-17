import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Award, Info, Leaf, Package, Recycle, Scale, Wallet as WalletIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import useFetch from '../../hooks/useFetch';
import { MiscAPI, UserAPI } from '../../services/api';
import { AsyncView, DemoBadge, PageHeader, Pagination, StatCard } from '../../components/ui';
import { date, inr, num, titleCase } from '../../utils/format';

export function Wallet() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(() => MiscAPI.transactions({ page }), [page]);
  return (
    <>
      <PageHeader title="Wallet & transactions" subtitle="Every completed scrap pickup and marketplace sale, with receipts." />
      {data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <StatCard icon={ArrowDownLeft} label="Total received" value={inr(data.totals.earned)} />
          <StatCard icon={ArrowUpRight} label="Total spent" value={inr(data.totals.spent)} tone="rose" />
        </div>
      )}
      <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: WalletIcon, title: 'No transactions yet', message: 'Completed pickups and sales will appear here.' }}>
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Counterparty</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {data?.items?.map((t) => (
                <tr key={t._id}>
                  <td>{date(t.createdAt)}</td>
                  <td>{t.type === 'scrap_collection' ? 'Scrap pickup' : 'Marketplace'} <DemoBadge show={t.isDemo} /></td>
                  <td className="text-xs"><p>{t.transactionId}</p><p className="text-gray-400">{t.bookingId?.bookingRef || t.orderId?.orderRef}</p></td>
                  <td>{t.direction === 'in' ? t.buyerId?.name : t.sellerId?.name}</td>
                  <td className="uppercase">{t.paymentMethod}</td>
                  <td className={`text-right font-semibold ${t.direction === 'in' ? 'text-brand-700' : 'text-rose-600'}`}>{t.direction === 'in' ? '+' : '−'}{inr(t.amount, { decimals: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </AsyncView>
    </>
  );
}

const COLORS = ['#15803D', '#10B981', '#FACC15', '#0EA5E9', '#8B5CF6', '#F97316', '#64748B', '#EC4899'];

export function EcoImpact() {
  const impact = useFetch(() => UserAPI.impact(), []);
  const rewards = useFetch(() => MiscAPI.rewards(), []);
  const im = impact.data?.impact;
  return (
    <>
      <PageHeader title="Eco impact" subtitle="What your recycling and reuse has achieved." />
      <AsyncView loading={impact.loading} error={impact.error} onRetry={impact.refetch}>
        {im && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Scale} label="Total recycled" value={`${num(im.totalRecycledKg)} kg`} />
              <StatCard icon={Recycle} label="Paper & cardboard" value={`${num(im.paperKg)} kg`} tone="accent" />
              <StatCard icon={Recycle} label="Plastic" value={`${num(im.plasticKg)} kg`} tone="sky" />
              <StatCard icon={Recycle} label="Metal" value={`${num(im.metalKg)} kg`} tone="violet" />
              <StatCard icon={Package} label="Products reused" value={im.productsReused} hint={`${im.productsSold} sold · ${im.productsBought} bought`} />
              <StatCard icon={Leaf} label="Completed pickups" value={im.completedPickups} />
              <StatCard icon={Award} label="Eco-points" value={num(im.ecoPoints, 0)} tone="accent" />
              <StatCard icon={Recycle} label="E-waste" value={`${num(im.eWasteKg)} kg`} tone="rose" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card card-pad">
                <h2 className="font-semibold">Material breakdown</h2>
                {im.materials.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={im.materials.map((m) => ({ name: titleCase(m.material), value: m.kg }))} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                          {im.materials.map((m, i) => <Cell key={m.material} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${v} kg`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="mt-3 text-sm text-gray-500">Complete a pickup to see your breakdown.</p>}
              </div>
              <div className="card card-pad">
                <h2 className="font-semibold">Eco-points history</h2>
                <AsyncView loading={rewards.loading} error={rewards.error} empty={!rewards.data?.ledger?.length} emptyProps={{ title: 'No points yet', message: 'Earn points for every verified pickup and second-hand sale.' }}>
                  <ul className="mt-3 max-h-72 divide-y divide-gray-50 overflow-y-auto">
                    {rewards.data?.ledger?.map((r) => (
                      <li key={r._id} className="flex justify-between py-2.5 text-sm"><div><p>{r.reason}</p><p className="text-xs text-gray-400">{date(r.createdAt)}</p></div><span className={`font-semibold ${r.points > 0 ? 'text-brand-700' : 'text-rose-600'}`}>{r.points > 0 ? '+' : ''}{r.points}</span></li>
                    ))}
                  </ul>
                </AsyncView>
              </div>
            </div>
            <p className="mt-6 flex gap-2 rounded-xl bg-white p-4 text-xs text-gray-500 ring-1 ring-gray-100"><Info className="h-4 w-4 shrink-0" />{im.methodology}</p>
          </>
        )}
      </AsyncView>
    </>
  );
}
