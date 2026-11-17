import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Heart, Package, Pencil, Trash2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { ProductAPI, errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, ConfirmDialog, DemoBadge, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui';
import { inr, timeAgo } from '../../utils/format';

const TABS = [['', 'All'], ['Available', 'Live'], ['Draft', 'Drafts'], ['Pending Approval,Rejected', 'In review'], ['Reserved', 'Reserved'], ['Sold', 'Sold']];

export default function MyListings() {
  const toast = useToast();
  const { tick } = useNotifications();
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, refetch } = useFetch(() => ProductAPI.mine({ status: tab || undefined, page }), [tab, page, tick]);

  const remove = async () => {
    setBusy(true);
    try { await ProductAPI.remove(toDelete._id); toast.success('Listing removed'); setToDelete(null); refetch(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="My listings" subtitle="Manage the products you're selling." actions={<Link to="/customer/sell-product" className="btn-primary">New listing</Link>} />
      <Tabs tabs={TABS} value={tab} onChange={(t) => { setTab(t); setPage(1); }} />
      <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: Package, title: 'No listings yet', message: 'Turn things you no longer use into cash for you and value for someone else.', action: <Link to="/customer/sell-product" className="btn-primary">Sell a product</Link> }}>
        <div className="grid gap-4">
          {data?.items?.map((p) => (
            <div key={p._id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <img src={p.images?.[0]?.url} alt="" className="h-24 w-full rounded-xl bg-brand-50 object-cover sm:w-32" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} /><DemoBadge show={p.isDemo} />{p.pendingRequests > 0 && <Link to="/customer/orders?as=seller" className="badge bg-red-50 text-red-700 ring-1 ring-red-200">{p.pendingRequests} purchase request{p.pendingRequests > 1 ? 's' : ''}</Link>}</div>
                <Link to={`/products/${p._id}`} className="mt-1 block truncate font-semibold hover:text-brand-700">{p.title}</Link>
                <p className="text-sm font-bold">{inr(p.sellingPrice)}</p>
                <p className="mt-1 flex items-center gap-3 text-xs text-gray-500"><span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.views}</span><span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.favouritesCount}</span><span>Updated {timeAgo(p.updatedAt)}</span></p>
                {p.rejectionReason && ['Rejected', 'Removed'].includes(p.status) && <p className="mt-1 text-xs text-red-600">Reason: {p.rejectionReason}</p>}
              </div>
              <div className="flex gap-2">
                {['Draft', 'Available', 'Pending Approval', 'Rejected'].includes(p.status) && <Link to={`/customer/sell-product/${p._id}`} className="btn-secondary btn-sm"><Pencil className="h-3.5 w-3.5" /> Edit</Link>}
                {['Draft', 'Available', 'Pending Approval', 'Rejected'].includes(p.status) && <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setToDelete(p)}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
              </div>
            </div>
          ))}
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </AsyncView>
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={remove} busy={busy} danger title="Remove listing?" message={`"${toDelete?.title}" will be taken off the marketplace.`} confirmLabel="Remove" />
    </>
  );
}
