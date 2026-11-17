import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Recycle, ShoppingBag } from 'lucide-react';
import Logo from '../components/Logo';
import { Field, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../services/api';
import { ROLE_HOME } from '../utils/constants';

const DEMO = [
  ['Customer', 'priya@demo.recircle.ai', 'Demo@1234'],
  ['EcoPartner', 'ramesh@demo.recircle.ai', 'Demo@1234'],
  ['Buyer', 'arjun@demo.recircle.ai', 'Demo@1234'],
  ['Admin', 'admin@recircle.ai', 'Admin@1234'],
];

function AuthShell({ title, subtitle, children, aside }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="hidden items-center justify-center bg-brand-700 p-12 text-white lg:flex">{aside}</div>
    </div>
  );
}

const emailRule = { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' } };

function PasswordInput({ register, error, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} className={`input pr-10 ${error ? 'input-error' : ''}`} {...register} {...rest} />
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async ({ email, password }) => {
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to manage pickups, listings and orders."
      aside={(
        <div className="max-w-md">
          <Recycle className="h-10 w-10 text-accent-400" />
          <h2 className="mt-6 text-3xl font-bold text-white">Give Waste a Value. Give Products a Second Life.</h2>
          <p className="mt-4 text-brand-50">Every pickup is weighed in front of you. Every listing gets an AI-assisted price. Every completed transaction earns eco-points.</p>
        </div>
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}><input type="email" autoComplete="email" className={`input ${errors.email ? 'input-error' : ''}`} {...register('email', emailRule)} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="current-password" error={errors.password} register={register('password', { required: 'Password is required' })} /></Field>
        <button type="submit" className="btn-primary w-full py-3" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Log in</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">New here? <Link to="/register" className="font-semibold text-brand-700">Create an account</Link> · <Link to="/become-ecopartner" className="font-semibold text-brand-700">Join as an EcoPartner</Link></p>

      {import.meta.env.DEV && (
        <div className="mt-8 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Demo accounts (local development only)</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DEMO.map(([label, email, pw]) => (
              <button key={email} type="button" className="btn-secondary btn-sm" onClick={() => { setValue('email', email); setValue('password', pw); }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}

export function Register() {
  const { register: signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({ defaultValues: { role: 'customer' } });
  const role = watch('role');

  const onSubmit = async ({ confirm, ...body }) => {
    try {
      const user = await signUp({ ...body, phone: body.phone || undefined });
      toast.success('Account created! 🎉');
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const RoleCard = ({ value, icon: Icon, title, text }) => (
    <button type="button" onClick={() => setValue('role', value)} className={`rounded-xl border-2 p-4 text-left transition ${role === value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
      <Icon className="h-5 w-5 text-brand-700" /><p className="mt-2 text-sm font-semibold">{title}</p><p className="text-xs text-gray-500">{text}</p>
    </button>
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join ReCircle AI in under a minute."
      aside={(
        <div className="max-w-md space-y-6">
          {[['Doorstep pickups', 'Book verified EcoPartners at a time that suits you.'], ['Fair, transparent rates', 'See per-kg rates upfront and confirm the final weight.'], ['A trusted marketplace', 'Buy and sell pre-loved items with privacy-safe chat.']].map(([t, d]) => (
            <div key={t}><p className="text-lg font-semibold text-white">✓ {t}</p><p className="text-brand-50">{d}</p></div>
          ))}
        </div>
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <RoleCard value="customer" icon={Recycle} title="Customer" text="Sell waste, list products and buy" />
          <RoleCard value="buyer" icon={ShoppingBag} title="Buyer" text="Browse and buy second-hand" />
        </div>
        <input type="hidden" {...register('role')} />
        <Field label="Full name" error={errors.name?.message}><input className={`input ${errors.name ? 'input-error' : ''}`} autoComplete="name" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} /></Field>
        <Field label="Email" error={errors.email?.message}><input type="email" className={`input ${errors.email ? 'input-error' : ''}`} autoComplete="email" {...register('email', emailRule)} /></Field>
        <Field label="Mobile number" hint="Optional · shared only with your assigned collector" error={errors.phone?.message}>
          <input className={`input ${errors.phone ? 'input-error' : ''}`} inputMode="numeric" placeholder="98765 43210" {...register('phone', { pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit mobile number' }, setValueAs: (v) => v.replace(/\s/g, '') })} />
        </Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" error={errors.password} register={register('password', { required: 'Password is required', minLength: { value: 8, message: 'At least 8 characters' }, validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Include a letter and a number' })} />
        </Field>
        <Field label="Confirm password" error={errors.confirm?.message}>
          <input type="password" className={`input ${errors.confirm ? 'input-error' : ''}`} autoComplete="new-password" {...register('confirm', { validate: (v) => v === watch('password') || 'Passwords do not match' })} />
        </Field>
        <button type="submit" className="btn-primary w-full py-3" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Create account</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">Already have an account? <Link to="/login" className="font-semibold text-brand-700">Log in</Link></p>
    </AuthShell>
  );
}
