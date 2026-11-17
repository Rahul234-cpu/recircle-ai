import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  BadgeCheck, CheckCircle2, ClipboardList, IndianRupee, Package, Pencil, Plus, ShoppingBag, Truck, Users, XCircle,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import useFetch from '../../hooks/useFetch';
import { AdminAPI, AiAPI, errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import AdminTable from './AdminTable';
import {
  AsyncView, ConfirmDialog, DemoBadge, Field, Modal, PageHeader, RatingStars, Spinner, StatCard, StatusBadge,
} from '../../components/ui';
import { date, dateTime, inr, num, timeAgo, titleCase } from '../../utils/format';
import { ICONS } from '../../utils/icons';

const COLORS = ['#15803D', '#10B981', '#FACC15', '#0EA5E9', '#8B5CF6', '#F97316', '#64748B', '#EC4899', '#14B8A6', '#EF4444'];

// ------------------------------------------------------------------ Dashboard
export function AdminDashboard() {
  const { tick } = useNotifications();
  const { data, loading, error, refetch } = useFetch(() => AdminAPI.dashboard(), [tick]);
  const s = data?.stats;
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Platform health at a glance." actions={s?.pendingVerification > 0 && <Link to="/admin/verification" className="btn-accent"><BadgeCheck className="h-4 w-4" /> {s.pendingVerification} pending verification</Link>} />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Users} label="Total users" value={s.totalUsers} />
              <StatCard icon={Truck} label="Verified collectors" value={s.totalCollectors} tone="sky" hint={`${s.pendingVerification} pending`} />
              <StatCard icon={ClipboardList} label="Waste bookings" value={s.totalBookings} tone="accent" />
              <StatCard icon={CheckCircle2} label="Completed collections" value={s.completedCollections} />
              <StatCard icon={Package} label="Marketplace listings" value={s.totalListings} tone="violet" />
              <StatCard icon={ShoppingBag} label="Active orders" value={s.activeOrders} tone="sky" />
              <StatCard icon={IndianRupee} label="Scrap transaction value" value={inr(s.transactions.scrap_collection?.total || 0)} hint={`${s.transactions.scrap_collection?.count || 0} transactions`} tone="accent" />
              <StatCard icon={IndianRupee} label="Marketplace sales value" value={inr(s.transactions.marketplace_sale?.total || 0)} hint={`${s.transactions.marketplace_sale?.count || 0} transactions`} tone="rose" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <div className="card card-pad lg:col-span-3">
                <h2 className="font-semibold">Monthly growth</h2>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.growth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                      <Line type="monotone" dataKey="users" stroke="#15803D" strokeWidth={2.5} name="New users" />
                      <Line type="monotone" dataKey="bookings" stroke="#FACC15" strokeWidth={2.5} name="Bookings" />
                      <Line type="monotone" dataKey="listings" stroke="#0EA5E9" strokeWidth={2.5} name="Listings" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card card-pad lg:col-span-2">
                <h2 className="font-semibold">Waste category analytics</h2>
                <p className="text-xs text-gray-500">Estimated kg across all bookings</p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.wasteByCategory} layout="vertical" margin={{ left: 20 }}><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `${v} kg`} /><Bar dataKey="estimatedKg" fill="#15803D" radius={[0, 6, 6, 0]} /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </AsyncView>
    </>
  );
}

