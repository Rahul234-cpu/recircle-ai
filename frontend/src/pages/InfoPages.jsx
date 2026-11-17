import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Camera, CheckCircle2, ClipboardCheck, HandCoins, Leaf, MessageSquare, PackageCheck, Scale,
  ScanSearch, ShieldCheck, Sparkles, Store, Truck, Users,
} from 'lucide-react';
import { FAQ_ITEMS } from './faqData';
import useFetch from '../hooks/useFetch';
import { MiscAPI } from '../services/api';
import { num } from '../utils/format';

function Hero({ eyebrow, title, text }) {
  return (
    <section className="bg-gradient-to-b from-brand-50/70 to-canvas">
      <div className="container-page py-14 sm:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-lg text-gray-600">{text}</p>}
      </div>
    </section>
  );
}

export function About() {
  const { data } = useFetch(() => MiscAPI.impact(), []);
  const im = data?.impact;
  return (
    <>
      <Hero eyebrow="About us" title="We make the circular economy work at your doorstep" text="India's informal kabadiwala network already recycles a huge share of household waste. ReCircle AI gives it modern tools — and gives usable products a second life before they ever become waste." />
      <section className="section pt-4">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <div className="space-y-4 text-gray-600">
            <h2 className="text-2xl font-bold">Why we built this</h2>
            <p>Households struggle to find a reliable scrap collector, rarely know fair rates, and often throw away items that someone else would happily use. Collectors, on the other hand, spend hours finding customers and have no way to build a verifiable reputation.</p>
            <p>ReCircle AI combines two marketplaces — scrap collection and second-hand products — with an AI layer that recommends the best next life for every item: reuse, repair, donate or recycle.</p>
            <p>We are transparent by design: prices are estimates until weight is verified, AI predictions show confidence scores, and personal details are shared only when a booking is accepted.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[[Users, 'Registered users', im?.users], [Truck, 'Collectors', im?.collectors], [Scale, 'kg recycled', im?.totalRecycledKg], [PackageCheck, 'Products reused', im?.productsReused]].map(([Icon, label, v]) => (
              <div key={label} className="card card-pad"><Icon className="h-6 w-6 text-brand-700" /><p className="mt-3 text-2xl font-bold">{v != null ? num(v, 0) : '—'}</p><p className="text-sm text-gray-500">{label}</p></div>
            ))}
          </div>
        </div>
      </section>
      <section className="section bg-white">
        <div className="container-page grid gap-6 md:grid-cols-3">
          {[[ShieldCheck, 'Trust', 'Admin-verified collectors, ratings after every transaction and privacy-first messaging.'], [Scale, 'Fairness', 'Published per-kg rates, on-the-spot weighing and customer confirmation before completion.'], [Leaf, 'Honest impact', 'We report measured kilograms and reused items — not unverifiable carbon claims.']].map(([Icon, t, d]) => (
            <div key={t} className="card card-pad"><Icon className="h-6 w-6 text-brand-700" /><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-gray-500">{d}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}

export function HowItWorks() {
  const waste = [
    [Camera, 'Upload photos', 'Take a picture of each type of waste. The AI suggests the material with a confidence score.'],
    [Scale, 'Enter approximate weight', 'We calculate an indicative price from the latest admin-managed rate per kg.'],
    [Truck, 'Pick a slot', 'Choose your address on the map, a date and a time slot. Nearby verified collectors are notified.'],
    [ClipboardCheck, 'Collector verifies', 'The collector weighs the material at your door and enters the final weight and price.'],
    [HandCoins, 'Confirm & get paid', 'You confirm, get paid by cash/UPI, receive a digital receipt and earn eco-points.'],
  ];
  const market = [
    [Camera, 'List your item', 'Upload up to 6 photos and basic details.'],
    [Sparkles, 'Let AI help', 'Get a reuse/repair/donate/recycle suggestion, a price range and a draft description.'],
    [MessageSquare, 'Chat safely', 'Buyers message you in-app. Phone numbers stay hidden until you accept a request.'],
    [CheckCircle2, 'Accept & hand over', 'Accept a request (the item is reserved), meet the buyer, then confirm the handover to complete the sale.'],
  ];
  const Steps = ({ items }) => (
    <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map(([Icon, t, d], i) => (
        <li key={t} className="card card-pad">
          <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span><Icon className="h-5 w-5 text-brand-700" /></div>
          <h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-gray-500">{d}</p>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <Hero eyebrow="How it works" title="Two marketplaces, one simple flow" text="Whether it's a pile of newspapers or a laptop you've outgrown, ReCircle finds it the right next home." />
      <section className="section pt-4"><div className="container-page"><h2 className="text-2xl font-bold">Selling recyclable waste</h2><Steps items={waste} /><Link to="/customer/sell-waste" className="btn-primary mt-8">Sell waste now <ArrowRight className="h-4 w-4" /></Link></div></section>
      <section className="section bg-white"><div className="container-page"><h2 className="text-2xl font-bold">Selling and buying second-hand products</h2><Steps items={market} /><div className="mt-8 flex gap-3"><Link to="/customer/sell-product" className="btn-primary">List a product</Link><Link to="/products" className="btn-secondary"><Store className="h-4 w-4" /> Browse products</Link></div></div></section>
      <section className="section"><div className="container-page"><div className="card card-pad flex flex-col gap-4 sm:flex-row sm:items-center"><ScanSearch className="h-10 w-10 shrink-0 text-brand-700" /><div><h3 className="font-semibold">About our AI</h3><p className="text-sm text-gray-500">AI results always show a confidence score and can be overridden. When vision-API credentials are not configured, the image classifier runs in a demo mode based on colour, texture and keywords — and the app says so on screen.</p></div></div></div></section>
    </>
  );
}

export function FAQ() {
  return (
    <>
      <Hero eyebrow="Help centre" title="Frequently asked questions" text="Can't find what you need? Ask the chat assistant in the corner or contact us." />
      <section className="section pt-4">
        <div className="container-page max-w-3xl space-y-3">
          {FAQ_ITEMS.map(([q, a]) => (
            <details key={q} className="card p-5"><summary className="cursor-pointer list-none font-semibold">{q}</summary><p className="mt-3 text-sm text-gray-600">{a}</p></details>
          ))}
          <div className="pt-6 text-center"><Link to="/contact" className="btn-secondary">Still need help? Contact us</Link></div>
        </div>
      </section>
    </>
  );
}

export function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <BadgeCheck className="h-10 w-10 text-brand-700" />
      <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-gray-500">The page you're looking for has been recycled. 🌱</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}
