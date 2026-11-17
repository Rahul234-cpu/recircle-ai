import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Info, Plus, Sparkles, Star, Trash2, Truck,
} from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import { CollectorAPI, UserAPI, WasteAPI, errorMessage, toFormData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfidenceBar, Field, Loader, PageHeader, Spinner } from '../../components/ui';
import { MapPicker } from '../../components/Maps';
import { TIME_SLOTS } from '../../utils/constants';
import { inr, num, titleCase, todayISO } from '../../utils/format';

let keySeq = 1;
const newItem = (extra = {}) => ({ key: keySeq++, file: null, preview: null, analysis: null, categoryId: '', weight: '', analyzing: false, error: '', ...extra });

function StepIndicator({ step }) {
  const steps = ['Identify waste', 'Pickup details', 'Review & book'];
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= step ? 'bg-brand-700 text-white' : 'bg-gray-200 text-gray-500'}`}>{i < step ? '✓' : i + 1}</span>
          <span className={`hidden sm:inline ${i === step ? 'font-semibold text-ink' : 'text-gray-500'}`}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-gray-300 sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function AnalysisCard({ item }) {
  const a = item.analysis;
  if (item.analyzing) return <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner className="h-4 w-4" /> Analysing photo…</div>;
  if (item.error) return <p className="text-sm text-red-600">{item.error}</p>;
  if (!a) return null;
  if (!a.aiAvailable) {
    return <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{a.message} Please choose the category yourself.</p>;
  }
  return (
    <div className="space-y-2 rounded-xl bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-600" /> {titleCase(a.material)}</p>
        <span className={`badge ${a.isDemo ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-brand-50 text-brand-800'}`}>{a.isDemo ? 'Demo AI' : a.provider}</span>
      </div>
      <ConfidenceBar value={a.confidence} />
      {a.predictions?.length > 1 && <p className="text-xs text-gray-500">Other possibilities: {a.predictions.slice(1, 3).map((p) => `${titleCase(p.material)} ${Math.round(p.confidence * 100)}%`).join(' · ')}</p>}
      <p className="text-xs text-gray-600"><strong>{a.recyclable ? 'Recyclable' : 'Check before booking'}.</strong> {a.suggestedCategory?.recyclingInfo}</p>
      <p className="flex items-start gap-1.5 text-xs text-gray-600"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{a.nextAction}</p>
      {a.limitations && <p className="text-[11px] text-gray-400">{a.limitations}</p>}
    </div>
  );
}

