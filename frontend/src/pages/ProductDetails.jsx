import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Calendar, Eye, Heart, MapPin, MessageSquare, ShieldCheck, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import useFetch from '../hooks/useFetch';
import { MiscAPI, OrderAPI, ProductAPI, errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AsyncView, Avatar, DemoBadge, Field, Modal, RatingStars, Spinner, StatusBadge } from '../components/ui';
import { MarkersMap } from '../components/Maps';
import ProductCard from '../components/ProductCard';
import { date, inr, timeAgo, titleCase } from '../utils/format';
import { ACTION_META } from '../utils/constants';

export default function ProductDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, refetch, setData } = useFetch(() => ProductAPI.get(id), [id]);
  const [active, setActive] = useState(0);
  const [buyOpen, setBuyOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const p = data?.product;
  const reviews = useFetch(() => (p ? MiscAPI.reviewsFor(p.sellerId._id, { limit: 5 }) : Promise.resolve(null)), [p?.sellerId?._id]);
  const payCfg = useFetch(() => (user ? OrderAPI.paymentConfig() : Promise.resolve({ enabled: false })), [user?._id]);

  const requireLogin = () => { navigate('/login', { state: { from: `/products/${id}` } }); };
  const canBuy = user && ['customer', 'buyer'].includes(user.role) && !data?.isOwner && p?.status === 'Available';

  const toggleFav = async () => {
    if (!user) return requireLogin();
    try {
      const r = await MiscAPI.toggleFavourite(id);
      setData((d) => ({ ...d, isFavourite: r.isFavourite }));
    } catch (err) { toast.error(errorMessage(err)); }
    return null;
  };

  const buyForm = useForm({ defaultValues: { offeredPrice: '', message: '', paymentMethod: 'cash' } });
  const submitBuy = async (v) => {
    try {
      const { order } = await OrderAPI.create({ productId: id, offeredPrice: v.offeredPrice ? Number(v.offeredPrice) : undefined, message: v.message || undefined, paymentMethod: v.paymentMethod });
      toast.success('Purchase request sent to the seller.');
      setBuyOpen(false);
      navigate(`/${user.role}/orders/${order._id}`);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  const msgForm = useForm({ defaultValues: { body: '' } });
  const submitMsg = async ({ body }) => {
    try {
      const { message } = await MiscAPI.sendMessage({ productId: id, recipientId: p.sellerId._id, body });
      toast.success(message.wasMasked ? 'Message sent. Contact details are hidden until the seller accepts an order.' : 'Message sent.');
      setMsgOpen(false);
      navigate(`/${user.role}/messages?c=${encodeURIComponent(message.conversationKey)}`);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="container-page py-8">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {p && (
          <>
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="card aspect-[4/3] overflow-hidden bg-brand-50 p-0">
                  {p.images?.[active] && <img src={p.images[active].url} alt={p.title} className="h-full w-full object-contain" />}
                </div>
                {p.images?.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {p.images.map((img, i) => (
                      <button key={img.url} type="button" onClick={() => setActive(i)} className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${i === active ? 'border-brand-600' : 'border-transparent'}`}><img src={img.url} alt="" className="h-full w-full object-cover" /></button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={p.status} />
                    <span className="badge bg-gray-100 text-gray-700">{titleCase(p.category)}</span>
                    <DemoBadge show={p.isDemo} />
                  </div>
                  <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{p.title}</h1>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold">{inr(p.sellingPrice)}</span>
                    {p.originalPrice > p.sellingPrice && <span className="text-gray-400 line-through">{inr(p.originalPrice)}</span>}
                  </div>
                  {p.AIRecommendedPrice?.min && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600"><Sparkles className="h-4 w-4 text-brand-600" /> AI suggested range: {inr(p.AIRecommendedPrice.min)} – {inr(p.AIRecommendedPrice.max)}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[[Tag, 'Condition', p.condition], [Tag, 'Brand', p.brand || '—'], [Calendar, 'Age', p.ageMonths != null ? `${p.ageMonths} months` : '—'], [Eye, 'Views', p.views]].map(([Icon, k, v]) => (
                    <div key={k} className="rounded-xl bg-white p-3 ring-1 ring-gray-100"><p className="flex items-center gap-1 text-xs text-gray-400"><Icon className="h-3.5 w-3.5" />{k}</p><p className="mt-0.5 font-semibold">{v}</p></div>
                  ))}
                </div>

                {p.aiRecommendation?.action && (
                  <div className={`rounded-xl p-3 text-sm ring-1 ${ACTION_META[p.aiRecommendation.action]?.tone}`}>
                    <strong>AI assessment: {ACTION_META[p.aiRecommendation.action]?.label}</strong>{p.aiRecommendation.reason ? ` — ${p.aiRecommendation.reason}` : ''}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {data.isOwner ? (
                    <Link to={`/customer/sell-product/${p._id}`} className="btn-primary">Edit listing</Link>
                  ) : data.myActiveOrder ? (
                    <Link to={`/${user.role}/orders/${data.myActiveOrder._id}`} className="btn-primary"><ShoppingBag className="h-4 w-4" /> View your request ({data.myActiveOrder.status})</Link>
                  ) : (
                    <button type="button" className="btn-primary" disabled={user && !canBuy} onClick={() => (user ? setBuyOpen(true) : requireLogin())}>
                      <ShoppingBag className="h-4 w-4" /> {p.status === 'Available' ? 'Request to buy' : `Currently ${p.status.toLowerCase()}`}
                    </button>
                  )}
                  {!data.isOwner && (
                    <button type="button" className="btn-secondary" onClick={() => (user ? setMsgOpen(true) : requireLogin())} disabled={user?.role === 'collector'}><MessageSquare className="h-4 w-4" /> Message seller</button>
                  )}
                  <button type="button" className="btn-secondary" onClick={toggleFav} aria-label="Favourite"><Heart className={`h-4 w-4 ${data.isFavourite ? 'fill-red-500 text-red-500' : ''}`} /></button>
                </div>
                {user?.role === 'collector' && <p className="text-xs text-gray-500">Collector accounts cannot buy products. Use a customer or buyer account.</p>}

                <div className="card card-pad flex items-center gap-4">
                  <Avatar name={p.sellerId.name} src={p.sellerId.profileImage} size="h-12 w-12" />
                  <div className="flex-1">
                    <p className="font-semibold">{p.sellerId.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500"><RatingStars value={p.sellerId.sellerRating?.average} size="h-3.5 w-3.5" /> {p.sellerId.sellerRating?.count || 0} reviews · member since {date(p.sellerId.createdAt)}</div>
                  </div>
                </div>
                <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Inspect items before paying. Phone numbers stay hidden in chat until the seller accepts your request.</p>
              </div>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="card card-pad">
                <h2 className="text-lg font-semibold">Description</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">{p.description}</p>
                {p.features?.length > 0 && (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">{p.features.map((f) => <li key={f} className="rounded-lg bg-canvas px-3 py-2 text-sm">✓ {f}</li>)}</ul>
                )}
                <p className="mt-4 text-xs text-gray-400">Listed {timeAgo(p.createdAt)}</p>
              </div>
              <div className="space-y-4">
                <div className="card card-pad">
                  <h2 className="flex items-center gap-1.5 text-lg font-semibold"><MapPin className="h-5 w-5" /> {[p.locationLabel?.locality, p.locationLabel?.city].filter(Boolean).join(', ')}</h2>
                  <p className="mb-3 text-xs text-gray-500">Approximate area — exact pickup point is shared in chat.</p>
                  <MarkersMap height="h-56" center={p.location.coordinates} zoom={13} circle={{ center: p.location.coordinates, radiusKm: 0.6 }} markers={[]} />
                </div>
                <div className="card card-pad">
                  <h2 className="text-lg font-semibold">Seller reviews</h2>
                  {reviews.data?.items?.length ? (
                    <ul className="mt-3 space-y-3">
                      {reviews.data.items.map((r) => (
                        <li key={r._id} className="border-b border-gray-50 pb-3 last:border-0">
                          <div className="flex items-center justify-between"><span className="text-sm font-medium">{r.reviewer?.name}</span><RatingStars value={r.rating} size="h-3.5 w-3.5" /></div>
                          {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-sm text-gray-500">No reviews yet.</p>}
                </div>
              </div>
            </div>

            {data.similar?.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold">Similar items</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.similar.map((s) => <ProductCard key={s._id} product={s} />)}</div>
              </div>
            )}

            <Modal open={buyOpen} onClose={() => setBuyOpen(false)} title="Request to buy">
              <form id="buy-form" onSubmit={buyForm.handleSubmit(submitBuy)} className="space-y-4">
                <p className="text-sm text-gray-600">The seller will review your request. The order is only completed after the seller accepts and confirms the handover.</p>
                <Field label="Your offer (₹)" hint={`Listed at ${inr(p.sellingPrice)}. Leave blank to offer the listed price.`} error={buyForm.formState.errors.offeredPrice?.message}>
                  <input type="number" className="input" placeholder={String(p.sellingPrice)} {...buyForm.register('offeredPrice', { min: { value: 1, message: 'Offer must be at least ₹1' } })} />
                </Field>
                <Field label="Message to seller" error={buyForm.formState.errors.message?.message}>
                  <textarea className="input min-h-[80px]" maxLength={500} placeholder="When can I see it?" {...buyForm.register('message', { maxLength: { value: 500, message: 'Max 500 characters' } })} />
                </Field>
                <Field label="Payment method">
                  <select className="input" {...buyForm.register('paymentMethod')}>
                    <option value="cash">Cash on handover</option>
                    <option value="upi">UPI on handover</option>
                    {payCfg.data?.enabled && <option value="razorpay">Pay online (Razorpay test mode)</option>}
                  </select>
                </Field>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setBuyOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={buyForm.formState.isSubmitting}>{buyForm.formState.isSubmitting && <Spinner className="h-4 w-4 text-white" />}Send request</button>
                </div>
              </form>
            </Modal>

            <Modal open={msgOpen} onClose={() => setMsgOpen(false)} title={`Message ${p.sellerId.name}`}>
              <form onSubmit={msgForm.handleSubmit(submitMsg)} className="space-y-4">
                <Field error={msgForm.formState.errors.body?.message}>
                  <textarea className="input min-h-[110px]" maxLength={1000} placeholder="Hi! Is this still available?" {...msgForm.register('body', { required: 'Write a message', maxLength: 1000 })} />
                </Field>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setMsgOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={msgForm.formState.isSubmitting}>Send</button>
                </div>
              </form>
            </Modal>
          </>
        )}
      </AsyncView>
    </div>
  );
}