// ------------------------------------------------------------------ Users
export function ManageUsers() {
  const toast = useToast();
  const update = async (u, body, refetch) => {
    try { await AdminAPI.updateUser(u._id, body); toast.success('User updated'); refetch(); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <AdminTable
      title="Manage users"
      fetcher={AdminAPI.users}
      tabParam="role"
      tabs={[['', 'All'], ['customer', 'Customers'], ['buyer', 'Buyers'], ['collector', 'Collectors'], ['admin', 'Admins']]}
      searchPlaceholder="Search name, email or phone"
      columns={[
        { label: 'Name', render: (u) => <div><p className="font-medium">{u.name} {u.isDemo && <DemoBadge />}</p><p className="text-xs text-gray-500">{u.email}</p></div> },
        { label: 'Role', render: (u) => titleCase(u.role) },
        { label: 'Phone', render: (u) => u.phone || '—' },
        { label: 'Eco-points', render: (u) => u.ecoPoints },
        { label: 'Joined', render: (u) => date(u.createdAt) },
        { label: 'Status', render: (u) => <span className={`badge ${u.isActive ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{u.isActive ? 'Active' : 'Blocked'}</span> },
        { label: 'Actions', render: (u, refetch) => u.role !== 'admin' && <button type="button" className={`btn-sm ${u.isActive ? 'btn-ghost text-red-600' : 'btn-secondary'}`} onClick={() => update(u, { isActive: !u.isActive }, refetch)}>{u.isActive ? 'Block' : 'Unblock'}</button> },
      ]}
    />
  );
}

// ------------------------------------------------------------------ Collectors & verification
function VerifyModal({ collector, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const decide = async (decision) => {
    if (decision === 'rejected' && !note.trim()) { toast.error('Add a reason for rejection'); return; }
    setBusy(decision);
    try { await AdminAPI.verifyCollector(collector._id, { decision, note: note || undefined }); toast.success(`Collector ${decision}`); onDone(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };
  const c = collector;
  return (
    <Modal open onClose={onClose} title={`Verify ${c.businessName}`} size="max-w-2xl" footer={<><button type="button" className="btn-secondary text-red-600" disabled={!!busy} onClick={() => decide('rejected')}><XCircle className="h-4 w-4" /> Reject</button><button type="button" className="btn-primary" disabled={!!busy} onClick={() => decide('approved')}>{busy === 'approved' ? <Spinner className="h-4 w-4 text-white" /> : <BadgeCheck className="h-4 w-4" />} Approve</button></>}>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div><p className="text-xs text-gray-400">Applicant</p><p className="font-medium">{c.userId?.name}</p><p className="text-gray-500">{c.userId?.email} · {c.userId?.phone}</p></div>
        <div><p className="text-xs text-gray-400">ID proof</p><p className="font-medium">{titleCase(c.idProofType)} ending ••••{c.idProofLast4}</p></div>
        <div><p className="text-xs text-gray-400">Vehicle</p><p>{titleCase(c.vehicleType)}</p></div>
        <div><p className="text-xs text-gray-400">Service area</p><p>{c.serviceAreas.map((a) => `${a.name}${a.pincode ? ` (${a.pincode})` : ''}`).join(', ')} · {c.serviceRadiusKm} km</p></div>
        <div className="sm:col-span-2"><p className="text-xs text-gray-400">Availability</p><p>{c.availability?.days?.join(', ')} · {c.availability?.timeSlots?.join(', ')} · {c.availability?.dailyCapacity}/day</p></div>
        {c.idProofImage ? <a href={c.idProofImage} target="_blank" rel="noreferrer" className="sm:col-span-2"><img src={c.idProofImage} alt="ID proof" className="max-h-64 rounded-xl border" /></a> : <p className="text-gray-500 sm:col-span-2">No ID image uploaded.</p>}
      </div>
      <textarea className="input mt-4" placeholder="Note to the applicant (required for rejection)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
    </Modal>
  );
}

export function ManageCollectors({ preset = '' }) {
  const [sel, setSel] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <AdminTable
        key={preset}
        title={preset === 'pending' ? 'Verification requests' : 'Manage collectors'}
        subtitle={preset === 'pending' ? 'Review collector applications before they receive pickup requests.' : undefined}
        fetcher={AdminAPI.collectors}
        defaultTab={preset}
        refreshKey={refreshKey}
        tabs={[['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]}
        searchPlaceholder="Search business name"
        columns={[
          { label: 'Business', render: (c) => <div><p className="font-medium">{c.businessName} {c.isDemo && <DemoBadge />}</p><p className="text-xs text-gray-500">{c.userId?.name} · {c.userId?.phone}</p></div> },
          { label: 'Areas', render: (c) => <span className="text-xs">{c.serviceAreas.map((a) => a.name).join(', ')}</span> },
          { label: 'Rating', render: (c) => <span className="flex items-center gap-1"><RatingStars value={c.averageRating} size="h-3.5 w-3.5" /> ({c.ratingCount})</span> },
          { label: 'Pickups', render: (c) => c.completedCollections },
          { label: 'Applied', render: (c) => date(c.createdAt) },
          { label: 'Status', render: (c) => <StatusBadge status={c.verificationStatus} /> },
          { label: 'Actions', render: (c) => <button type="button" className="btn-secondary btn-sm" onClick={() => setSel(c)}>{c.verificationStatus === 'pending' ? 'Review' : 'Details'}</button> },
        ]}
      />
      {sel && <VerifyModal collector={sel} onClose={() => setSel(null)} onDone={() => { setSel(null); setRefreshKey((k) => k + 1); }} />}
    </>
  );
}

// ------------------------------------------------------------------ Categories
function CategoryModal({ kind, item, onClose, onSaved }) {
  const toast = useToast();
  const isWaste = kind === 'waste';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: item || { name: '', materialType: 'paper', recyclable: true, icon: isWaste ? 'Recycle' : 'Package', isActive: true, sortOrder: 0 },
  });
  const submit = async (v) => {
    const body = isWaste
      ? { name: v.name, materialType: v.materialType, description: v.description || undefined, recyclable: Boolean(v.recyclable), recyclingInfo: v.recyclingInfo || undefined, handlingTips: v.handlingTips || undefined, icon: v.icon, isActive: Boolean(v.isActive), sortOrder: Number(v.sortOrder) || 0 }
      : { name: v.name, icon: v.icon, description: v.description || undefined, isActive: Boolean(v.isActive), sortOrder: Number(v.sortOrder) || 0 };
    try {
      if (isWaste) await (item ? AdminAPI.updateWasteCategory(item._id, body) : AdminAPI.createWasteCategory(body));
      else await (item ? AdminAPI.updateProductCategory(item._id, body) : AdminAPI.createProductCategory(body));
      toast.success('Category saved');
      onSaved();
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <Modal open onClose={onClose} title={item ? 'Edit category' : 'New category'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
        <Field label="Name" error={errors.name?.message}><input className="input" {...register('name', { required: 'Required', minLength: { value: 2, message: 'Too short' } })} /></Field>
        {isWaste && <Field label="Material type"><select className="input" {...register('materialType')}>{['paper', 'cardboard', 'plastic', 'metal', 'glass', 'e-waste', 'textile', 'mixed'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select></Field>}
        <Field label="Description"><input className="input" {...register('description')} /></Field>
        {isWaste && <Field label="Recycling info"><textarea className="input" {...register('recyclingInfo')} /></Field>}
        {isWaste && <Field label="Handling tips"><input className="input" {...register('handlingTips')} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon"><select className="input" {...register('icon')}>{Object.keys(ICONS).map((k) => <option key={k}>{k}</option>)}</select></Field>
          <Field label="Sort order"><input type="number" className="input" {...register('sortOrder')} /></Field>
        </div>
        <div className="flex gap-6">
          {isWaste && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-700" {...register('recyclable')} /> Recyclable</label>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-700" {...register('isActive')} /> Active</label>
        </div>
        <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={isSubmitting}>Save</button></div>
      </form>
    </Modal>
  );
}

export function CategoriesPage({ kind }) {
  const toast = useToast();
  const isWaste = kind === 'waste';
  const [modal, setModal] = useState(null);
  const [key, setKey] = useState(0);
  const deactivate = async (c, refetch) => {
    try { await (isWaste ? AdminAPI.deleteWasteCategory(c._id) : AdminAPI.deleteProductCategory(c._id)); toast.success('Category deactivated'); refetch(); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <AdminTable
        title={isWaste ? 'Waste categories' : 'Product categories'}
        subtitle={isWaste ? 'Materials customers can sell. Rates are managed in Scrap Price Management.' : 'Categories for second-hand listings. Slugs stay fixed so existing listings keep working.'}
        fetcher={isWaste ? AdminAPI.wasteCategories : AdminAPI.productCategories}
        refreshKey={key}
        actions={<button type="button" className="btn-primary" onClick={() => setModal({})}><Plus className="h-4 w-4" /> New category</button>}
        columns={[
          { label: 'Name', render: (c) => { const I = ICONS[c.icon] || Package; return <span className="flex items-center gap-2 font-medium"><I className="h-4 w-4 text-brand-700" />{c.name}</span>; } },
          { label: 'Slug', render: (c) => <code className="text-xs">{c.slug}</code> },
          ...(isWaste ? [{ label: 'Material', render: (c) => titleCase(c.materialType) }, { label: 'Recyclable', render: (c) => (c.recyclable ? 'Yes' : 'No') }] : []),
          { label: 'Status', render: (c) => <span className={`badge ${c.isActive ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>{c.isActive ? 'Active' : 'Inactive'}</span> },
          { label: 'Actions', render: (c, refetch) => <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm" onClick={() => setModal(c)}><Pencil className="h-3.5 w-3.5" /> Edit</button>{c.isActive && <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => deactivate(c, refetch)}>Deactivate</button>}</div> },
        ]}
      />
      {modal && <CategoryModal kind={kind} item={modal._id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); setKey((k) => k + 1); }} />}
    </>
  );
}

// ------------------------------------------------------------------ Scrap rates
export function ScrapRates() {
  const toast = useToast();
  const cats = useFetch(() => AdminAPI.wasteCategories(), []);
  const [modal, setModal] = useState(null);
  const [key, setKey] = useState(0);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  useEffect(() => { if (modal) reset(modal._id ? { pricePerKg: modal.pricePerKg, resalePricePerKg: modal.resalePricePerKg } : { category: '', city: 'All', unit: 'kg' }); }, [modal, reset]);

  const submit = async (v) => {
    try {
      if (modal._id) await AdminAPI.updateScrapRate(modal._id, { pricePerKg: Number(v.pricePerKg), resalePricePerKg: v.resalePricePerKg ? Number(v.resalePricePerKg) : undefined });
      else await AdminAPI.createScrapRate({ category: v.category, city: v.city || 'All', pricePerKg: Number(v.pricePerKg), resalePricePerKg: v.resalePricePerKg ? Number(v.resalePricePerKg) : undefined, unit: v.unit });
      toast.success('Rate saved. New bookings use it immediately.');
      setModal(null); setKey((k) => k + 1);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <>
      <AdminTable
        title="Scrap price management"
        subtitle="Updating a rate creates a new version; past bookings keep the rate they were priced with."
        fetcher={AdminAPI.scrapRates}
        refreshKey={key}
        tabs={[['', 'Active'], ['all', 'All versions']]}
        actions={<button type="button" className="btn-primary" onClick={() => setModal({})}><Plus className="h-4 w-4" /> New rate</button>}
        columns={[
          { label: 'Category', render: (r) => <span className="font-medium">{r.category?.name}</span> },
          { label: 'City', render: (r) => r.city },
          { label: 'Customer rate', render: (r) => <span className="font-semibold">{inr(r.pricePerKg, { decimals: 2 })}/{r.unit}</span> },
          { label: 'Reference resale', render: (r) => (r.resalePricePerKg != null ? `${inr(r.resalePricePerKg, { decimals: 2 })}/${r.unit}` : '—') },
          { label: 'Effective from', render: (r) => dateTime(r.effectiveFrom) },
          { label: 'Updated by', render: (r) => r.updatedBy?.name || 'Seed' },
          { label: 'Status', render: (r) => <span className={`badge ${r.isActive ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>{r.isActive ? 'Active' : 'Archived'}</span> },
          { label: 'Actions', render: (r) => r.isActive && <button type="button" className="btn-ghost btn-sm" onClick={() => setModal(r)}><Pencil className="h-3.5 w-3.5" /> Update</button> },
        ]}
      />
      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal._id ? `Update ${modal.category?.name} rate` : 'New scrap rate'}>
          <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
            {!modal._id && (
              <>
                <Field label="Category" error={errors.category?.message}><select className="input" {...register('category', { required: 'Required' })}><option value="">Select…</option>{cats.data?.items?.filter((c) => c.isActive).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" hint="'All' applies everywhere"><input className="input" {...register('city')} /></Field>
                  <Field label="Unit"><select className="input" {...register('unit')}><option value="kg">kg</option><option value="piece">piece</option></select></Field>
                </div>
              </>
            )}
            <Field label="Customer rate (₹)" error={errors.pricePerKg?.message}><input type="number" step="0.01" min="0" className="input" {...register('pricePerKg', { required: 'Required', min: { value: 0, message: 'Must be ≥ 0' } })} /></Field>
            <Field label="Reference resale rate (₹)" hint="Optional — used only to estimate collector margins"><input type="number" step="0.01" min="0" className="input" {...register('resalePricePerKg')} /></Field>
            <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={isSubmitting}>Save rate</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Bookings / listings / orders / transactions
export function AdminBookings() {
  return (
    <AdminTable
      title="Collection bookings"
      fetcher={AdminAPI.bookings}
      searchPlaceholder="Search booking ref"
      tabs={[['', 'All'], ['Pending', 'Pending'], ['Accepted,Collector Assigned,On The Way,Arrived,Weight Verified,Awaiting Customer Confirmation', 'In progress'], ['Completed', 'Completed'], ['Cancelled,Rejected', 'Closed']]}
      columns={[
        { label: 'Booking', render: (b) => <Link to={`/admin/bookings/${b._id}`} className="font-medium text-brand-700">{b.bookingRef}</Link> },
        { label: 'Customer', render: (b) => b.customerId?.name },
        { label: 'Collector', render: (b) => b.collectorProfile?.businessName || <span className="text-gray-400">Unassigned</span> },
        { label: 'Materials', render: (b) => <span className="text-xs">{b.materialSummary.map((m) => m.name).join(', ')}</span> },
        { label: 'Date', render: (b) => `${date(b.preferredDate)} ${b.preferredTimeSlot}` },
        { label: 'Amount', render: (b) => inr(b.finalPrice ?? b.estimatedPrice) },
        { label: 'Status', render: (b) => <span className="flex items-center gap-1"><StatusBadge status={b.status} /><DemoBadge show={b.isDemo} /></span> },
      ]}
    />
  );
}

export function AdminListings() {
  const toast = useToast();
  const [act, setAct] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  const run = async () => {
    setBusy(true);
    try { await AdminAPI.setProductStatus(act.p._id, { status: act.status, reason: reason || undefined }); toast.success(`Listing ${act.status.toLowerCase()}`); setAct(null); setReason(''); setKey((k) => k + 1); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <>
      <AdminTable
        title="Product listings"
        subtitle="Approve, reject or remove inappropriate or fraudulent listings."
        fetcher={AdminAPI.products}
        refreshKey={key}
        searchPlaceholder="Search title"
        tabs={[['', 'All'], ['Pending Approval', 'Pending approval'], ['Available', 'Live'], ['Reserved', 'Reserved'], ['Sold', 'Sold'], ['Rejected,Removed', 'Rejected / removed']]}
        columns={[
          { label: 'Listing', render: (p) => <Link to={`/products/${p._id}`} className="flex items-center gap-2 font-medium hover:text-brand-700"><img src={p.images?.[0]?.url} alt="" className="h-9 w-9 rounded-lg bg-brand-50 object-cover" /><span className="max-w-[220px] truncate">{p.title}</span></Link> },
          { label: 'Seller', render: (p) => p.sellerId?.name },
          { label: 'Price', render: (p) => inr(p.sellingPrice) },
          { label: 'Category', render: (p) => titleCase(p.category) },
          { label: 'Listed', render: (p) => timeAgo(p.createdAt) },
          { label: 'Status', render: (p) => <span className="flex items-center gap-1"><StatusBadge status={p.status} /><DemoBadge show={p.isDemo} /></span> },
          {
            label: 'Actions',
            render: (p) => (
              <div className="flex gap-1">
                {p.status === 'Pending Approval' && <button type="button" className="btn-secondary btn-sm" onClick={() => setAct({ p, status: 'Available' })}>Approve</button>}
                {p.status === 'Pending Approval' && <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setAct({ p, status: 'Rejected' })}>Reject</button>}
                {['Available', 'Pending Approval', 'Reserved', 'Rejected', 'Draft'].includes(p.status) && <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setAct({ p, status: 'Removed' })}>Remove</button>}
                {p.status === 'Removed' && <button type="button" className="btn-ghost btn-sm" onClick={() => setAct({ p, status: 'Available' })}>Restore</button>}
              </div>
            ),
          },
        ]}
      />
      <ConfirmDialog open={Boolean(act)} onClose={() => setAct(null)} onConfirm={run} busy={busy} danger={act?.status !== 'Available'} title={`${act?.status === 'Available' ? 'Publish' : act?.status === 'Removed' ? 'Remove' : 'Reject'} "${act?.p.title}"?`} message={act?.status === 'Removed' ? 'Open orders on this listing will be cancelled and the seller notified.' : 'The seller will be notified.'}>
        {act?.status !== 'Available' && <textarea className="input mt-3" placeholder="Reason shown to the seller" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}
      </ConfirmDialog>
    </>
  );
}

export function AdminOrders() {
  return (
    <AdminTable
      title="Orders"
      fetcher={AdminAPI.orders}
      searchPlaceholder="Search order ref"
      tabs={[['', 'All'], ['Requested', 'Requested'], ['Accepted', 'Accepted'], ['Completed', 'Completed'], ['Rejected,Cancelled', 'Closed']]}
      columns={[
        { label: 'Order', render: (o) => <Link to={`/admin/orders/${o._id}`} className="font-medium text-brand-700">{o.orderRef}</Link> },
        { label: 'Product', render: (o) => <span className="block max-w-[220px] truncate">{o.product?.title}</span> },
        { label: 'Buyer', render: (o) => o.buyer?.name },
        { label: 'Seller', render: (o) => o.seller?.name },
        { label: 'Amount', render: (o) => inr(o.agreedPrice || o.offeredPrice) },
        { label: 'Payment', render: (o) => `${o.paymentMethod} · ${o.paymentStatus}` },
        { label: 'Status', render: (o) => <span className="flex items-center gap-1"><StatusBadge status={o.status} /><DemoBadge show={o.isDemo} /></span> },
      ]}
    />
  );
}

export function AdminTransactions() {
  return (
    <AdminTable
      title="Transactions"
      subtitle="Scrap collections and marketplace sales are recorded as separate transaction types."
      fetcher={AdminAPI.transactions}
      tabParam="type"
      searchPlaceholder="Search transaction ID"
      tabs={[['', 'All'], ['scrap_collection', 'Scrap collections'], ['marketplace_sale', 'Marketplace sales']]}
      header={(d) => d && <div className="mb-4 max-w-xs"><StatCard icon={IndianRupee} label="Total value (filtered)" value={inr(d.totalAmount)} /></div>}
      columns={[
        { label: 'Transaction', render: (t) => <div><p className="font-medium">{t.transactionId}</p><p className="text-xs text-gray-400">{t.receiptNumber}</p></div> },
        { label: 'Type', render: (t) => (t.type === 'scrap_collection' ? 'Scrap' : 'Marketplace') },
        { label: 'Payer', render: (t) => t.buyerId?.name },
        { label: 'Payee', render: (t) => t.sellerId?.name },
        { label: 'Method', render: (t) => t.paymentMethod.toUpperCase() },
        { label: 'Amount', render: (t) => <span className="font-semibold">{inr(t.amount, { decimals: 2 })}</span> },
        { label: 'Date', render: (t) => <span className="flex items-center gap-1">{date(t.createdAt)}<DemoBadge show={t.isDemo} /></span> },
      ]}
    />
  );
}

// ------------------------------------------------------------------ Analytics & AI activity
export function Analytics() {
  const { data, loading, error, refetch } = useFetch(() => AdminAPI.analytics(), []);
  return (
    <>
      <PageHeader title="Reports & analytics" subtitle="Transactions, workflow health, AI usage and measured impact." />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total recycled (verified)" value={`${num(data.impact.totalRecycledKg)} kg`} />
              <StatCard label="Products reused" value={data.impact.productsReused} tone="violet" />
              <StatCard label="Completed pickups" value={data.impact.completedPickups} tone="sky" />
              <StatCard label="AI calls (all time)" value={data.ai.byType.reduce((s, a) => s + a.calls, 0)} tone="accent" />
            </div>
            <div className="card card-pad">
              <h2 className="font-semibold">Transaction value by month</h2>
              <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.transactionsByMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => inr(v)} /><Legend /><Area type="monotone" dataKey="scrap" stackId="1" stroke="#15803D" fill="#BBF7D0" name="Scrap collections" /><Area type="monotone" dataKey="marketplace" stackId="1" stroke="#0EA5E9" fill="#BAE6FD" name="Marketplace sales" /></AreaChart></ResponsiveContainer></div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {[['Booking status', data.bookingStatus], ['Order status', data.orderStatus]].map(([title, rows]) => (
                <div key={title} className="card card-pad">
                  <h2 className="font-semibold">{title}</h2>
                  <div className="mt-2 h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="count" nameKey="status" outerRadius={90} innerRadius={50}>{rows.map((r, i) => <Cell key={r.status} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card card-pad">
                <h2 className="font-semibold">Waste by category (estimated kg)</h2>
                <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.wasteByCategory}><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="estimatedKg" fill="#15803D" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="card card-pad">
                <h2 className="font-semibold">Top collectors</h2>
                <table className="table-base mt-2"><thead><tr><th>Collector</th><th>Pickups</th><th>kg</th><th>Rating</th></tr></thead>
                  <tbody>{data.topCollectors.map((c) => <tr key={c._id}><td>{c.businessName}</td><td>{c.completedCollections}</td><td>{num(c.totalKgCollected)}</td><td>{c.averageRating?.toFixed(1)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="card card-pad">
              <h2 className="font-semibold">AI module monitoring</h2>
              <div className="mt-4 overflow-x-auto"><table className="table-base"><thead><tr><th>Module</th><th>Calls</th><th>Success rate</th><th>Avg latency</th><th>Avg confidence</th></tr></thead>
                <tbody>{data.ai.byType.map((a) => <tr key={a.type}><td className="font-medium">{titleCase(a.type)}</td><td>{a.calls}</td><td>{a.successRate}%</td><td>{a.avgLatencyMs} ms</td><td>{a.avgConfidence ?? '—'}</td></tr>)}</tbody></table></div>
              <p className="mt-3 text-xs text-gray-500">Providers: {data.ai.byProvider.map((p) => `${p.provider} (${p.calls})`).join(' · ')}. <Link to="/admin/ai-activity" className="text-brand-700">View activity log →</Link></p>
            </div>
            <p className="text-xs text-gray-500">{data.impact.methodology}</p>
          </div>
        )}
      </AsyncView>
    </>
  );
}

export function AIActivity() {
  return (
    <AdminTable
      title="AI activity"
      subtitle="Every AI request is logged with its provider, latency and outcome."
      fetcher={AdminAPI.aiActivity}
      tabParam="type"
      tabs={[['', 'All'], ['classify', 'Classification'], ['recommend', 'Recommendation'], ['price', 'Price'], ['describe', 'Description'], ['chat', 'Chatbot']]}
      columns={[
        { label: 'When', render: (a) => dateTime(a.createdAt) },
        { label: 'Module', render: (a) => titleCase(a.type) },
        { label: 'User', render: (a) => a.user?.name || 'Guest' },
        { label: 'Provider', render: (a) => <span className={`badge ${a.provider === 'demo-heuristic' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{a.provider || '—'}</span> },
        { label: 'Result', render: (a) => (a.success ? <span className="text-xs">{a.output?.material || a.output?.action || (a.output?.suggested ? inr(a.output.suggested) : '') || 'OK'}</span> : <span className="text-xs text-red-600">{a.error}</span>) },
        { label: 'Confidence', render: (a) => (a.confidence != null ? `${Math.round(a.confidence * 100)}%` : '—') },
        { label: 'Latency', render: (a) => `${a.latencyMs ?? '—'} ms` },
        { label: 'Image', render: (a) => (a.imageUrl ? <a href={a.imageUrl} target="_blank" rel="noreferrer"><img src={a.imageUrl} alt="" className="h-8 w-8 rounded object-cover" /></a> : '—') },
      ]}
    />
  );
}

// ------------------------------------------------------------------ Rewards
export function Rewards() {
  const toast = useToast();
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(false);
  const users = useFetch(() => (open ? AdminAPI.users({ limit: 100 }) : Promise.resolve(null)), [open]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const submit = async (v) => {
    try { await AdminAPI.adjustRewards({ userId: v.userId, points: Number(v.points), reason: v.reason }); toast.success('Points adjusted'); setOpen(false); reset(); setKey((k) => k + 1); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <AdminTable
        title="Eco rewards"
        subtitle="Points are awarded automatically for verified pickups and completed sales. Manual adjustments are logged."
        fetcher={AdminAPI.rewards}
        refreshKey={key}
        actions={<button type="button" className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Adjust points</button>}
        header={(d) => d?.leaderboard?.length > 0 && (
          <div className="card card-pad mb-6"><h2 className="font-semibold">Leaderboard</h2><ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{d.leaderboard.map((u, i) => <li key={u._id} className="rounded-xl bg-canvas p-3 text-sm"><span className="text-gray-400">#{i + 1}</span> <span className="font-medium">{u.name}</span><p className="font-bold text-brand-700">{u.ecoPoints} pts</p></li>)}</ol></div>
        )}
        columns={[
          { label: 'When', render: (r) => dateTime(r.createdAt) },
          { label: 'User', render: (r) => r.user?.name },
          { label: 'Reason', render: (r) => <span className="block max-w-[320px] truncate">{r.reason}</span> },
          { label: 'Type', render: (r) => titleCase(r.type) },
          { label: 'Points', render: (r) => <span className={`font-semibold ${r.points > 0 ? 'text-brand-700' : 'text-rose-600'}`}>{r.points > 0 ? '+' : ''}{r.points}</span> },
        ]}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Adjust eco-points">
        <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
          <Field label="User" error={errors.userId?.message}><select className="input" {...register('userId', { required: 'Required' })}><option value="">Select…</option>{users.data?.items?.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email}) — {u.ecoPoints} pts</option>)}</select></Field>
          <Field label="Points (negative to deduct)" error={errors.points?.message}><input type="number" className="input" {...register('points', { required: 'Required', validate: (v) => Number(v) !== 0 || 'Cannot be 0' })} /></Field>
          <Field label="Reason" error={errors.reason?.message}><input className="input" {...register('reason', { required: 'Required', minLength: { value: 3, message: 'Too short' } })} /></Field>
          <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={isSubmitting}>Apply</button></div>
        </form>
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ Complaints
export function AdminComplaints() {
  const toast = useToast();
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ status: 'in_progress', adminResponse: '' });
  const [key, setKey] = useState(0);
  const save = async () => {
    try { await AdminAPI.updateComplaint(sel._id, { status: form.status, adminResponse: form.adminResponse || undefined }); toast.success('Complaint updated'); setSel(null); setKey((k) => k + 1); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <AdminTable
        title="Complaints"
        fetcher={AdminAPI.complaints}
        refreshKey={key}
        tabs={[['', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']]}
        columns={[
          { label: 'Ref', render: (c) => <span className="text-xs">{c.complaintRef}</span> },
          { label: 'Subject', render: (c) => <span className="block max-w-[260px] truncate font-medium">{c.subject}</span> },
          { label: 'User', render: (c) => `${c.user?.name} (${c.user?.role})` },
          { label: 'Category', render: (c) => titleCase(c.category) },
          { label: 'Raised', render: (c) => timeAgo(c.createdAt) },
          { label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          { label: 'Actions', render: (c) => <button type="button" className="btn-secondary btn-sm" onClick={() => { setSel(c); setForm({ status: c.status === 'open' ? 'in_progress' : c.status, adminResponse: c.adminResponse || '' }); }}>Handle</button> },
        ]}
      />
      {sel && (
        <Modal open onClose={() => setSel(null)} title={sel.subject} footer={<button type="button" className="btn-primary" onClick={save}>Save</button>}>
          <p className="text-xs text-gray-400">{sel.complaintRef} · {sel.user?.email} {sel.relatedId && `· Ref ${sel.relatedId}`}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{sel.description}</p>
          <div className="mt-4 space-y-3">
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{['open', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></Field>
            <Field label="Response to user"><textarea className="input min-h-[100px]" value={form.adminResponse} onChange={(e) => setForm({ ...form, adminResponse: e.target.value })} maxLength={2000} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Settings
export function AdminSettings() {
  const toast = useToast();
  const { data, loading, error, refetch } = useFetch(() => AdminAPI.settings(), []);
  const health = useFetch(() => fetch(`${import.meta.env.VITE_API_URL || ''}/api/health`).then((r) => r.json()), []);
  const ai = useFetch(() => AiAPI.health(), []);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  useEffect(() => { if (data?.settings) reset(data.settings); }, [data, reset]);
  const save = async (v) => {
    try {
      await AdminAPI.updateSettings({
        listingRequiresApproval: Boolean(v.listingRequiresApproval), matchingRadiusKm: Number(v.matchingRadiusKm), maxCandidateCollectors: Number(v.maxCandidateCollectors),
        rewardPointsPerKg: Number(v.rewardPointsPerKg), rewardPointsPerProductSale: Number(v.rewardPointsPerProductSale), rewardPointsPerProductPurchase: Number(v.rewardPointsPerProductPurchase),
      });
      toast.success('Settings saved'); refetch();
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <PageHeader title="Platform settings" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AsyncView loading={loading} error={error} onRetry={refetch}>
          <form onSubmit={handleSubmit(save)} className="card card-pad space-y-5" noValidate>
            <label className="flex items-center justify-between rounded-xl bg-canvas p-4"><span><span className="block font-semibold">Require approval for new listings</span><span className="text-sm text-gray-500">New and edited listings go to "Pending Approval" first.</span></span><input type="checkbox" className="h-5 w-5 accent-brand-700" {...register('listingRequiresApproval')} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collector matching radius (km)"><input type="number" min="1" max="100" className="input" {...register('matchingRadiusKm')} /></Field>
              <Field label="Collectors notified per request"><input type="number" min="1" max="20" className="input" {...register('maxCandidateCollectors')} /></Field>
              <Field label="Eco-points per verified kg"><input type="number" min="0" className="input" {...register('rewardPointsPerKg')} /></Field>
              <Field label="Eco-points per product sold"><input type="number" min="0" className="input" {...register('rewardPointsPerProductSale')} /></Field>
              <Field label="Eco-points per product bought"><input type="number" min="0" className="input" {...register('rewardPointsPerProductPurchase')} /></Field>
            </div>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>Save settings</button>
          </form>
        </AsyncView>
        <aside className="card card-pad space-y-3 self-start text-sm">
          <h2 className="font-semibold">Integrations status</h2>
          {health.data?.services && Object.entries(health.data.services).map(([k, v]) => <p key={k} className="flex justify-between gap-2"><span className="text-gray-500">{titleCase(k)}</span><span className="text-right font-medium">{v}</span></p>)}
          {ai.data?.ai && Object.entries(ai.data.ai).map(([k, v]) => <p key={k} className="flex justify-between gap-2"><span className="text-gray-500">AI {k}</span><span className={`text-right font-medium ${v === 'unreachable' ? 'text-red-600' : ''}`}>{String(v)}</span></p>)}
          <p className="pt-2 text-xs text-gray-400">Configure credentials via environment variables — see docs/setup-guide.md.</p>
        </aside>
      </div>
    </>
  );
}
