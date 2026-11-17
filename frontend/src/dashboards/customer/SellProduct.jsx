import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { Recycle, Sparkles, Tag, Wand2 } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { AiAPI, ProductAPI, errorMessage, toFormData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ImageUploader from '../../components/ImageUploader';
import { MapPicker } from '../../components/Maps';
import { ConfidenceBar, Field, Loader, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import { ACTION_META, CONDITIONS } from '../../utils/constants';
import { inr, titleCase } from '../../utils/format';

export default function SellProduct() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const cats = useFetch(() => ProductAPI.categories(), []);
  const existing = useFetch(() => (editing ? ProductAPI.get(id) : Promise.resolve(null)), [id]);
  const [files, setFiles] = useState([]);
  const [keptImages, setKeptImages] = useState([]);
  const [rec, setRec] = useState(null);
  const [decision, setDecision] = useState(null);
  const [price, setPrice] = useState(null);
  const [aiBusy, setAiBusy] = useState(null);

  const home = user.addresses?.find((a) => a.isDefault) || user.addresses?.[0];
  const { register, handleSubmit, control, watch, setValue, getValues, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      title: '', category: '', brand: '', condition: 'Good', ageMonths: '', originalPrice: '', sellingPrice: '', description: '',
      features: '', isWorking: true, city: home?.city || '', locality: home?.locality || '', coordinates: home?.location?.coordinates || null,
    },
  });

  useEffect(() => {
    const p = existing.data?.product;
    if (!p) return;
    if (!existing.data.isOwner) { toast.error('You can only edit your own listings'); navigate('/customer/listings'); return; }
    reset({
      title: p.title, category: p.category, brand: p.brand || '', condition: p.condition, ageMonths: p.ageMonths ?? '', originalPrice: p.originalPrice ?? '',
      sellingPrice: p.sellingPrice, description: p.description, features: (p.features || []).join(', '), isWorking: true,
      city: p.locationLabel?.city || '', locality: p.locationLabel?.locality || '', coordinates: p.location?.coordinates,
    });
    setKeptImages(p.images || []);
    if (p.AIRecommendedPrice?.suggested) setPrice({ ...p.AIRecommendedPrice, factors: [] });
    if (p.aiRecommendation?.action) setDecision(p.aiRecommendation.action);
  }, [existing.data]); // eslint-disable-line

  const featuresList = () => getValues('features').split(',').map((f) => f.trim()).filter(Boolean);

  const runRecommend = async () => {
    const v = getValues();
    if (!v.title && !v.description) { toast.error('Add a title or description first'); return; }
    setAiBusy('rec');
    try {
      const fd = toFormData({ title: v.title, description: `${v.description} ${v.features}`.trim(), category: v.category || undefined, condition: v.condition, ageMonths: v.ageMonths || undefined, isWorking: v.isWorking }, { image: files[0] });
      const res = await AiAPI.recommend(fd);
      setRec(res.recommendation);
      setDecision(res.recommendation.action);
      if (!v.category && res.recommendation.suggested_category) setValue('category', res.recommendation.suggested_category);
    } catch (err) { toast.error(errorMessage(err)); } finally { setAiBusy(null); }
  };

  const runPrice = async () => {
    const v = getValues();
    if (!v.category) { toast.error('Choose a category first'); return; }
    setAiBusy('price');
    try {
      const res = await AiAPI.price({ category: v.category, condition: v.condition, brand: v.brand || undefined, ageMonths: v.ageMonths ? Number(v.ageMonths) : undefined, originalPrice: v.originalPrice ? Number(v.originalPrice) : undefined, title: v.title });
      setPrice(res.estimate);
      if (!v.sellingPrice) setValue('sellingPrice', res.estimate.suggested);
    } catch (err) { toast.error(errorMessage(err)); } finally { setAiBusy(null); }
  };

  const runDescribe = async () => {
    const v = getValues();
    if (!v.title || v.title.length < 2) { toast.error('Add a title first'); return; }
    setAiBusy('desc');
    try {
      const res = await AiAPI.describe({ title: v.title, category: v.category || undefined, brand: v.brand || undefined, condition: v.condition, ageMonths: v.ageMonths ? Number(v.ageMonths) : undefined, features: featuresList(), notes: v.description || undefined });
      setValue('description', res.description, { shouldValidate: true });
      toast.success(res.provider === 'llm' ? 'Description generated — edit it as you like.' : 'Draft description created from your details — edit it as you like.');
    } catch (err) { toast.error(errorMessage(err)); } finally { setAiBusy(null); }
  };

  const save = (publish) => handleSubmit(async (v) => {
    if (!editing && !files.length) { toast.error('Add at least one photo'); return; }
    if (editing && !files.length && !keptImages.length) { toast.error('Keep or add at least one photo'); return; }
    if (!v.coordinates) { toast.error('Pick the item location on the map'); return; }
    const fields = {
      title: v.title, description: v.description, category: v.category, brand: v.brand || undefined, condition: v.condition,
      ageMonths: v.ageMonths || undefined, originalPrice: v.originalPrice || undefined, sellingPrice: v.sellingPrice,
      features: featuresList(), coordinates: v.coordinates, city: v.city, locality: v.locality || undefined, publish,
      aiRecommendedPrice: price ? { min: price.min, max: price.max, suggested: price.suggested, method: price.method } : undefined,
      aiRecommendation: decision ? { action: decision, reason: rec?.reason, confidence: rec?.confidence, userOverrode: rec ? decision !== rec.action : undefined } : undefined,
      ...(editing ? { keepImages: keptImages.map((i) => i.url) } : {}),
    };
    try {
      const fd = toFormData(fields, { images: files });
      const res = editing ? await ProductAPI.update(id, fd) : await ProductAPI.create(fd);
      const st = res.product.status;
      toast.success(st === 'Available' ? 'Your listing is live!' : st === 'Pending Approval' ? 'Submitted for admin approval.' : 'Saved as draft.');
      navigate('/customer/listings');
    } catch (err) { toast.error(errorMessage(err)); }
  });

  if (cats.loading || existing.loading) return <Loader />;
  const status = existing.data?.product?.status;
  const sp = Number(watch('sellingPrice'));

  return (
    <>
      <PageHeader title={editing ? 'Edit listing' : 'Sell a used product'} subtitle="Add photos and details — AI can suggest what to do with it, a fair price range and a description." actions={status && <StatusBadge status={status} />} />
      <form className="grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="space-y-6">
          <div className="card card-pad">
            <h2 className="mb-4 font-semibold">Photos</h2>
            <ImageUploader value={files} onChange={setFiles} existing={keptImages} onRemoveExisting={(img) => setKeptImages((k) => k.filter((x) => x.url !== img.url))} />
          </div>

          <div className="card card-pad space-y-4">
            <h2 className="font-semibold">Details</h2>
            <Field label="Title" required error={errors.title?.message}><input className="input" placeholder="e.g. Dell Inspiron 15 laptop (i5, 8GB)" {...register('title', { required: 'Title is required', minLength: { value: 4, message: 'At least 4 characters' }, maxLength: 120 })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" required error={errors.category?.message}>
                <select className="input" {...register('category', { required: 'Choose a category' })}>
                  <option value="">Select…</option>
                  {cats.data?.categories?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Brand"><input className="input" {...register('brand', { maxLength: 60 })} /></Field>
              <Field label="Condition" required><select className="input" {...register('condition')}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Age (months)" error={errors.ageMonths?.message}><input type="number" min="0" className="input" {...register('ageMonths', { min: { value: 0, message: 'Invalid' }, max: { value: 600, message: 'Too old' } })} /></Field>
              <Field label="Original price (₹)"><input type="number" min="0" className="input" {...register('originalPrice', { min: 0 })} /></Field>
              <Field label="Is it working?"><select className="input" {...register('isWorking', { setValueAs: (v) => v === true || v === 'true' })}><option value="true">Yes, works fine</option><option value="false">No / has a fault</option></select></Field>
            </div>
            <Field label="Key features" hint="Comma separated, e.g. 512GB SSD, original charger, bill available"><input className="input" {...register('features')} /></Field>
            <Field label="Description" required error={errors.description?.message} hint="Describe condition honestly — mention any faults.">
              <textarea className="input min-h-[160px]" {...register('description', { required: 'Description is required', minLength: { value: 20, message: 'At least 20 characters' }, maxLength: { value: 3000, message: 'Max 3000 characters' } })} />
            </Field>
            <button type="button" className="btn-secondary" onClick={runDescribe} disabled={aiBusy === 'desc'}>{aiBusy === 'desc' ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />} Generate description with AI</button>
          </div>

          <div className="card card-pad space-y-4">
            <h2 className="font-semibold">Location</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" required error={errors.city?.message}><input className="input" {...register('city', { required: 'City is required' })} /></Field>
              <Field label="Locality"><input className="input" {...register('locality')} /></Field>
            </div>
            <Controller control={control} name="coordinates" render={({ field }) => <MapPicker value={field.value} onChange={field.onChange} height="h-60" />} />
            <p className="text-xs text-gray-500">Buyers only see an approximate area (rounded to ~100 m).</p>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="card card-pad">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-brand-700" /> Reuse vs Recycle</h2></div>
            <p className="mt-1 text-xs text-gray-500">AI suggests the best next life for this item. You decide.</p>
            <button type="button" className="btn-secondary mt-3 w-full" onClick={runRecommend} disabled={aiBusy === 'rec'}>{aiBusy === 'rec' && <Spinner className="h-4 w-4" />} {rec ? 'Re-analyse' : 'Analyse my item'}</button>
            {rec && (
              <div className="mt-4 space-y-3">
                <div className={`rounded-xl p-3 ring-1 ${ACTION_META[rec.action].tone}`}>
                  <p className="text-xs font-semibold uppercase">Recommended</p>
                  <p className="text-lg font-bold">{ACTION_META[rec.action].label}</p>
                  <p className="text-sm">{rec.explanation || rec.reason}</p>
                </div>
                <ConfidenceBar value={rec.confidence} />
                <p className="text-xs text-gray-500">Estimated condition: <strong>{rec.estimated_condition}</strong> · Suggested category: <strong>{titleCase(rec.suggested_category)}</strong></p>
                <details className="text-xs text-gray-600"><summary className="cursor-pointer font-medium">Why? ({rec.factors.length} factors)</summary>
                  <ul className="mt-2 space-y-1">{rec.factors.map((f, i) => <li key={i}>{f.action ? <span className="font-semibold">{ACTION_META[f.action]?.label} +{f.weight}:</span> : 'ℹ'} {f.reason}</li>)}</ul>
                </details>
                {rec.limitations && <p className="text-[11px] text-gray-400">{rec.limitations}</p>}
              </div>
            )}
            {(rec || decision) && (
              <div className="mt-4">
                <p className="label">Your decision</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ACTION_META).map(([k, m]) => (
                    <button key={k} type="button" onClick={() => setDecision(k)} className={`rounded-xl border px-3 py-2 text-sm font-medium ${decision === k ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200'}`}>{m.label}</button>
                  ))}
                </div>
                {decision === 'recycle' && <Link to="/customer/book-collection" className="btn-accent mt-3 w-full"><Recycle className="h-4 w-4" /> Book a kabadiwala instead</Link>}
                {decision === 'donate' && <p className="mt-3 rounded-lg bg-violet-50 p-2.5 text-xs text-violet-800">Consider giving it to a local NGO, or list it at a token price and mention it's for someone in need.</p>}
                {decision === 'repair' && <p className="mt-3 rounded-lg bg-sky-50 p-2.5 text-xs text-sky-800">A quick repair can raise the resale price. Mention the fault clearly if you list it as-is.</p>}
              </div>
            )}
          </div>

          <div className="card card-pad">
            <h2 className="flex items-center gap-2 font-semibold"><Tag className="h-5 w-5 text-brand-700" /> Price</h2>
            <button type="button" className="btn-secondary mt-3 w-full" onClick={runPrice} disabled={aiBusy === 'price'}>{aiBusy === 'price' && <Spinner className="h-4 w-4" />} Suggest a price range</button>
            {price && (
              <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
                <p className="text-xs text-gray-500">Suggested range</p>
                <p className="text-lg font-bold">{inr(price.min)} – {inr(price.max)}</p>
                <button type="button" className="mt-1 text-xs font-semibold text-brand-700" onClick={() => setValue('sellingPrice', price.suggested, { shouldValidate: true })}>Use {inr(price.suggested)}</button>
                {price.factors?.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-gray-500">{price.factors.map((f) => <li key={f}>{f}</li>)}</ul>}
                {price.limitations && <p className="mt-2 text-[11px] text-gray-400">{price.limitations}</p>}
              </div>
            )}
            <div className="mt-4">
              <Field label="Your selling price (₹)" required error={errors.sellingPrice?.message}>
                <input type="number" min="1" className="input text-lg font-semibold" {...register('sellingPrice', { required: 'Set a price', min: { value: 1, message: 'At least ₹1' } })} />
              </Field>
              {price && sp > 0 && (sp < price.min * 0.7 || sp > price.max * 1.3) && <p className="mt-1 text-xs text-amber-700">This is far from the suggested range — that's okay, it's your call.</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button type="button" className="btn-primary py-3" onClick={save(true)} disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}{status === 'Available' ? 'Save changes' : 'Publish listing'}</button>
            {status !== 'Available' && <button type="button" className="btn-secondary" onClick={save(false)} disabled={isSubmitting}>Save as draft</button>}
          </div>
        </aside>
      </form>
    </>
  );
}
