import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Camera, CalendarCheck, HandCoins, Recycle, ScanSearch, ShieldCheck, Sparkles, Store, Tag, Truck, Wrench,
} from 'lucide-react';
import useFetch from '../hooks/useFetch';
import { MiscAPI, ProductAPI, WasteAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import { Skeleton } from '../components/ui';
import { inr, num } from '../utils/format';
import { FAQ_ITEMS } from './faqData';
import { iconFor } from '../utils/icons';

const STEPS = [
  [Camera, 'Snap a photo', 'Upload a picture of your waste or a product you no longer need.'],
  [ScanSearch, 'AI identifies it', 'We suggest the material or category, a price estimate and whether to reuse, repair, donate or recycle.'],
  [CalendarCheck, 'Book or list', 'Schedule a doorstep pickup with a verified kabadiwala, or publish a marketplace listing.'],
  [HandCoins, 'Get paid', 'Collector weighs it in front of you and pays on the spot. You get a digital receipt and eco-points.'],
];

const AI_FEATURES = [
  [ScanSearch, 'Waste image classification', 'Identifies paper, cardboard, plastic, metal, glass, e-waste or textiles with a confidence score.'],
  [Sparkles, 'Reuse vs Recycle engine', 'Explains whether an item should be reused, repaired, donated or recycled — you make the final call.'],
  [Tag, 'Smart price suggestions', 'Scrap estimates from live admin rates, and price ranges for used products based on age, condition and real sales.'],
  [Truck, 'Kabadiwala matching', 'Ranks nearby verified collectors by distance, availability, capacity and rating.'],
];

const TESTIMONIALS = [
  ['Priya S.', 'Indiranagar', 'The collector weighed everything in front of me and paid via UPI. Way better than waiting for the raddiwala to show up.'],
  ['Ramesh K.', 'Kabadiwala, Domlur', 'I get requests from my own area with the materials listed upfront. My route planning is much easier now.'],
  ['Meera N.', 'BTM Layout', 'Bought a barely used air fryer for less than half the price. The chat kept my number private until the seller accepted.'],
];

export default function Landing() {
  const impact = useFetch(() => MiscAPI.impact(), []);
  const products = useFetch(() => ProductAPI.list({ limit: 4, sort: 'popular' }), []);
  const cats = useFetch(() => WasteAPI.categories(), []);
  const im = impact.data?.impact;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 to-canvas">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="badge bg-white text-brand-800 ring-1 ring-brand-200"><Sparkles className="h-3.5 w-3.5" /> AI-powered circular marketplace</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">Turn Your Waste <span className="text-brand-700">Into Worth.</span></h1>
            <p className="mt-5 max-w-xl text-lg text-gray-600">Sell recyclable waste, book trusted kabadiwalas, and give pre-loved products a new home.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/customer/sell-waste" className="btn-primary px-6 py-3 text-base"><Recycle className="h-5 w-5" /> Sell Waste</Link>
              <Link to="/products" className="btn-secondary px-6 py-3 text-base"><Store className="h-5 w-5" /> Explore Second-Hand Products</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-brand-600" /> Verified collectors</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand-600" /> Address shared only after acceptance</span>
              <span className="flex items-center gap-1.5"><HandCoins className="h-4 w-4 text-brand-600" /> Transparent per-kg rates</span>
            </div>
          </div>
          <div className="relative">
            <div className="card overflow-hidden p-0">
              <div className="border-b border-gray-100 bg-white px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">AI analysis</p>
                <p className="mt-1 font-semibold">Bundle of newspapers & cartons</p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                {[['Material', 'Paper · Cardboard'], ['Confidence', '86%'], ['Est. weight', '18 kg'], ['Indicative price', '₹ 228']].map(([k, v]) => (
                  <div key={k} className="bg-white px-5 py-4"><p className="text-xs text-gray-400">{k}</p><p className="mt-0.5 font-semibold">{v}</p></div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-brand-700 px-5 py-4 text-white">
                <span className="text-sm">Suggested: <strong>Recycle</strong> — 3 collectors nearby</span>
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden rounded-2xl bg-white p-4 shadow-lift sm:block">
              <p className="text-xs text-gray-400">Reuse suggestion</p>
              <p className="flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4 text-sky-600" /> Repair, then resell laptop</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="how-it-works">
        <div className="container-page">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">From clutter to cash in four steps</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([Icon, title, text], i) => (
              <div key={title} className="card card-pad">
                <div className="flex items-center justify-between"><div className="rounded-xl bg-brand-50 p-2.5"><Icon className="h-5 w-5 text-brand-700" /></div><span className="text-3xl font-extrabold text-gray-100">0{i + 1}</span></div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waste categories */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="eyebrow">What we collect</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">Today's scrap rates</h2></div>
            <Link to="/waste-collection" className="btn-secondary">See all categories <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {cats.loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            {cats.data?.categories?.slice(0, 12).map((c) => {
              const Icon = iconFor(c.icon);
              return (
                <div key={c._id} className="rounded-2xl border border-gray-100 p-4 transition hover:border-brand-200 hover:shadow-card">
                  <Icon className="h-6 w-6 text-brand-700" />
                  <p className="mt-3 text-sm font-semibold">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.rate ? `${inr(c.rate.pricePerKg)}/${c.rate.unit}` : 'Rate on request'}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-gray-400">Indicative rates set by our admin team. Final price is based on weight verified at pickup.</p>
        </div>
      </section>

      {/* Marketplace preview */}
      <section className="section">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="eyebrow">Second-hand marketplace</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">Pre-loved, ready for round two</h2></div>
            <Link to="/products" className="btn-secondary">Browse all products <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
            {products.data?.items?.map((p) => <ProductCard key={p._id} product={p} />)}
            {!products.loading && !products.data?.items?.length && <p className="text-sm text-gray-500">No listings yet — be the first to sell something.</p>}
          </div>
        </div>
      </section>

      {/* AI features */}
      <section className="section bg-ink text-white">
        <div className="container-page">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-400">Built-in intelligence</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">AI that helps you decide — never decides for you</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {AI_FEATURES.map(([Icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <Icon className="h-6 w-6 text-accent-400" />
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-sm text-gray-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="section">
        <div className="container-page">
          <p className="eyebrow">Measured impact</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">What our community has achieved</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Recyclables collected', im ? `${num(im.totalRecycledKg)} kg` : '—'],
              ['Products reused', im ? num(im.productsReused, 0) : '—'],
              ['Completed pickups', im ? num(im.completedPickups, 0) : '—'],
              ['Verified collectors', im ? num(im.collectors, 0) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="card card-pad"><p className="text-3xl font-extrabold text-brand-700">{v}</p><p className="mt-1 text-sm text-gray-500">{k}</p></div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">Live totals from collector-verified weights and completed sales. We don't publish CO₂ claims without a verified methodology.</p>
        </div>
      </section>

      {/* Become a kabadiwala */}
      <section className="pb-16 sm:pb-24">
        <div className="container-page">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand-700 p-8 text-white sm:p-12 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-bold text-white">Are you a kabadiwala? Grow with ReCircle.</h2>
              <p className="mt-3 max-w-2xl text-brand-50">Get pickup requests from your own service area, see materials and estimated weights upfront, issue digital receipts and build a reputation with verified reviews.</p>
            </div>
            <div className="flex lg:justify-end"><Link to="/become-kabadiwala" className="btn-accent px-6 py-3 text-base">Register as a collector <ArrowRight className="h-5 w-5" /></Link></div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section bg-white">
        <div className="container-page">
          <p className="eyebrow">Testimonials</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Loved by households and collectors</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map(([name, place, quote]) => (
              <figure key={name} className="card card-pad">
                <blockquote className="text-gray-700">“{quote}”</blockquote>
                <figcaption className="mt-4 text-sm"><span className="font-semibold">{name}</span> <span className="text-gray-400">· {place}</span></figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">Sample testimonials from the demo dataset.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container-page max-w-3xl">
          <p className="eyebrow text-center">FAQ</p>
          <h2 className="mt-2 text-center text-3xl font-bold sm:text-4xl">Questions, answered</h2>
          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.slice(0, 5).map(([q, a]) => (
              <details key={q} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
                <p className="mt-3 text-sm text-gray-600">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 text-center"><Link to="/faq" className="text-sm font-semibold text-brand-700 hover:underline">View all FAQs →</Link></div>
        </div>
      </section>
    </>
  );
}
