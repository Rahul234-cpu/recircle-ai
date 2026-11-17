import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, MapPin, Phone, Printer, Receipt, Scale, Star, Truck, X } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { AdminAPI, CollectorAPI, WasteAPI, errorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, ConfirmDialog, DemoBadge, Field, Modal, PageHeader, Spinner, StatusBadge } from '../../components/ui';
import StatusTimeline from '../../components/StatusTimeline';
import ReviewForm from '../../components/ReviewForm';
import { MarkersMap } from '../../components/Maps';
import { BOOKING_FLOW } from '../../utils/constants';
import { date, dateTime, inr, num } from '../../utils/format';

function ReceiptModal({ bookingId, open, onClose }) {
  const { data, loading, error } = useFetch(() => (open ? WasteAPI.receipt(bookingId) : Promise.resolve(null)), [open]);
  const r = data?.receipt;
  return (
    <Modal open={open} onClose={onClose} title="Digital receipt" size="max-w-xl" footer={<button type="button" className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</button>}>
      {loading && <Spinner />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {r && (
        <div id="receipt" className="space-y-4 text-sm">
          <div className="flex items-start justify-between">
            <div><p className="text-lg font-bold">ReCircle AI</p><p className="text-gray-500">Scrap collection receipt</p></div>
            <div className="text-right"><p className="font-semibold">{r.receiptNumber}</p><p className="text-gray-500">{dateTime(r.issuedAt)}</p>{r.isDemo && <DemoBadge />}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-canvas p-3">
            <div><p className="text-xs text-gray-400">Customer (seller)</p><p className="font-medium">{r.customer.name}</p><p className="text-xs text-gray-500">{r.pickupAddress.line1}, {r.pickupAddress.city}</p></div>
            <div><p className="text-xs text-gray-400">Collector (buyer)</p><p className="font-medium">{r.collector.businessName}</p><p className="text-xs text-gray-500">{r.collector.name}</p></div>
          </div>
          <table className="w-full text-left">
            <thead className="text-xs text-gray-400"><tr><th className="py-1">Material</th><th>Weight</th><th>Rate</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{r.lineItems.map((l) => <tr key={l.name} className="border-t border-gray-100"><td className="py-1.5">{l.name}</td><td>{num(l.weightKg)} kg</td><td>{inr(l.ratePerKg, { decimals: 2 })}/kg</td><td className="text-right">{inr(l.amount, { decimals: 2 })}</td></tr>)}</tbody>
            <tfoot><tr className="border-t-2 border-gray-200 font-semibold"><td className="py-2">Total</td><td>{num(r.totalWeightKg)} kg</td><td /><td className="text-right">{inr(r.totalAmount, { decimals: 2 })}</td></tr></tfoot>
          </table>
          <p className="text-xs text-gray-500">Booking {r.bookingRef} · Transaction {r.transactionId} · Paid via {r.paymentMethod?.toUpperCase()}</p>
        </div>
      )}
    </Modal>
  );
}

function VerifyWeightModal({ booking, open, onClose, onDone }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => booking.wasteItems.map((w) => ({ itemId: w._id, name: w.category?.name, est: w.estimatedWeightKg, rate: w.ratePerKg, weight: w.verifiedWeightKg ?? '', finalRate: w.finalRatePerKg ?? w.ratePerKg })));
  const [paymentMethod, setPaymentMethod] = useState(booking.paymentMethod || 'cash');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0) * (Number(r.finalRate) || 0), 0);
  const valid = rows.every((r) => r.weight !== '' && Number(r.weight) >= 0 && Number(r.finalRate) >= 0);

  const submit = async () => {
    setBusy(true);
    try {
      await CollectorAPI.verifyWeight(booking._id, { items: rows.map((r) => ({ itemId: r.itemId, verifiedWeightKg: Number(r.weight), finalRatePerKg: Number(r.finalRate) })), paymentMethod, collectorNotes: notes || undefined });
      toast.success('Weight recorded. Waiting for the customer to confirm.');
      onDone();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Verify weight & price" size="max-w-2xl" footer={<><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={!valid || busy} onClick={submit}>{busy && <Spinner className="h-4 w-4 text-white" />}Submit for customer confirmation</button></>}>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.itemId} className="grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-4 sm:items-end">
            <div className="col-span-2 sm:col-span-1"><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-gray-500">Est. {num(r.est)} kg @ {inr(r.rate)}</p></div>
            <Field label="Actual kg"><input type="number" min="0" step="0.01" className="input" value={r.weight} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} /></Field>
            <Field label="Rate ₹/kg"><input type="number" min="0" step="0.5" className="input" value={r.finalRate} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, finalRate: e.target.value } : x)))} /></Field>
            <p className="text-right text-sm font-semibold">{inr((Number(r.weight) || 0) * (Number(r.finalRate) || 0), { decimals: 2 })}</p>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment method"><select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank-transfer">Bank transfer</option></select></Field>
          <Field label="Notes (optional)"><input className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Glass excluded — broken" /></Field>
        </div>
        <div className="flex justify-between rounded-xl bg-brand-50 p-3 font-semibold text-brand-800"><span>Final amount to pay customer</span><span>{inr(total, { decimals: 2 })}</span></div>
      </div>
    </Modal>
  );
}

