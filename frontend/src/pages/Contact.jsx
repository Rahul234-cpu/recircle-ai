import { useForm } from 'react-hook-form';
import { Mail, MapPin, MessageCircle } from 'lucide-react';
import { Field, Spinner } from '../components/ui';
import { MiscAPI, errorMessage } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function Contact() {
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const onSubmit = async (v) => {
    try {
      const res = await MiscAPI.contact(v);
      toast.success(res.message);
      reset();
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Contact us</p>
        <h1 className="mt-2 text-4xl font-extrabold">We'd love to hear from you</h1>
        <p className="mt-4 text-gray-600">Questions about a pickup, a listing or partnering with us? Send a message and our team will reply within 1–2 working days.</p>
        <div className="mt-8 space-y-4 text-sm">
          <p className="flex items-center gap-3"><Mail className="h-5 w-5 text-brand-700" /> support@recircle.local</p>
          <p className="flex items-center gap-3"><MapPin className="h-5 w-5 text-brand-700" /> Bengaluru, Karnataka</p>
          <p className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-brand-700" /> Instant answers: use the chat assistant (bottom right)</p>
        </div>
        <p className="mt-6 text-sm text-gray-500">Logged-in users can also raise a tracked complaint from their dashboard.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="card card-pad space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message}><input className="input" {...register('name', { required: 'Required', minLength: { value: 2, message: 'Too short' } })} /></Field>
          <Field label="Email" error={errors.email?.message}><input type="email" className="input" {...register('email', { required: 'Required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })} /></Field>
        </div>
        <Field label="Subject" error={errors.subject?.message}><input className="input" {...register('subject', { required: 'Required', minLength: { value: 3, message: 'Too short' } })} /></Field>
        <Field label="Message" error={errors.message?.message}><textarea className="input min-h-[140px]" {...register('message', { required: 'Required', minLength: { value: 10, message: 'At least 10 characters' }, maxLength: 2000 })} /></Field>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Send message</button>
      </form>
    </div>
  );
}
