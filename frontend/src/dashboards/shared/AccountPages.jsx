import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Camera, FileWarning, Heart, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { AuthAPI, MiscAPI, UserAPI, errorMessage, toFormData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ProductCard from '../../components/ProductCard';
import { MapPicker } from '../../components/Maps';
import { AsyncView, Avatar, Field, Modal, PageHeader, RatingStars, Spinner, StatusBadge } from '../../components/ui';
import { date, timeAgo, titleCase } from '../../utils/format';

// ------------------------------------------------------------------ Favourites
export function Favourites() {
  const toast = useToast();
  const { data, loading, error, refetch, setData } = useFetch(() => MiscAPI.favourites(), []);
  const toggle = async (id) => {
    try { await MiscAPI.toggleFavourite(id); setData((d) => ({ ...d, items: d.items.filter((i) => i._id !== id) })); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <PageHeader title="My favourites" subtitle="Products you've saved for later." />
      <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: Heart, title: 'No favourites yet', message: 'Tap the heart on any product to save it here.', action: <Link to="/products" className="btn-primary">Browse products</Link> }}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data?.items?.map((p) => <ProductCard key={p._id} product={p} isFavourite onToggleFavourite={toggle} showStatus />)}</div>
      </AsyncView>
    </>
  );
}

// ------------------------------------------------------------------ Profile + addresses
function AddressModal({ open, onClose, onSaved, initial }) {
  const toast = useToast();
  const [coords, setCoords] = useState(initial?.location?.coordinates || null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: initial || { label: 'Home', isDefault: false } });
  const submit = async (v) => {
    if (!coords) { toast.error('Drop a pin on the map'); return; }
    const body = { label: v.label, line1: v.line1, locality: v.locality || undefined, city: v.city, pincode: v.pincode || undefined, coordinates: coords, isDefault: Boolean(v.isDefault) };
    try {
      const res = initial?._id ? await UserAPI.updateAddress(initial._id, body) : await UserAPI.addAddress(body);
      toast.success('Address saved');
      onSaved(res.addresses);
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'Edit address' : 'Add address'} size="max-w-2xl">
      <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label"><input className="input" {...register('label')} /></Field>
          <Field label="House / street" error={errors.line1?.message}><input className="input" {...register('line1', { required: 'Required', minLength: { value: 3, message: 'Too short' } })} /></Field>
          <Field label="Locality"><input className="input" {...register('locality')} /></Field>
          <Field label="City" error={errors.city?.message}><input className="input" {...register('city', { required: 'Required' })} /></Field>
          <Field label="Pincode" error={errors.pincode?.message}><input className="input" maxLength={6} {...register('pincode', { pattern: { value: /^\d{6}$/, message: '6 digits' } })} /></Field>
          <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-700" {...register('isDefault')} /> Set as default</label>
        </div>
        <MapPicker value={coords} onChange={setCoords} height="h-60" />
        <div className="flex justify-end"><button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Save address</button></div>
      </form>
    </Modal>
  );
}

