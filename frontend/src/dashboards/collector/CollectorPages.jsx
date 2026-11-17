import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, Check, CheckCircle2, ClipboardList, Clock, IndianRupee, Info, MapPinned, Plus, Scale, Star, Trash2, Truck, X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useFetch from '../../hooks/useFetch';
import { CollectorAPI, WasteAPI, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { MapPicker, MarkersMap } from '../../components/Maps';
import { AsyncView, DemoBadge, EmptyState, Field, Loader, PageHeader, Pagination, RatingStars, Spinner, StatCard, StatusBadge } from '../../components/ui';
import { TIME_SLOTS, WEEKDAYS } from '../../utils/constants';
import { date, inr, num, timeAgo } from '../../utils/format';

// ------------------------------------------------------------------ Dashboard
export function CollectorDashboard() {
  const { tick } = useNotifications();
  const { data, loading, error, refetch } = useFetch(() => CollectorAPI.dashboard(), [tick]);
  const s = data?.stats;
  const byDay = useMemo(() => {
    const map = new Map();
    (data?.calendar || []).forEach((b) => {
      const k = date(b.preferredDate);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(b);
    });
    return [...map.entries()];
  }, [data]);

  return (
    <>
      <PageHeader title="Collector dashboard" subtitle="Your pickups, requests and earnings at a glance." actions={<Link to="/collector/requests" className="btn-primary"><MapPinned className="h-4 w-4" /> Nearby requests</Link>} />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {s && (
          <>
            {!s.isAvailable && s.verificationStatus === 'approved' && <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">You're marked unavailable, so you won't receive new requests. <Link to="/collector/availability" className="font-semibold underline">Change availability</Link></div>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ClipboardList} label="Pending requests" value={s.pendingRequests} tone="accent" />
              <StatCard icon={Truck} label="Accepted bookings" value={s.acceptedBookings} tone="sky" />
              <StatCard icon={CheckCircle2} label="Completed pickups" value={s.completedPickups} />
              <StatCard icon={Star} label="Average rating" value={s.averageRating ? s.averageRating.toFixed(1) : '—'} hint={`${s.ratingCount} reviews`} tone="violet" />
              <StatCard icon={Scale} label="Total collected" value={`${num(s.totalKgCollected)} kg`} />
              <StatCard icon={IndianRupee} label="Paid to customers" value={inr(s.totalPaidToCustomers)} tone="sky" />
              <StatCard icon={IndianRupee} label="Estimated margin" value={inr(s.estimatedMargin)} hint="Based on admin reference resale rates" tone="accent" />
              <StatCard icon={ClipboardList} label="Total collections" value={s.totalCollections} />
            </div>
            <div className="card card-pad mt-6">
              <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-brand-700" /> Booking calendar</h2>
              {byDay.length ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {byDay.map(([day, list]) => (
                    <div key={day} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-sm font-semibold">{day}</p>
                      <ul className="mt-2 space-y-2">
                        {list.map((b) => (
                          <li key={b._id}><Link to={`/collector/bookings/${b._id}`} className="block rounded-lg bg-canvas p-2.5 text-sm hover:bg-brand-50">
                            <div className="flex justify-between"><span className="font-medium">{b.preferredTimeSlot}</span><StatusBadge status={b.status} /></div>
                            <p className="text-xs text-gray-500">{b.materialSummary.map((m) => m.name).join(', ')} · ~{b.estimatedWeight} kg · {b.pickupAddress?.locality}</p>
                          </Link></li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-gray-500">No upcoming pickups. Accept nearby requests to fill your calendar.</p>}
            </div>
          </>
        )}
      </AsyncView>
    </>
  );
}

// ------------------------------------------------------------------ Nearby requests
export function NearbyRequests() {
  const toast = useToast();
  const { user } = useAuth();
  const { tick } = useNotifications();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);
  const { data, loading, error, refetch } = useFetch(() => CollectorAPI.requests({ page }), [page, tick]);
  const profile = useFetch(() => CollectorAPI.me(), []);
  const verified = user.collectorProfile?.verificationStatus === 'approved' || profile.data?.profile?.verificationStatus === 'approved';

  const act = async (id, kind) => {
    setBusy(id + kind);
    try {
      if (kind === 'accept') { await CollectorAPI.accept(id); toast.success('Accepted! Full address is now visible.'); } else { await CollectorAPI.reject(id); toast.info('Request declined'); }
      refetch();
    } catch (err) { toast.error(errorMessage(err)); refetch(); } finally { setBusy(null); }
  };

  const p = profile.data?.profile;
  return (
    <>
      <PageHeader title="Nearby requests" subtitle="Pickup requests matched to your service area and availability. Exact addresses unlock after you accept." />
      {!verified && <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">You'll receive requests once an admin verifies your account.</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: MapPinned, title: 'No open requests right now', message: 'New requests appear here in real time.' }}>
          <div className="space-y-3">
            {data?.items?.map((b) => (
              <div key={b._id} className="card card-pad">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{b.materialSummary.map((m) => `${m.name} (~${m.estimatedWeightKg} kg)`).join(', ')}</p>
                    <p className="mt-1 text-sm text-gray-500">{date(b.preferredDate)} · {b.preferredTimeSlot} · {b.pickupAddress.locality}, {b.pickupAddress.city} · ≈{b.approxDistanceKm} km</p>
                    <p className="mt-1 text-sm">Customer estimate: <strong>{inr(b.estimatedPrice)}</strong> for ~{num(b.estimatedWeight)} kg</p>
                    {b.customerNotes && <p className="mt-1 text-xs text-gray-500">“{b.customerNotes}”</p>}
                    <p className="mt-1 text-xs text-gray-400">{b.bookingRef} · requested {timeAgo(b.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary" disabled={!!busy} onClick={() => act(b._id, 'accept')}>{busy === `${b._id}accept` ? <Spinner className="h-4 w-4 text-white" /> : <Check className="h-4 w-4" />} Accept</button>
                    <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => act(b._id, 'reject')}><X className="h-4 w-4" /> Decline</button>
                  </div>
                </div>
                {b.wasteItems?.some((w) => w.images?.length) && <div className="mt-3 flex gap-2">{b.wasteItems.filter((w) => w.images?.length).map((w) => <img key={w._id} src={w.images[0].url} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}
              </div>
            ))}
            <Pagination pagination={data?.pagination} onPage={setPage} />
          </div>
        </AsyncView>
        <aside className="card card-pad self-start">
          <h2 className="mb-3 font-semibold">Your service area</h2>
          {p ? <MarkersMap height="h-72" center={p.location.coordinates} zoom={12} circle={{ center: p.location.coordinates, radiusKm: p.serviceRadiusKm }} markers={[{ id: 'base', position: p.location.coordinates, popup: 'Your base', highlight: true }]} /> : <Loader />}
          {p && <p className="mt-2 text-xs text-gray-500">{p.serviceRadiusKm} km radius · {p.serviceAreas.map((a) => a.name).join(', ')}</p>}
        </aside>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Earnings
export function Earnings() {
  const { data, loading, error, refetch } = useFetch(() => CollectorAPI.earnings(), []);
  return (
    <>
      <PageHeader title="Earnings" subtitle="Collection volume and estimated margin over the last 12 months." />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ClipboardList} label="Completed collections" value={data.summary?.completedCollections || 0} />
              <StatCard icon={Scale} label="Total kg collected" value={num(data.summary?.totalKgCollected)} />
              <StatCard icon={IndianRupee} label="Paid to customers" value={inr(data.summary?.totalPaidToCustomers)} tone="sky" />
              <StatCard icon={IndianRupee} label="Estimated margin" value={inr(data.summary?.estimatedMargin)} tone="accent" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card card-pad">
                <h2 className="font-semibold">Amount paid to customers per month</h2>
                <div className="mt-4 h-64">
                  {data.monthly.length ? (
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => inr(v)} /><Bar dataKey="paid" fill="#15803D" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
                  ) : <EmptyState title="No completed collections yet" />}
                </div>
              </div>
              <div className="card card-pad">
                <h2 className="font-semibold">Kilograms collected per month</h2>
                <div className="mt-4 h-64">
                  {data.monthly.length ? (
                    <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `${v} kg`} /><Line type="monotone" dataKey="kg" stroke="#10B981" strokeWidth={2.5} dot /></LineChart></ResponsiveContainer>
                  ) : <EmptyState title="No data yet" />}
                </div>
              </div>
            </div>
            <div className="card mt-6 overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Date</th><th>Booking</th><th>Receipt</th><th>Weight</th><th className="text-right">Paid</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{data.recent.map((t) => <tr key={t._id}><td>{date(t.createdAt)}</td><td><Link to={`/collector/bookings/${t.bookingId?._id}`} className="text-brand-700">{t.bookingId?.bookingRef}</Link> <DemoBadge show={t.isDemo} /></td><td className="text-xs">{t.receiptNumber}</td><td>{num(t.bookingId?.verifiedWeight)} kg</td><td className="text-right font-semibold">{inr(t.amount, { decimals: 2 })}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-4 flex gap-2 text-xs text-gray-500"><Info className="h-4 w-4 shrink-0" />{data.note}</p>
          </>
        )}
      </AsyncView>
    </>
  );
}

// ------------------------------------------------------------------ Service areas & Availability (shared loader)
function useCollectorProfile() {
  const res = useFetch(() => CollectorAPI.me(), []);
  return { ...res, profile: res.data?.profile };
}

export function ServiceAreas() {
  const toast = useToast();
  const { profile, loading, error, refetch } = useCollectorProfile();
  const cats = useFetch(() => WasteAPI.categories(), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) setForm({ coordinates: profile.location.coordinates, serviceRadiusKm: profile.serviceRadiusKm, serviceAreas: profile.serviceAreas.map(({ name, pincode }) => ({ name, pincode: pincode || '' })), acceptedMaterials: profile.acceptedMaterials || [] });
  }, [profile]);

  const save = async () => {
    const areas = form.serviceAreas.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), ...(a.pincode ? { pincode: a.pincode } : {}) }));
    if (!areas.length) { toast.error('Add at least one locality'); return; }
    if (areas.some((a) => a.pincode && !/^\d{6}$/.test(a.pincode))) { toast.error('Pincodes must be 6 digits'); return; }
    setSaving(true);
    try { await CollectorAPI.update({ coordinates: form.coordinates, serviceRadiusKm: Number(form.serviceRadiusKm), serviceAreas: areas, acceptedMaterials: form.acceptedMaterials }); toast.success('Service area updated'); refetch(); } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Service areas" subtitle="Where you collect and what you accept. Matching uses your base location and radius." />
      <AsyncView loading={loading || !form} error={error} onRetry={refetch}>
        {form && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="card card-pad">
              <MapPicker value={form.coordinates} onChange={(c) => setForm({ ...form, coordinates: c })} radiusKm={Number(form.serviceRadiusKm)} height="h-96" />
              <Field label={`Service radius: ${form.serviceRadiusKm} km`}><input type="range" min="1" max="25" className="w-full accent-brand-700" value={form.serviceRadiusKm} onChange={(e) => setForm({ ...form, serviceRadiusKm: e.target.value })} /></Field>
            </div>
            <div className="space-y-6">
              <div className="card card-pad">
                <h2 className="font-semibold">Localities</h2>
                <div className="mt-3 space-y-2">
                  {form.serviceAreas.map((a, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="flex gap-2">
                      <input className="input" value={a.name} placeholder="Locality" onChange={(e) => setForm({ ...form, serviceAreas: form.serviceAreas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <input className="input w-28" value={a.pincode} placeholder="Pincode" maxLength={6} onChange={(e) => setForm({ ...form, serviceAreas: form.serviceAreas.map((x, j) => (j === i ? { ...x, pincode: e.target.value.replace(/\D/g, '') } : x)) })} />
                      <button type="button" className="btn-ghost px-2" onClick={() => setForm({ ...form, serviceAreas: form.serviceAreas.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setForm({ ...form, serviceAreas: [...form.serviceAreas, { name: '', pincode: '' }] })}><Plus className="h-4 w-4" /> Add locality</button>
                </div>
              </div>
              <div className="card card-pad">
                <h2 className="font-semibold">Materials accepted</h2>
                <p className="text-xs text-gray-500">None selected = all materials.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cats.data?.categories?.map((c) => {
                    const on = form.acceptedMaterials.includes(c.slug);
                    return <button key={c.slug} type="button" onClick={() => setForm({ ...form, acceptedMaterials: on ? form.acceptedMaterials.filter((x) => x !== c.slug) : [...form.acceptedMaterials, c.slug] })} className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600'}`}>{c.name}</button>;
                  })}
                </div>
              </div>
              <button type="button" className="btn-primary w-full" onClick={save} disabled={saving}>{saving && <Spinner className="h-4 w-4 text-white" />}Save changes</button>
            </div>
          </div>
        )}
      </AsyncView>
    </>
  );
}

export function Availability() {
  const toast = useToast();
  const { profile, loading, error, refetch } = useCollectorProfile();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (profile) setForm({ isAvailable: profile.isAvailable, ...profile.availability }); }, [profile]);
  const toggle = (key, val) => setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));

  const save = async () => {
    if (!form.days.length || !form.timeSlots.length) { toast.error('Choose at least one day and one time slot'); return; }
    setSaving(true);
    try { await CollectorAPI.update({ isAvailable: form.isAvailable, availability: { days: form.days, timeSlots: form.timeSlots, dailyCapacity: Number(form.dailyCapacity) } }); toast.success('Availability saved'); refetch(); } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Availability" subtitle="Requests are only sent for days and slots you work, up to your daily capacity." />
      <AsyncView loading={loading || !form} error={error} onRetry={refetch}>
        {form && (
          <div className="card card-pad max-w-3xl space-y-6">
            <label className="flex items-center justify-between rounded-xl bg-canvas p-4">
              <span><span className="block font-semibold">Accepting new requests</span><span className="text-sm text-gray-500">Turn off when you're on leave or fully booked.</span></span>
              <button type="button" role="switch" aria-checked={form.isAvailable} onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })} className={`relative h-7 w-12 rounded-full transition ${form.isAvailable ? 'bg-brand-600' : 'bg-gray-300'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${form.isAvailable ? 'left-[1.4rem]' : 'left-0.5'}`} /></button>
            </label>
            <div><p className="label">Working days</p><div className="flex flex-wrap gap-2">{WEEKDAYS.map(([k, l]) => <button key={k} type="button" onClick={() => toggle('days', k)} className={`w-14 rounded-xl border py-2 text-sm font-medium ${form.days.includes(k) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600'}`}>{l}</button>)}</div></div>
            <div><p className="label">Time slots</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{TIME_SLOTS.map((s) => <button key={s} type="button" onClick={() => toggle('timeSlots', s)} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-medium ${form.timeSlots.includes(s) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600'}`}><Clock className="h-3.5 w-3.5" />{s}</button>)}</div></div>
            <div className="max-w-xs"><Field label="Max pickups per day"><input type="number" min="1" max="50" className="input" value={form.dailyCapacity} onChange={(e) => setForm({ ...form, dailyCapacity: e.target.value })} /></Field></div>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving && <Spinner className="h-4 w-4 text-white" />}Save availability</button>
          </div>
        )}
      </AsyncView>
    </>
  );
}

// ------------------------------------------------------------------ Reviews
export function CollectorReviews() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useFetch(() => CollectorAPI.reviews({ page }), [page]);
  const profile = useFetch(() => CollectorAPI.me(), []);
  const p = profile.data?.profile;
  return (
    <>
      <PageHeader title="Reviews" subtitle="What customers say about your pickups." />
      {p && <div className="card card-pad mb-6 flex items-center gap-4"><p className="text-4xl font-extrabold">{p.averageRating?.toFixed(1) || '—'}</p><div><RatingStars value={p.averageRating} size="h-5 w-5" /><p className="text-sm text-gray-500">{p.ratingCount} reviews · {p.completedCollections} completed pickups</p></div></div>}
      <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: Star, title: 'No reviews yet', message: 'Customers can rate you after each completed pickup.' }}>
        <div className="space-y-3">
          {data?.items?.map((r) => (
            <div key={r._id} className="card card-pad">
              <div className="flex items-center justify-between"><p className="font-semibold">{r.reviewer?.name}</p><RatingStars value={r.rating} /></div>
              {r.comment && <p className="mt-2 text-sm text-gray-600">{r.comment}</p>}
              <p className="mt-1 text-xs text-gray-400">{timeAgo(r.createdAt)} <DemoBadge show={r.isDemo} /></p>
            </div>
          ))}
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </AsyncView>
    </>
  );
}
