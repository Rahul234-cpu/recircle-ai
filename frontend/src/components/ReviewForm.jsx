import { useState } from 'react';
import { MiscAPI, errorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';
import { RatingStars, Spinner } from './ui';

export default function ReviewForm({ bookingId, orderId, title = 'Rate your experience', onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { toast.error('Please choose a star rating'); return; }
    setBusy(true);
    try {
      await MiscAPI.review({ bookingId, orderId, rating, comment: comment.trim() || undefined });
      toast.success('Thanks for your review!');
      onDone?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card card-pad space-y-3">
      <p className="font-semibold">{title}</p>
      <RatingStars value={rating} onChange={setRating} size="h-7 w-7" />
      <textarea className="input min-h-[80px]" placeholder="Share a few words (optional)" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
      <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}Submit review</button>
    </form>
  );
}