function AssignModal({ booking, open, onClose, onDone }) {
  const toast = useToast();
  const { data } = useFetch(() => (open ? AdminAPI.collectors({ status: 'approved', limit: 100 }) : Promise.resolve(null)), [open]);
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await AdminAPI.assignBooking(booking._id, sel); toast.success('Collector assigned'); onDone(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Assign a collector" footer={<button type="button" className="btn-primary" disabled={!sel || busy} onClick={submit}>Assign</button>}>
      <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Select verified collector</option>
        {data?.items?.map((c) => <option key={c._id} value={c.userId?._id}>{c.businessName} — {c.serviceAreas.map((a) => a.name).join(', ')}</option>)}
      </select>
    </Modal>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { tick } = useNotifications();
  const { data, loading, error, refetch } = useFetch(() => WasteAPI.booking(id), [id, tick]);
  const b = data?.booking;
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // { status, title, message, danger }
  const [note, setNote] = useState('');
  const [modal, setModal] = useState(null);
  const role = user.role;
  const allowed = b?.allowedActions || [];

  const doStatus = async (status, n) => {
    setBusy(status);
    try {
      await WasteAPI.updateStatus(id, { status, note: n || undefined });
      toast.success(status === 'Completed' ? 'Transaction confirmed. Receipt generated!' : `Status updated: ${status}`);
      setConfirm(null);
      setNote('');
      refetch();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };

  const accept = async () => {
    setBusy('accept');
    try { await CollectorAPI.accept(id); toast.success('Booking accepted! Customer details are now visible.'); refetch(); } catch (err) { toast.error(errorMessage(err)); refetch(); } finally { setBusy(null); }
  };
  const reject = async () => {
    setBusy('reject');
    try { await CollectorAPI.reject(id, note || undefined); toast.info('Request declined.'); navigate('/collector/requests'); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };

  const isAssignedCollector = role === 'collector' && b?.collectorId?._id === user._id;
  const pickupCoords = b?.pickupAddress?.location?.coordinates;
  const collectorCoords = b?.collectorProfile?.location?.coordinates;

  return (
    <>
      <PageHeader back={<button type="button" onClick={() => navigate(-1)} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button>} title={b ? `Pickup ${b.bookingRef}` : 'Pickup'} subtitle={b ? `${date(b.preferredDate)} · ${b.preferredTimeSlot}` : ''} actions={b && <><StatusBadge status={b.status} /><DemoBadge show={b.isDemo} /></>} />
      <AsyncView loading={loading} error={error} onRetry={refetch}>
        {b && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {/* Action bar */}
              <div className="card card-pad">
                {b.locked ? (
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-sm text-gray-600"><Lock className="h-4 w-4" /> Exact address and contact details unlock after you accept.</p>
                    {b.status === 'Pending' ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-primary" onClick={accept} disabled={!!busy}>{busy === 'accept' ? <Spinner className="h-4 w-4 text-white" /> : <Check className="h-4 w-4" />} Accept request</button>
                        <button type="button" className="btn-secondary" onClick={() => setConfirm({ reject: true })} disabled={!!busy}><X className="h-4 w-4" /> Decline</button>
                      </div>
                    ) : <p className="text-sm text-gray-500">This request is no longer open.</p>}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {allowed.includes('On The Way') && <button type="button" className="btn-primary" disabled={!!busy} onClick={() => doStatus('On The Way')}><Truck className="h-4 w-4" /> Start trip</button>}
                    {allowed.includes('Arrived') && role === 'collector' && <button type="button" className="btn-primary" disabled={!!busy} onClick={() => doStatus('Arrived')}><MapPin className="h-4 w-4" /> Mark arrived</button>}
                    {allowed.includes('Weight Verified') && <button type="button" className="btn-primary" onClick={() => setModal('verify')}><Scale className="h-4 w-4" /> Verify weight</button>}
                    {allowed.includes('Completed') && <button type="button" className="btn-primary" disabled={!!busy} onClick={() => setConfirm({ status: 'Completed', title: 'Confirm transaction?', message: `Confirm that you received ${inr(b.finalPrice, { decimals: 2 })} for ${num(b.verifiedWeight)} kg. This generates your receipt and cannot be undone.` })}><Check className="h-4 w-4" /> Confirm & complete</button>}
                    {allowed.includes('Arrived') && role === 'customer' && <button type="button" className="btn-secondary" onClick={() => setConfirm({ status: 'Arrived', title: 'Dispute verified weight?', message: 'The collector will be asked to re-weigh and re-enter the amounts.', withNote: true })}>Dispute weight</button>}
                    {role === 'admin' && b.status === 'Pending' && <button type="button" className="btn-primary" onClick={() => setModal('assign')}>Assign collector</button>}
                    {allowed.includes('Cancelled') && <button type="button" className="btn-ghost text-red-600" onClick={() => setConfirm({ status: 'Cancelled', title: 'Cancel this pickup?', message: 'The collector (if assigned) will be notified.', danger: true, withNote: true })}>Cancel booking</button>}
                    {b.status === 'Completed' && <button type="button" className="btn-secondary" onClick={() => setModal('receipt')}><Receipt className="h-4 w-4" /> View receipt</button>}
                    {!allowed.length && b.status !== 'Completed' && <p className="text-sm text-gray-500">{b.status === 'Pending' ? 'Waiting for a nearby collector to accept…' : b.status === 'Awaiting Customer Confirmation' ? 'Waiting for the customer to confirm.' : 'No actions available right now.'}</p>}
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="card card-pad">
                <h2 className="font-semibold">Materials</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="table-base">
                    <thead><tr><th>Material</th><th>Est. kg</th><th>Rate</th><th>Est. price</th>{b.verifiedWeight != null && <><th>Verified kg</th><th>Final</th></>}</tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {b.wasteItems.map((w) => (
                        <tr key={w._id}>
                          <td className="flex items-center gap-2">{w.images?.[0] && <img src={w.images[0].url} alt="" className="h-9 w-9 rounded-lg object-cover" />}{w.category?.name}{w.userOverrodeAI && <span className="badge bg-gray-100 text-gray-500">edited</span>}</td>
                          <td>{num(w.estimatedWeightKg)}</td>
                          <td>{w.ratePerKg != null ? inr(w.ratePerKg) : '—'}</td>
                          <td>{w.estimatedPrice != null ? inr(w.estimatedPrice, { decimals: 2 }) : '—'}</td>
                          {b.verifiedWeight != null && <><td className="font-semibold">{num(w.verifiedWeightKg)}</td><td className="font-semibold">{inr(w.finalPrice, { decimals: 2 })}</td></>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-canvas p-3"><p className="text-xs text-gray-500">Estimated (indicative)</p><p className="text-lg font-bold">{inr(b.estimatedPrice, { decimals: 2 })} <span className="text-sm font-normal text-gray-500">· {num(b.estimatedWeight)} kg</span></p></div>
                  <div className="rounded-xl bg-brand-50 p-3"><p className="text-xs text-brand-800">Final (verified)</p><p className="text-lg font-bold text-brand-800">{b.finalPrice != null ? <>{inr(b.finalPrice, { decimals: 2 })} <span className="text-sm font-normal">· {num(b.verifiedWeight)} kg</span></> : 'After weighing'}</p></div>
                </div>
                {b.customerNotes && <p className="mt-3 text-sm text-gray-600"><strong>Customer note:</strong> {b.customerNotes}</p>}
                {b.collectorNotes && <p className="mt-1 text-sm text-gray-600"><strong>Collector note:</strong> {b.collectorNotes}</p>}
              </div>

              {/* Map */}
              {!b.locked && pickupCoords && (
                <div className="card card-pad">
                  <h2 className="mb-3 font-semibold">Location</h2>
                  <MarkersMap
                    height="h-72"
                    center={pickupCoords}
                    markers={[
                      { id: 'pickup', position: pickupCoords, popup: 'Pickup address', highlight: true },
                      ...(collectorCoords && b.collectorId ? [{ id: 'collector', position: collectorCoords, popup: `${b.collectorProfile.businessName} (base)` }] : []),
                    ]}
                  />
                  {role === 'collector' && <a className="btn-secondary mt-3" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?to=${pickupCoords[1]},${pickupCoords[0]}`}>Open directions</a>}
                </div>
              )}

              {b.status === 'Completed' && role === 'customer' && !b.customerRated && <ReviewForm bookingId={b._id} title="Rate your collector" onDone={refetch} />}
              {b.status === 'Completed' && isAssignedCollector && !b.collectorRated && <ReviewForm bookingId={b._id} title="Rate this customer" onDone={refetch} />}
            </div>

            <aside className="space-y-6">
              <div className="card card-pad space-y-3 text-sm">
                <h2 className="font-semibold">Pickup address</h2>
                {b.locked ? <p className="text-gray-600">{b.pickupAddress.locality}, {b.pickupAddress.city} {b.pickupAddress.pincode}<br /><span className="text-xs text-gray-400">≈ {b.approxDistanceKm} km from you</span></p> : (
                  <>
                    <p className="text-gray-700">{b.pickupAddress.line1}<br />{b.pickupAddress.locality}{b.pickupAddress.locality && ', '}{b.pickupAddress.city} {b.pickupAddress.pincode}</p>
                    {role !== 'customer' && b.pickupAddress.contactPhone && <a href={`tel:${b.pickupAddress.contactPhone}`} className="flex items-center gap-2 font-medium text-brand-700"><Phone className="h-4 w-4" /> {b.pickupAddress.contactName} · {b.pickupAddress.contactPhone}</a>}
                  </>
                )}
              </div>
              {b.collectorProfile && !b.locked && (
                <div className="card card-pad text-sm">
                  <h2 className="font-semibold">Collector</h2>
                  <p className="mt-2 font-medium">{b.collectorProfile.businessName}</p>
                  <p className="text-gray-500">{b.collectorId?.name} · {b.collectorProfile.vehicleType}</p>
                  <p className="mt-1 flex items-center gap-1 text-gray-600"><Star className="h-4 w-4 fill-accent-400 text-accent-400" /> {b.collectorProfile.averageRating?.toFixed(1) || 'New'} ({b.collectorProfile.ratingCount || 0}) · {b.collectorProfile.completedCollections} pickups</p>
                  {role === 'customer' && b.collectorId?.phone && ['Accepted', 'Collector Assigned', 'On The Way', 'Arrived'].includes(b.status) && <a href={`tel:${b.collectorId.phone}`} className="mt-2 flex items-center gap-2 font-medium text-brand-700"><Phone className="h-4 w-4" /> Call collector</a>}
                </div>
              )}
              <div className="card card-pad">
                <h2 className="mb-4 font-semibold">Status</h2>
                <StatusTimeline history={b.statusHistory || []} flow={BOOKING_FLOW} current={b.status} />
                {b.cancellationReason && <p className="mt-3 text-xs text-gray-500">Reason: {b.cancellationReason}</p>}
              </div>
              {role === 'customer' && <Link to="/customer/complaints" className="block text-center text-xs text-gray-500 hover:text-brand-700">Problem with this pickup? Raise a complaint</Link>}
            </aside>
          </div>
        )}
      </AsyncView>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => { setConfirm(null); setNote(''); }}
        title={confirm?.reject ? 'Decline this request?' : confirm?.title}
        message={confirm?.reject ? 'It will be offered to other collectors.' : confirm?.message}
        danger={confirm?.danger || confirm?.reject}
        busy={!!busy}
        confirmLabel={confirm?.reject ? 'Decline' : 'Confirm'}
        onConfirm={() => (confirm?.reject ? reject() : doStatus(confirm.status, note))}
      >
        {(confirm?.withNote || confirm?.reject) && <textarea className="input mt-3" placeholder="Reason (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
      </ConfirmDialog>
      {b && modal === 'verify' && <VerifyWeightModal booking={b} open onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
      {b && modal === 'assign' && <AssignModal booking={b} open onClose={() => setModal(null)} onDone={() => { setModal(null); refetch(); }} />}
      {b && <ReceiptModal bookingId={b._id} open={modal === 'receipt'} onClose={() => setModal(null)} />}
    </>
  );
}
