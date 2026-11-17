import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { OrderAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, DemoBadge, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui';
import { inr, timeAgo } from '../../utils/format';

export default function OrdersList() {
  const { user } = useAuth();
  const { tick } = useNotifications();
  const [params, setParams] = useSearchParams();
  const canSell = user.role === 'customer';
  const as = canSell ? (params.get('as') || 'buyer') : 'buyer';
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(() => OrderAPI.list({ as, page }), [as, page, tick]);

  return (
    <>
      <PageHeader title="My orders" subtitle={as === 'seller' ? 'Purchase requests for your listings.' : 'Products you have requested or bought.'} />
      {canSell && <Tabs tabs={[['buyer', 'Purchases'], ['seller', 'Sales']]} value={as} onChange={(t) => { setParams({ as: t }); setPage(1); }} />}
      <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: ShoppingBag, title: as === 'seller' ? 'No purchase requests yet' : 'No orders yet', message: as === 'seller' ? 'Requests from buyers will appear here.' : 'Find something you like in the marketplace.', action: as === 'buyer' && <Link to="/products" className="btn-primary">Browse products</Link> }}>
        <div className="card divide-y divide-gray-50 overflow-hidden">
          {data?.items?.map((o) => (
            <Link key={o._id} to={`/${user.role}/orders/${o._id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50">
              <img src={o.product?.images?.[0]?.url} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-brand-50 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{o.product?.title}</p>
                <p className="text-xs text-gray-500">{o.orderRef} · {as === 'seller' ? `from ${o.buyer?.name}` : `seller ${o.seller?.name}`} · {timeAgo(o.createdAt)}</p>
              </div>
              <div className="text-right"><p className="font-semibold">{inr(o.agreedPrice || o.offeredPrice)}</p><div className="mt-1 flex justify-end gap-1"><StatusBadge status={o.status} /><DemoBadge show={o.isDemo} /></div></div>
              <ChevronRight className="hidden h-4 w-4 text-gray-300 sm:block" />
            </Link>
          ))}
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </AsyncView>
    </>
  );
}
