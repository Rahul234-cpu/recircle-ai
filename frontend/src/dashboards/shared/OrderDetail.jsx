import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, MessageSquare, PackageCheck, X } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { MiscAPI, OrderAPI, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, Avatar, ConfirmDialog, DemoBadge, Field, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import StatusTimeline from '../../components/StatusTimeline';
import ReviewForm from '../../components/ReviewForm';
import { ORDER_FLOW } from '../../utils/constants';
import { inr, timeAgo } from '../../utils/format';

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { tick } = useNotifications();
  const { data, loading, error, refetch } = useFetch(() => OrderAPI.get(id), [id, tick]);
  const o = data?.order;
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const allowed = o?.allowedActions || [];

  const act = async (status) => {
    setBusy(true);
    try {
      await OrderAPI.updateStatus(id, { status, note: note || undefined, agreedPrice: status === 'Accepted' && agreed ? Number(agreed) : undefined, handoverNote: status === 'Completed' ? note || undefined : undefined });
      toast.success(`Order ${status.toLowerCase()}`);
      setDialog(null); setNote(''); refetch();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const payOnline = async () => {
    setBusy(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Could not load Razorpay checkout');
      const p = await OrderAPI.pay(id);
      const rzp = new window.Razorpay({
        key: p.keyId, amount: p.amount, currency: p.currency, order_id: p.razorpayOrderId, name: 'ReCircle AI', description: o.product.title,
        prefill: { name: user.name, email: user.email },
        theme: { color: '#15803D' },
        handler: async (resp) => {
          try {
            await OrderAPI.verifyPayment(id, { razorpayOrderId: resp.razorpay_order_id, razorpayPaymentId: resp.razorpay_payment_id, razorpaySignature: resp.razorpay_signature });
            toast.success('Payment verified!');
            refetch();
          } catch (err) { toast.error(errorMessage(err)); }
        },
      });
      rzp.open();
    } catch (err) { toast.error(errorMessage(err, err.message)); } finally { setBusy(false); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    const other = o.myRole === 'seller' ? o.buyer : o.seller;
    try {
      const { message } = await MiscAPI.sendMessage({ productId: o.product._id, recipientId: other._id, body: msg.trim() });
      setMsg('');
      navigate(`/${user.role}/messages?c=${encodeURIComponent(message.conversationKey)}`);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <>
      <PageHeader back={<button type="button" onClick={() => navigate(-1)} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>} title={o ? `Order ${o.orderRef}` : 'Order'} actions={o && <><StatusBadge status={o.status} /><DemoBadge show={o.isDemo} /></>} />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {o && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div className="card flex gap-4 p-4">
                <img src={o.product.images?.[0]?.url} alt="" className="h-24 w-24 rounded-xl bg-brand-50 object-cover" />
                <div className="min-w-0">
                  <Link to={`/products/${o.product._id}`} className="font-semibold hover:text-brand-700">{o.product.title}</Link>
                  <p className="text-sm text-gray-500">Listed at {inr(o.product.sellingPrice)} · {o.product.condition}</p>
                  <p className="mt-2 text-lg font-bold">{o.agreedPrice ? `Agreed ${inr(o.agreedPrice)}` : `Offer ${inr(o.offeredPrice)}`}</p>
                  <p className="text-xs text-gray-500">Payment: {o.paymentMethod === 'razorpay' ? 'Online (Razorpay test)' : `${o.paymentMethod.toUpperCase()} on handover`} · <span className={o.paymentStatus === 'paid' ? 'font-semibold text-brand-700' : ''}>{o.paymentStatus}</span></p>
                </div>
              </div>

              {o.message && <div className="card card-pad text-sm"><p className="text-xs text-gray-400">Buyer's message</p><p className="mt-1">{o.message}</p></div>}

              <div className="card card-pad">
                <div className="flex flex-wrap gap-2">
                  {allowed.includes('Accepted') && <button type="button" className="btn-primary" onClick={() => { setAgreed(String(o.offeredPrice)); setDialog('Accepted'); }}><Check className="h-4 w-4" /> Accept request</button>}
                  {allowed.includes('Rejected') && <button type="button" className="btn-secondary" onClick={() => setDialog('Rejected')}><X className="h-4 w-4" /> Decline</button>}
                  {allowed.includes('Completed') && <button type="button" className="btn-primary" onClick={() => setDialog('Completed')} disabled={o.paymentMethod === 'razorpay' && o.paymentStatus !== 'paid'}><PackageCheck className="h-4 w-4" /> Confirm handover</button>}
                  {o.myRole === 'buyer' && o.status === 'Accepted' && o.paymentMethod === 'razorpay' && o.paymentStatus !== 'paid' && <button type="button" className="btn-accent" onClick={payOnline} disabled={busy}><CreditCard className="h-4 w-4" /> Pay online</button>}
                  {allowed.includes('Cancelled') && <button type="button" className="btn-ghost text-red-600" onClick={() => setDialog('Cancelled')}>Cancel order</button>}
                  {!allowed.length && <p className="text-sm text-gray-500">{o.status === 'Requested' ? 'Waiting for the seller to respond.' : o.status === 'Accepted' ? 'Arrange the handover; the seller confirms it once done.' : 'This order is closed.'}</p>}
                </div>
                {o.status === 'Accepted' && <p className="mt-3 text-xs text-gray-500">The item is reserved for this buyer. The order completes only when the seller confirms the handover.</p>}
                {o.paymentMethod === 'razorpay' && o.paymentStatus !== 'paid' && o.myRole === 'seller' && o.status === 'Accepted' && <p className="mt-2 text-xs text-amber-700">Waiting for the buyer's online payment before you can confirm the handover.</p>}
              </div>

              {o.myRole !== 'admin' && ['Requested', 'Accepted'].includes(o.status) && (
                <form onSubmit={sendMessage} className="card card-pad flex gap-2">
                  <input className="input" placeholder={`Message ${o.myRole === 'seller' ? o.buyer.name : o.seller.name}…`} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} />
                  <button type="submit" className="btn-primary"><MessageSquare className="h-4 w-4" /> Send</button>
                </form>
              )}

              {o.status === 'Completed' && o.myRole === 'buyer' && !o.buyerRated && <ReviewForm orderId={o._id} title={`Rate ${o.seller.name}`} onDone={refetch} />}
            </div>

            <aside className="space-y-6">
              <div className="card card-pad space-y-4 text-sm">
                {[['Buyer', o.buyer], ['Seller', o.seller]].map(([label, u]) => (
                  <div key={label} className="flex items-center gap-3"><Avatar name={u.name} src={u.profileImage} /><div><p className="text-xs text-gray-400">{label}</p><p className="font-medium">{u.name}{u._id === user._id && ' (you)'}</p></div></div>
                ))}
              </div>
              <div className="card card-pad">
                <h2 className="mb-4 font-semibold">Status</h2>
                <StatusTimeline history={o.statusHistory} flow={ORDER_FLOW} current={o.status} />
                <p className="mt-3 text-xs text-gray-400">Created {timeAgo(o.createdAt)}</p>
              </div>
            </aside>
          </div>
        )}
      </AsyncView>

      <ConfirmDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        onConfirm={() => act(dialog)}
        busy={busy}
        danger={dialog === 'Cancelled' || dialog === 'Rejected'}
        title={{ Accepted: 'Accept this request?', Rejected: 'Decline this request?', Completed: 'Confirm handover?', Cancelled: 'Cancel this order?' }[dialog]}
        message={{ Accepted: 'The product will be reserved for this buyer.', Rejected: 'The buyer will be notified.', Completed: 'Confirm that the buyer has received the item and you have been paid. This marks the product as sold.', Cancelled: 'The product will become available again.' }[dialog]}
      >
        {dialog === 'Accepted' && <div className="mt-3"><Field label="Agreed price (₹)"><input type="number" min="1" className="input" value={agreed} onChange={(e) => setAgreed(e.target.value)} /></Field></div>}
        {dialog && dialog !== 'Accepted' && <textarea className="input mt-3" maxLength={300} placeholder={dialog === 'Completed' ? 'Handover note (optional)' : 'Reason (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />}
      </ConfirmDialog>
      {busy && <span className="sr-only"><Spinner /></span>}
    </>
  );
}