export function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [avatar, setAvatar] = useState(null);
  const [addrModal, setAddrModal] = useState(null);
  const reviews = useFetch(() => MiscAPI.reviewsFor(user._id, { limit: 5 }), [user._id]);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: { name: user.name, phone: user.phone || '' } });

  const save = async (v) => {
    try {
      const res = await UserAPI.updateProfile(toFormData({ name: v.name, phone: v.phone || undefined }, { profileImage: avatar }));
      setUser(res.user);
      setAvatar(null);
      toast.success('Profile updated');
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const removeAddress = async (id) => {
    try { const res = await UserAPI.deleteAddress(id); setUser({ ...user, addresses: res.addresses }); toast.success('Address removed'); } catch (err) { toast.error(errorMessage(err)); }
  };

  const showAddresses = ['customer', 'buyer'].includes(user.role);
  return (
    <>
      <PageHeader title="Profile" subtitle={`${titleCase(user.role)} · member since ${date(user.createdAt)}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <form onSubmit={handleSubmit(save)} className="card card-pad space-y-4" noValidate>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar name={user.name} src={avatar ? URL.createObjectURL(avatar) : user.profileImage} size="h-16 w-16" />
                <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-brand-700 p-1.5 text-white" aria-label="Change photo"><Camera className="h-3.5 w-3.5" /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setAvatar(e.target.files?.[0] || null)} /></label>
              </div>
              <div><p className="font-semibold">{user.name}</p><p className="text-sm text-gray-500">{user.email}</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name?.message}><input className="input" {...register('name', { required: 'Required', minLength: { value: 2, message: 'Too short' } })} /></Field>
              <Field label="Mobile" error={errors.phone?.message}><input className="input" {...register('phone', { pattern: { value: /^[6-9]\d{9}$/, message: '10-digit mobile number' } })} /></Field>
            </div>
            <button type="submit" className="btn-primary" disabled={isSubmitting || (!isDirty && !avatar)}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Save changes</button>
          </form>

          {showAddresses && (
            <div className="card card-pad">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Saved addresses</h2><button type="button" className="btn-secondary btn-sm" onClick={() => setAddrModal({})}><Plus className="h-4 w-4" /> Add</button></div>
              {user.addresses?.length ? (
                <ul className="mt-4 space-y-2">
                  {user.addresses.map((a) => (
                    <li key={a._id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
                      <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 text-brand-700" /><div className="text-sm"><p className="font-medium">{a.label} {a.isDefault && <span className="badge ml-1 bg-brand-50 text-brand-700">Default</span>}</p><p className="text-gray-500">{a.line1}, {a.locality ? `${a.locality}, ` : ''}{a.city} {a.pincode}</p></div></div>
                      <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm" onClick={() => setAddrModal(a)}>Edit</button><button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => removeAddress(a._id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-gray-500">No saved addresses yet.</p>}
            </div>
          )}
        </div>
        <aside className="space-y-6">
          <div className="card card-pad text-sm">
            <h2 className="font-semibold">Ratings</h2>
            {user.role === 'customer' && <p className="mt-2 flex items-center gap-2"><RatingStars value={user.sellerRating?.average} /> as seller ({user.sellerRating?.count || 0})</p>}
            {['customer'].includes(user.role) && <p className="mt-1 flex items-center gap-2"><RatingStars value={user.customerRating?.average} /> from collectors ({user.customerRating?.count || 0})</p>}
            {reviews.data?.items?.length ? (
              <ul className="mt-4 space-y-3">{reviews.data.items.map((r) => <li key={r._id} className="border-t border-gray-50 pt-3"><div className="flex justify-between"><span className="font-medium">{r.reviewer?.name}</span><span className="flex items-center gap-0.5 text-xs"><Star className="h-3.5 w-3.5 fill-accent-400 text-accent-400" />{r.rating}</span></div>{r.comment && <p className="text-gray-600">{r.comment}</p>}<p className="text-[11px] text-gray-400">{timeAgo(r.createdAt)}</p></li>)}</ul>
            ) : <p className="mt-3 text-gray-500">No reviews yet.</p>}
          </div>
          {user.role !== 'admin' && <div className="card card-pad text-sm"><p className="font-semibold">Eco-points</p><p className="mt-1 text-2xl font-bold text-brand-700">{user.ecoPoints}</p></div>}
        </aside>
      </div>
      {addrModal && <AddressModal open initial={addrModal._id ? addrModal : null} onClose={() => setAddrModal(null)} onSaved={(addresses) => { setUser({ ...user, addresses }); setAddrModal(null); }} />}
    </>
  );
}

// ------------------------------------------------------------------ Settings (password)
export function Settings() {
  const toast = useToast();
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm();
  const submit = async ({ currentPassword, newPassword }) => {
    try { await AuthAPI.changePassword({ currentPassword, newPassword }); toast.success('Password updated'); reset(); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <PageHeader title="Settings" subtitle="Security and account preferences." />
      <form onSubmit={handleSubmit(submit)} className="card card-pad max-w-lg space-y-4" noValidate>
        <h2 className="font-semibold">Change password</h2>
        <Field label="Current password" error={errors.currentPassword?.message}><input type="password" className="input" autoComplete="current-password" {...register('currentPassword', { required: 'Required' })} /></Field>
        <Field label="New password" error={errors.newPassword?.message}><input type="password" className="input" autoComplete="new-password" {...register('newPassword', { required: 'Required', minLength: { value: 8, message: 'At least 8 characters' }, validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Include a letter and a number' })} /></Field>
        <Field label="Confirm new password" error={errors.confirm?.message}><input type="password" className="input" autoComplete="new-password" {...register('confirm', { validate: (v) => v === watch('newPassword') || 'Passwords do not match' })} /></Field>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Update password</button>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ Complaints
export function Complaints() {
  const toast = useToast();
  const { data, loading, error, refetch } = useFetch(() => MiscAPI.myComplaints(), []);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { category: 'booking' } });
  const submit = async (v) => {
    try { await MiscAPI.complaint({ ...v, relatedId: v.relatedId || undefined }); toast.success('Complaint submitted. Our team will respond soon.'); reset(); refetch(); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <PageHeader title="Complaints & support" subtitle="Report a problem with a pickup, order, listing or payment." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit(submit)} className="card card-pad space-y-3 self-start" noValidate>
          <h2 className="font-semibold">New complaint</h2>
          <Field label="Category"><select className="input" {...register('category')}>{['booking', 'order', 'listing', 'payment', 'account', 'other'].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
          <Field label="Reference (optional)" hint="Booking / order reference, e.g. RC-PK-…"><input className="input" {...register('relatedId', { maxLength: 60 })} /></Field>
          <Field label="Subject" error={errors.subject?.message}><input className="input" {...register('subject', { required: 'Required', minLength: { value: 4, message: 'Too short' } })} /></Field>
          <Field label="Describe the issue" error={errors.description?.message}><textarea className="input min-h-[120px]" {...register('description', { required: 'Required', minLength: { value: 10, message: 'At least 10 characters' } })} /></Field>
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>Submit</button>
        </form>
        <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: FileWarning, title: 'No complaints raised', message: 'Hopefully it stays that way!' }}>
          <div className="space-y-3">
            {data?.items?.map((c) => (
              <div key={c._id} className="card card-pad">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{c.subject}</p><StatusBadge status={c.status} /></div>
                <p className="text-xs text-gray-400">{c.complaintRef} · {titleCase(c.category)} · {timeAgo(c.createdAt)}</p>
                <p className="mt-2 text-sm text-gray-600">{c.description}</p>
                {c.adminResponse && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900"><strong>Response:</strong> {c.adminResponse}</p>}
              </div>
            ))}
          </div>
        </AsyncView>
      </div>
    </>
  );
}