export default function SellWaste({ mode = 'photo' }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const cats = useFetch(() => WasteAPI.categories(), []);
  const categories = cats.data?.categories || [];
  const [step, setStep] = useState(0);
  const [items, setItems] = useState(() => (mode === 'manual' ? [newItem()] : []));
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const defaultAddr = user.addresses?.find((a) => a.isDefault) || user.addresses?.[0];
  const [addrChoice, setAddrChoice] = useState(defaultAddr?._id || 'new');
  const [addr, setAddr] = useState({ line1: '', locality: '', city: '', pincode: '', coordinates: null });
  const [saveAddr, setSaveAddr] = useState(true);
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [slot, setSlot] = useState('10:00-12:00');
  const [notes, setNotes] = useState('');
  const [collectors, setCollectors] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  // ---------------- photo analysis
  const addPhotos = async (files) => {
    const valid = Array.from(files).filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) toast.error('Some files were skipped (JPG/PNG/WebP up to 5 MB only).');
    const created = valid.slice(0, 10 - items.length).map((f) => newItem({ file: f, preview: URL.createObjectURL(f), analyzing: true }));
    setItems((l) => [...l, ...created]);
    for (const it of created) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await WasteAPI.analyze(toFormData({}, { image: it.file }));
        update(it.key, { analyzing: false, analysis: res, categoryId: res.suggestedCategory?._id || '', analysisId: res.analysisId });
      } catch (err) {
        update(it.key, { analyzing: false, error: errorMessage(err) });
      }
    }
  };
  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []); // eslint-disable-line

  // ---------------- live estimate (server computes with admin rates)
  const validItems = items.filter((i) => i.categoryId && Number(i.weight) > 0);
  const estKey = useDebounce(JSON.stringify(validItems.map((i) => [i.categoryId, i.weight])), 350);
  useEffect(() => {
    if (!validItems.length) { setEstimate(null); return; }
    setEstimating(true);
    WasteAPI.estimate({ items: validItems.map((i) => ({ categoryId: i.categoryId, estimatedWeightKg: Number(i.weight) })) })
      .then((r) => setEstimate(r.estimate))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setEstimating(false));
  }, [estKey]); // eslint-disable-line

  // ---------------- address
  const pickup = useMemo(() => {
    if (addrChoice !== 'new') {
      const a = user.addresses.find((x) => x._id === addrChoice);
      return a ? { line1: a.line1, locality: a.locality, city: a.city, pincode: a.pincode, coordinates: a.location?.coordinates } : null;
    }
    return addr;
  }, [addrChoice, addr, user.addresses]);

  const step0Valid = items.length > 0 && items.every((i) => i.categoryId && Number(i.weight) > 0 && !i.analyzing);
  const step1Valid = pickup?.line1?.length >= 3 && pickup?.city?.length >= 2 && pickup?.coordinates && pickupDate && slot && (!pickup.pincode || /^\d{6}$/.test(pickup.pincode));

  const checkCollectors = async () => {
    if (!pickup?.coordinates) return;
    try {
      const res = await CollectorAPI.nearby({ lng: pickup.coordinates[0], lat: pickup.coordinates[1], date: pickupDate, timeSlot: slot, materials: (estimate?.lines || []).map((l) => l.slug).join(',') });
      setCollectors(res.collectors);
    } catch (err) { toast.error(errorMessage(err)); }
  };
  useEffect(() => { if (step === 2) checkCollectors(); }, [step]); // eslint-disable-line

  const submit = async () => {
    setSubmitting(true);
    try {
      if (addrChoice === 'new' && saveAddr) {
        try { await UserAPI.addAddress({ label: 'Pickup', line1: addr.line1, locality: addr.locality || undefined, city: addr.city, pincode: addr.pincode || undefined, coordinates: addr.coordinates }); await refreshUser(); } catch { /* non-blocking */ }
      }
      const res = await WasteAPI.createBooking({
        items: items.map((i) => ({
          categoryId: i.categoryId,
          estimatedWeightKg: Number(i.weight),
          analysisId: i.analysisId || undefined,
          userOverrodeAI: Boolean(i.analysis?.suggestedCategory && i.analysis.suggestedCategory._id !== i.categoryId),
        })),
        pickupAddress: { line1: pickup.line1, locality: pickup.locality || undefined, city: pickup.city, pincode: pickup.pincode || undefined, coordinates: pickup.coordinates },
        preferredDate: pickupDate,
        preferredTimeSlot: slot,
        customerNotes: notes || undefined,
      });
      toast.success(res.candidatesNotified ? `Request sent to ${res.candidatesNotified} nearby collector(s).` : 'Booking created. We will assign a collector soon.');
      navigate(`/customer/bookings/${res.booking._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (cats.loading) return <Loader />;

  return (
    <>
      <PageHeader title={mode === 'manual' ? 'Book a collection' : 'Sell waste'} subtitle={mode === 'manual' ? 'Choose materials and schedule a doorstep pickup.' : 'Upload photos — our AI identifies the material and estimates your price.'} />
      <StepIndicator step={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {step === 0 && (
            <>
              {mode === 'photo' && (
                <label className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 p-8 text-center hover:border-brand-600">
                  <Camera className="h-8 w-8 text-brand-700" />
                  <span className="font-semibold">Upload waste photos</span>
                  <span className="text-xs text-gray-500">One photo per material type works best · JPG/PNG/WebP up to 5 MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                </label>
              )}
              {items.map((it) => (
                <div key={it.key} className="card card-pad">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {it.preview && <img src={it.preview} alt="" className="h-32 w-full rounded-xl object-cover sm:w-32" />}
                    <div className="flex-1 space-y-3">
                      <AnalysisCard item={it} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Category" hint={it.analysis?.suggestedCategory && it.categoryId !== it.analysis.suggestedCategory._id ? 'You changed the AI suggestion' : undefined}>
                          <select className="input" value={it.categoryId} onChange={(e) => update(it.key, { categoryId: e.target.value })}>
                            <option value="">Select category</option>
                            {categories.map((c) => <option key={c._id} value={c._id}>{c.name} {c.rate ? `(${inr(c.rate.pricePerKg)}/kg)` : ''}</option>)}
                          </select>
                        </Field>
                        <Field label="Approx. weight (kg)">
                          <input type="number" min="0.1" step="0.1" max="2000" className="input" value={it.weight} onChange={(e) => update(it.key, { weight: e.target.value })} placeholder="e.g. 10" />
                        </Field>
                      </div>
                    </div>
                    <button type="button" className="self-start rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => setItems((l) => [...l, newItem()])}><Plus className="h-4 w-4" /> Add item without photo</button>
              {mode === 'photo' && <p className="text-xs text-gray-500">Not sure of the weight? A newspaper stack 30 cm high ≈ 8–10 kg. A 1 L PET bottle ≈ 30 g.</p>}
            </>
          )}

          {step === 1 && (
            <div className="card card-pad space-y-5">
              <div>
                <p className="label">Pickup address</p>
                <div className="space-y-2">
                  {user.addresses?.map((a) => (
                    <label key={a._id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${addrChoice === a._id ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200'}`}>
                      <input type="radio" name="addr" checked={addrChoice === a._id} onChange={() => setAddrChoice(a._id)} className="mt-1 accent-brand-700" />
                      <span className="text-sm"><strong>{a.label}</strong> — {a.line1}, {a.locality ? `${a.locality}, ` : ''}{a.city} {a.pincode}{!a.location?.coordinates && <span className="block text-xs text-red-600">No map location saved — choose "new address" instead.</span>}</span>
                    </label>
                  ))}
                  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${addrChoice === 'new' ? 'border-brand-600 bg-brand-50/50' : 'border-gray-200'}`}>
                    <input type="radio" name="addr" checked={addrChoice === 'new'} onChange={() => setAddrChoice('new')} className="accent-brand-700" />
                    <span className="text-sm font-medium">Use a new address</span>
                  </label>
                </div>
              </div>
              {addrChoice === 'new' && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="House / street" required><input className="input" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} /></Field>
                    <Field label="Locality"><input className="input" value={addr.locality} onChange={(e) => setAddr({ ...addr, locality: e.target.value })} /></Field>
                    <Field label="City" required><input className="input" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></Field>
                    <Field label="Pincode" error={addr.pincode && !/^\d{6}$/.test(addr.pincode) ? '6 digits' : undefined}><input className="input" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, '') })} /></Field>
                  </div>
                  <MapPicker value={addr.coordinates} onChange={(c) => setAddr({ ...addr, coordinates: c })} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="accent-brand-700" /> Save this address to my profile</label>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pickup date" required><input type="date" className="input" min={todayISO()} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} /></Field>
                <Field label="Time slot" required>
                  <select className="input" value={slot} onChange={(e) => setSlot(e.target.value)}>{TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </Field>
              </div>
              <Field label="Notes for the collector" hint="e.g. 3rd floor, no lift; call on arrival"><textarea className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="card card-pad">
                <h3 className="font-semibold">Pickup</h3>
                <p className="mt-1 text-sm text-gray-600">{pickup.line1}, {pickup.locality ? `${pickup.locality}, ` : ''}{pickup.city} {pickup.pincode}</p>
                <p className="text-sm text-gray-600">{new Date(pickupDate).toDateString()} · {slot}</p>
                {notes && <p className="mt-1 text-sm text-gray-500">Note: {notes}</p>}
              </div>
              <div className="card card-pad">
                <h3 className="flex items-center gap-2 font-semibold"><Truck className="h-5 w-5 text-brand-700" /> Collectors available for this slot</h3>
                {collectors === null ? <div className="mt-3"><Spinner /></div> : collectors.length ? (
                  <ul className="mt-3 divide-y divide-gray-50">
                    {collectors.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div><p className="font-medium">{c.businessName}</p><p className="text-xs text-gray-500">{c.distanceKm} km away · {c.completedCollections} pickups · {c.vehicleType}</p></div>
                        <span className="flex items-center gap-1 text-xs font-semibold"><Star className="h-3.5 w-3.5 fill-accent-400 text-accent-400" />{c.averageRating?.toFixed(1) || 'New'}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No verified collector is available for this location and slot yet. You can still book — an admin can assign one — or go back and try another slot.</p>}
                <p className="mt-3 text-xs text-gray-500">Top matches (by distance, rating and free capacity) are notified. Your exact address is shared only with the collector who accepts.</p>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}><ArrowLeft className="h-4 w-4" /> Back</button>
            {step < 2 ? (
              <button type="button" className="btn-primary" disabled={step === 0 ? !step0Valid : !step1Valid} onClick={() => setStep((s) => s + 1)}>Continue <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <button type="button" className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? <Spinner className="h-4 w-4 text-white" /> : <CheckCircle2 className="h-4 w-4" />} Confirm booking</button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card card-pad">
            <h3 className="font-semibold">Indicative estimate</h3>
            {estimate ? (
              <>
                <ul className="mt-3 space-y-2 text-sm">
                  {estimate.lines.map((l) => (
                    <li key={l.categoryId} className="flex justify-between gap-2"><span className="text-gray-600">{l.name} · {num(l.estimatedWeightKg)} kg × {inr(l.ratePerKg)}</span><span className="font-medium">{inr(l.estimatedPrice)}</span></li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-gray-100 pt-3"><span className="font-semibold">Total ({num(estimate.totalWeightKg)} kg)</span><span className="text-xl font-bold text-brand-700">{inr(estimate.estimatedPrice)}</span></div>
                <p className="mt-3 text-xs text-gray-500">{estimate.disclaimer}</p>
              </>
            ) : <p className="mt-2 text-sm text-gray-500">{estimating ? 'Calculating…' : 'Add a category and weight to see your estimate.'}</p>}
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">Rates are set by admins. <Link to="/waste-collection" className="text-brand-700">See all rates</Link></p>
        </aside>
      </div>
    </>
  );
}
