import { Link } from 'react-router-dom';
import { ArrowRight, Info, Recycle } from 'lucide-react';
import useFetch from '../hooks/useFetch';
import { WasteAPI } from '../services/api';
import { AsyncView } from '../components/ui';
import { inr, date, titleCase } from '../utils/format';
import { iconFor } from '../utils/icons';

export default function WasteCollection() {
  const { data, loading, error, refetch } = useFetch(() => WasteAPI.categories(), []);
  const cats = data?.categories || [];
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50/70 to-canvas">
        <div className="container-page grid items-end gap-6 py-14 sm:py-20 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="eyebrow">Waste collection</p>
            <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Doorstep pickup at transparent rates</h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-600">Verified kabadiwalas weigh your recyclables in front of you and pay on the spot. Here's what we accept and today's indicative rates.</p>
          </div>
          <div className="flex gap-3 lg:justify-end">
            <Link to="/customer/sell-waste" className="btn-primary px-5 py-3"><Recycle className="h-5 w-5" /> Sell waste</Link>
          </div>
        </div>
      </section>
      <section className="section pt-4">
        <div className="container-page">
          <AsyncView loading={loading} error={error} onRetry={refetch} empty={!cats.length} emptyProps={{ title: 'No categories configured yet' }}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map((c) => {
                const Icon = iconFor(c.icon);
                return (
                  <div key={c._id} className="card card-pad">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-50 p-2.5"><Icon className="h-5 w-5 text-brand-700" /></div><div><h3 className="font-semibold">{c.name}</h3><p className="text-xs text-gray-400">{titleCase(c.materialType)}</p></div></div>
                      <div className="text-right"><p className="text-lg font-bold text-brand-700">{c.rate ? inr(c.rate.pricePerKg) : '—'}</p><p className="text-xs text-gray-400">per {c.rate?.unit || 'kg'}</p></div>
                    </div>
                    {c.description && <p className="mt-3 text-sm text-gray-600">{c.description}</p>}
                    {c.handlingTips && <p className="mt-2 flex gap-1.5 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.handlingTips}</p>}
                    {c.rate?.effectiveFrom && <p className="mt-3 text-[11px] text-gray-400">Rate updated {date(c.rate.effectiveFrom)}</p>}
                  </div>
                );
              })}
            </div>
          </AsyncView>
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <strong>Not accepted:</strong> wet/food waste, medical waste, chemicals, paint, asbestos and other hazardous materials. Rates are indicative and may vary with quality; the final price is based on the collector-verified weight that you confirm.
          </div>
          <div className="mt-8 text-center"><Link to="/how-it-works" className="text-sm font-semibold text-brand-700 hover:underline">How does pickup work? <ArrowRight className="inline h-4 w-4" /></Link></div>
        </div>
      </section>
    </>
  );
}
