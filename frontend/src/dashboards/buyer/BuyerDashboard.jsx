import { Link } from 'react-router-dom';
import { Bell, Heart, Leaf, ShoppingBag, Store } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { MiscAPI, ProductAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import ProductCard from '../../components/ProductCard';
import { AsyncView, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { inr, timeAgo, titleCase } from '../../utils/format';

function ProductStrip({ title, items, emptyText, link }) {
  return (
    <div className="mt-8">
      <div className="flex items-end justify-between"><h2 className="text-lg font-semibold">{title}</h2>{link}</div>
      {items?.length ? <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{items.slice(0, 4).map((p) => <ProductCard key={p._id} product={p} />)}</div> : <p className="mt-3 text-sm text-gray-500">{emptyText}</p>}
    </div>
  );
}

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { items: notifications, tick } = useNotifications();
  const dash = useFetch(() => MiscAPI.buyerDashboard(), [tick]);
  const recent = useFetch(() => ProductAPI.recentlyViewed(), []);
  const recs = useFetch(() => ProductAPI.recommended(), []);
  const favs = useFetch(() => MiscAPI.favourites(), []);
  const d = dash.data;
  const base = `/${user.role}`;

  return (
    <>
      <PageHeader title={`Hi ${user.name.split(' ')[0]} 👋`} subtitle="Find pre-loved products near you." actions={<Link to="/products" className="btn-primary"><Store className="h-4 w-4" /> Browse products</Link>} />
      <AsyncView loading={dash.loading} error={dash.error} onRetry={dash.refetch}>
        {d && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ShoppingBag} label="Active orders" value={d.activeOrders.length} />
              <StatCard icon={Heart} label="Favourites" value={d.favouritesCount} tone="rose" />
              <StatCard icon={Bell} label="Unread notifications" value={d.unreadNotifications} tone="sky" />
              <StatCard icon={Leaf} label="Eco-points" value={d.ecoPoints} tone="accent" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card card-pad">
                <div className="flex items-center justify-between"><h2 className="font-semibold">Active orders</h2><Link to={`${base}/orders`} className="text-sm font-medium text-brand-700">All orders</Link></div>
                {d.activeOrders.length ? (
                  <ul className="mt-3 divide-y divide-gray-50">{d.activeOrders.map((o) => (
                    <li key={o._id}><Link to={`${base}/orders/${o._id}`} className="flex items-center gap-3 py-3"><img src={o.product?.images?.[0]?.url} alt="" className="h-12 w-12 rounded-lg bg-brand-50 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{o.product?.title}</p><p className="text-xs text-gray-500">{inr(o.agreedPrice || o.offeredPrice)}</p></div><StatusBadge status={o.status} /></Link></li>
                  ))}</ul>
                ) : <p className="mt-3 text-sm text-gray-500">No active orders.</p>}
                {d.history.length > 0 && (
                  <>
                    <h3 className="mt-5 text-sm font-semibold text-gray-500">Purchase history</h3>
                    <ul className="mt-2 divide-y divide-gray-50">{d.history.slice(0, 5).map((o) => <li key={o._id}><Link to={`${base}/orders/${o._id}`} className="flex justify-between py-2 text-sm"><span className="truncate">{o.product?.title}</span><StatusBadge status={o.status} /></Link></li>)}</ul>
                  </>
                )}
              </div>
              <div className="card card-pad">
                <h2 className="font-semibold">Notifications</h2>
                {notifications.length ? (
                  <ul className="mt-3 divide-y divide-gray-50">{notifications.slice(0, 6).map((n) => <li key={n._id} className="py-2.5"><Link to={n.link || '#'} className="block text-sm"><p className="font-medium">{n.title}</p><p className="text-xs text-gray-500">{n.message} · {timeAgo(n.createdAt)}</p></Link></li>)}</ul>
                ) : <p className="mt-3 text-sm text-gray-500">You're all caught up.</p>}
              </div>
            </div>
            <ProductStrip title={recs.data?.basedOn?.length ? `Recommended for you · ${recs.data.basedOn.map(titleCase).join(', ')}` : 'Popular right now'} items={recs.data?.items} emptyText="Nothing to recommend yet." link={<Link to="/products" className="text-sm font-medium text-brand-700">See more</Link>} />
            <ProductStrip title="Favourite products" items={favs.data?.items} emptyText="Tap the heart on a product to save it." link={<Link to={`${base}/favourites`} className="text-sm font-medium text-brand-700">All favourites</Link>} />
            <ProductStrip title="Recently viewed" items={recent.data?.items} emptyText="Products you view will show up here." />
          </>
        )}
      </AsyncView>
    </>
  );
}
