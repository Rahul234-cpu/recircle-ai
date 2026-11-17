import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { BadgeCheck, IndianRupee, MapPinned, Plus, Star, Trash2, Truck } from 'lucide-react';
import { MapPicker } from '../components/Maps';
import { Field, Spinner } from '../components/ui';
import { CollectorAPI, WasteAPI, errorMessage, toFormData } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useFetch from '../hooks/useFetch';
import { TIME_SLOTS, WEEKDAYS } from '../utils/constants';

function Section({ n, title, children }) {
  return (
    <div className="card card-pad">
      <p className="mb-4 flex items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs text-white">{n}</span>{title}</p>
      {children}
    </div>
  );
}

function CheckGroup({ control, name, options }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-wrap gap-2">
          {options.map(([val, label]) => {
            const on = field.value.includes(val);
            return <button key={val} type="button" onClick={() => field.onChange(on ? field.value.filter((x) => x !== val) : [...field.value, val])} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600'}`}>{label}</button>;
          })}
        </div>
      )}
    />
  );
}

export default function BecomeKabadiwala() {
  const { user, startSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const cats = useFetch(() => WasteAPI.categories(), []);
  const [idFile, setIdFile] = useState(null);
  const [areas, setAreas] = useState([{ name: '', pincode: '' }]);
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      vehicleType: 'cycle-cart', idProofType: 'aadhaar', serviceRadiusKm: 8, dailyCapacity: 6,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], timeSlots: ['10:00-12:00', '14:00-16:00'], acceptedMaterials: [], coordinates: null,
    },
  });
  const radius = Number(watch('serviceRadiusKm')) || 8;

  const onSubmit = async (v) => {
    const cleanAreas = areas.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), ...(a.pincode ? { pincode: a.pincode.trim() } : {}) }));
    if (!cleanAreas.length) { toast.error('Add at least one service area'); return; }
    if (!v.coordinates) { toast.error('Pick your base location on the map'); return; }
    if (!v.days.length || !v.timeSlots.length) { toast.error('Choose at least one working day and time slot'); return; }
    try {
      const fd = toFormData({
        name: v.name, email: v.email, phone: v.phone, password: v.password, businessName: v.businessName, address: v.address,
        vehicleType: v.vehicleType, idProofType: v.idProofType, idProofNumber: v.idProofNumber,
        serviceAreas: cleanAreas, coordinates: v.coordinates, serviceRadiusKm: v.serviceRadiusKm,
        availability: { days: v.days, timeSlots: v.timeSlots, dailyCapacity: Number(v.dailyCapacity) },
        acceptedMaterials: v.acceptedMaterials,
      }, { idProofImage: idFile });
      const res = await CollectorAPI.register(fd);
      startSession(res.token, res.user);
      toast.success('Application submitted! We will verify your details shortly.');
      navigate('/collector', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50/70 to-canvas">
        <div className="container-page py-14 sm:py-16">
          <p className="eyebrow">Become a kabadiwala</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold sm:text-5xl">More pickups from your own neighbourhood</h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {[[MapPinned, 'Nearby requests only', 'Matched by your service radius'], [Truck, 'Materials upfront', 'Know what to bring before you go'], [IndianRupee, 'Earnings dashboard', 'Track kg, payouts and margins'], [Star, 'Build reputation', 'Verified reviews after each pickup']].map(([Icon, t, d]) => (
              <div key={t} className="card card-pad"><Icon className="h-5 w-5 text-brand-700" /><p className="mt-2 text-sm font-semibold">{t}</p><p className="text-xs text-gray-500">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section pt-4">
        <div className="container-page max-w-4xl">
          {user ? (
            <div className="card card-pad text-center">
              <BadgeCheck className="mx-auto h-8 w-8 text-brand-700" />
              <p className="mt-3 font-semibold">You're logged in as {user.name} ({user.role}).</p>
              <p className="mt-1 text-sm text-gray-500">Collector accounts are separate. Log out first to register a kabadiwala account.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <Section n={1} title="Your account">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" required error={errors.name?.message}><input className="input" {...register('name', { required: 'Required', minLength: { value: 2, message: 'Too short' } })} /></Field>
                  <Field label="Mobile number" required error={errors.phone?.message}><input className="input" inputMode="numeric" {...register('phone', { required: 'Required', pattern: { value: /^[6-9]\d{9}$/, message: '10-digit mobile number' } })} /></Field>
                  <Field label="Email" required error={errors.email?.message}><input type="email" className="input" {...register('email', { required: 'Required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })} /></Field>
                  <Field label="Password" required error={errors.password?.message}><input type="password" className="input" {...register('password', { required: 'Required', minLength: { value: 8, message: 'At least 8 characters' }, validate: (x) => (/[A-Za-z]/.test(x) && /\d/.test(x)) || 'Include a letter and a number' })} /></Field>
                </div>
              </Section>

              <Section n={2} title="Business & verification">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Business name" required error={errors.businessName?.message}><input className="input" placeholder="e.g. Ramesh Kabadi Services" {...register('businessName', { required: 'Required' })} /></Field>
                  <Field label="Vehicle"><select className="input" {...register('vehicleType')}><option value="cycle-cart">Cycle cart</option><option value="two-wheeler">Two-wheeler</option><option value="auto">Auto / tempo</option><option value="mini-truck">Mini-truck</option><option value="other">Other</option></select></Field>
                  <Field label="ID proof type"><select className="input" {...register('idProofType')}><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="voter-id">Voter ID</option><option value="driving-licence">Driving licence</option><option value="other">Other</option></select></Field>
                  <Field label="ID number" required hint="Only the last 4 characters are stored" error={errors.idProofNumber?.message}><input className="input" {...register('idProofNumber', { required: 'Required', minLength: { value: 4, message: 'Too short' }, pattern: { value: /^[A-Za-z0-9 ]+$/, message: 'Letters and digits only' } })} /></Field>
                  <Field label="ID proof photo" hint="JPG/PNG/WebP, max 5 MB — viewed only by admins">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
                  </Field>
                  <Field label="Shop / base address"><input className="input" {...register('address')} /></Field>
                </div>
              </Section>

              <Section n={3} title="Service area">
                <Controller control={control} name="coordinates" render={({ field }) => <MapPicker value={field.value} onChange={field.onChange} radiusKm={radius} />} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label={`Service radius: ${radius} km`}><input type="range" min="1" max="25" className="w-full accent-brand-700" {...register('serviceRadiusKm')} /></Field>
                </div>
                <p className="label mt-4">Localities you serve</p>
                <div className="space-y-2">
                  {areas.map((a, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="flex gap-2">
                      <input className="input" placeholder="Locality (e.g. Indiranagar)" value={a.name} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <input className="input w-32" placeholder="Pincode" inputMode="numeric" maxLength={6} value={a.pincode} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, pincode: e.target.value.replace(/\D/g, '') } : x)))} />
                      {areas.length > 1 && <button type="button" className="btn-ghost px-2" onClick={() => setAreas(areas.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  ))}
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setAreas([...areas, { name: '', pincode: '' }])}><Plus className="h-4 w-4" /> Add locality</button>
                </div>
              </Section>

              <Section n={4} title="Availability & materials">
                <p className="label">Working days</p><CheckGroup control={control} name="days" options={WEEKDAYS} />
                <p className="label mt-4">Time slots</p><CheckGroup control={control} name="timeSlots" options={TIME_SLOTS.map((s) => [s, s])} />
                <div className="mt-4 max-w-xs"><Field label="Max pickups per day"><input type="number" min="1" max="50" className="input" {...register('dailyCapacity')} /></Field></div>
                <p className="label mt-4">Materials you accept <span className="font-normal text-gray-400">(leave empty for all)</span></p>
                <CheckGroup control={control} name="acceptedMaterials" options={(cats.data?.categories || []).map((c) => [c.slug, c.name])} />
              </Section>

              <button type="submit" className="btn-primary w-full py-3 text-base" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4 text-white" />}Submit application</button>
              <p className="text-center text-xs text-gray-500">Your application is reviewed by an admin before you receive requests.</p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
