import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Map as MapIcon, Search, SlidersHorizontal, X } from 'lucide-react';
import useFetch from '../hooks/useFetch';
import useDebounce from '../hooks/useDebounce';
import { MiscAPI, ProductAPI, errorMessage } from '../services/api';
import ProductCard from '../components/ProductCard';
import { MarkersMap } from '../components/Maps';
import { AsyncView, Pagination } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CONDITIONS } from '../utils/constants';
import { inr } from '../utils/format';

export default function BrowseProducts() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('q') || '');
  const debouncedQ = useDebounce(q);
  const [view, setView] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [near, setNear] = useState(null); // [lng, lat]
  const [favs, setFavs] = useState(new Set());

  const filters = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === '' || v == null) next.delete(k); else next.set(k, v);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => { if ((params.get('q') || '') !== debouncedQ) set('q', debouncedQ); /* eslint-disable-next-line */ }, [debouncedQ]);

  const cats = useFetch(() => ProductAPI.categories(), []);
  const query = { ...filters, limit: 12, ...(near ? { lng: near[0], lat: near[1], radiusKm: filters.radiusKm || 10 } : {}) };
  const { data, loading, error, refetch } = useFetch(() => ProductAPI.list(query), [params.toString(), near?.join(',')]);

  useEffect(() => {
    if (!user) return;
    MiscAPI.favourites().then((r) => setFavs(new Set(r.items.map((i) => i._id)))).catch(() => {});
  }, [user]);

  const toggleFav = async (id) => {
    if (!user) { navigate('/login', { state: { from: '/products' } }); return; }
    try {
      const r = await MiscAPI.toggleFavourite(id);
      setFavs((s) => { const n = new Set(s); if (r.isFavourite) n.add(id); else n.delete(id); return n; });
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const useNearMe = () => {
    if (!navigator.geolocation) { toast.error('Location is not available in this browser'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setNear([p.coords.longitude, p.coords.latitude]),
      () => toast.error('Could not get your location'),
    );
  };

  const condList = (filters.condition || '').split(',').filter(Boolean);
  const toggleCond = (c) => set('condition', (condList.includes(c) ? condList.filter((x) => x !== c) : [...condList, c]).join(','));
  const activeCount = ['category', 'condition', 'minPrice', 'maxPrice', 'city'].filter((k) => filters[k]).length + (near ? 1 : 0);

  const FilterPanel = (
    <div className="space-y-6">
      <div>
        <p className="label">Category</p>
        <select className="input" value={filters.category || ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {cats.data?.categories?.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.count})</option>)}
        </select>
      </div>
      <div>
        <p className="label">Condition</p>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button key={c} type="button" onClick={() => toggleCond(c)} className={`rounded-full border px-3 py-1 text-xs font-medium ${condList.includes(c) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600'}`}>{c}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Price (₹)</p>
        <div className="flex gap-2">
          <input className="input" type="number" min="0" placeholder="Min" value={filters.minPrice || ''} onChange={(e) => set('minPrice', e.target.value)} />
          <input className="input" type="number" min="0" placeholder="Max" value={filters.maxPrice || ''} onChange={(e) => set('maxPrice', e.target.value)} />
        </div>
      </div>
      <div>
        <p className="label">City</p>
        <input className="input" placeholder="e.g. Bengaluru" value={filters.city || ''} onChange={(e) => set('city', e.target.value)} />
      </div>
      <div>
        <p className="label">Near me</p>
        {near ? (
          <div className="space-y-2">
            <select className="input" value={filters.radiusKm || '10'} onChange={(e) => set('radiusKm', e.target.value)}>
              {[2, 5, 10, 25, 50].map((r) => <option key={r} value={r}>Within {r} km</option>)}
            </select>
            <button type="button" className="text-xs font-medium text-red-600" onClick={() => setNear(null)}>Clear location</button>
          </div>
        ) : <button type="button" className="btn-secondary w-full" onClick={useNearMe}>Use my location</button>}
      </div>
      {activeCount > 0 && <button type="button" className="btn-ghost w-full" onClick={() => { setParams({}); setNear(null); setQ(''); }}>Clear all filters</button>}
    </div>
  );

  const items = data?.items || [];
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-bold">Browse products</h1><p className="text-sm text-gray-500">{data ? `${data.pagination.total} items available` : ' '}</p></div>
        {user?.role === 'customer' && <Link to="/customer/sell-product" className="btn-primary">Sell an item</Link>}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-10" placeholder="Search laptops, sofas, cycles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </div>
        <select className="input sm:w-48" value={filters.sort || ''} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          <option value="">{filters.q ? 'Best match' : 'Newest'}</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="popular">Most viewed</option>
        </select>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary lg:hidden" onClick={() => setShowFilters(true)}><SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ''}</button>
          <div className="flex rounded-xl border border-gray-200 bg-white p-1">
            <button type="button" onClick={() => setView('grid')} className={`rounded-lg p-2 ${view === 'grid' ? 'bg-brand-50 text-brand-800' : 'text-gray-500'}`} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" onClick={() => setView('map')} className={`rounded-lg p-2 ${view === 'map' ? 'bg-brand-50 text-brand-800' : 'text-gray-500'}`} aria-label="Map view"><MapIcon className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block"><div className="card card-pad sticky top-24">{FilterPanel}</div></aside>
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
            <div className="absolute inset-y-0 right-0 w-80 max-w-full overflow-y-auto bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><p className="font-semibold">Filters</p><button type="button" onClick={() => setShowFilters(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
              {FilterPanel}
            </div>
          </div>
        )}
        <div>
          <AsyncView loading={loading} error={error} onRetry={refetch} empty={!items.length} emptyProps={{ title: 'No products match your filters', message: 'Try a different search or clear some filters.' }}>
            {view === 'grid' ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => <ProductCard key={p._id} product={p} isFavourite={favs.has(p._id)} onToggleFavourite={toggleFav} />)}
              </div>
            ) : (
              <MarkersMap
                height="h-[32rem]"
                center={near || items[0]?.location?.coordinates}
                circle={near ? { center: near, radiusKm: Number(filters.radiusKm || 10) } : null}
                markers={items.map((p) => ({
                  id: p._id,
                  position: p.location.coordinates,
                  popup: <Link to={`/products/${p._id}`} className="font-semibold text-brand-700">{p.title}<br />{inr(p.sellingPrice)}</Link>,
                }))}
              />
            )}
            <Pagination pagination={data?.pagination} onPage={(p) => set('page', String(p))} />
          </AsyncView>
        </div>
      </div>
    </div>
  );
}
