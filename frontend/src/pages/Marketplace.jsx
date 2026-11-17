import { Link } from 'react-router-dom';
import { ArrowRight, PackagePlus, Store } from 'lucide-react';
import useFetch from '../hooks/useFetch';
import { ProductAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import { Skeleton } from '../components/ui';
import { iconFor } from '../utils/icons';
import { Package } from 'lucide-react';

export default function Marketplace() {
  const cats = useFetch(() => ProductAPI.categories(), []);
  const latest = useFetch(() => ProductAPI.list({ limit: 8, sort: 'newest' }), []);
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50/70 to-canvas">
        <div className="container-page grid items-end gap-6 py-14 sm:py-20 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="eyebrow">Second-hand marketplace</p>
            <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Give products a second life</h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-600">Buy and sell pre-loved furniture, electronics, bicycles, books and more from people near you — with AI-assisted pricing and privacy-safe chat.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/products" className="btn-primary px-5 py-3"><Store className="h-5 w-5" /> Browse products</Link>
            <Link to="/customer/sell-product" className="btn-secondary px-5 py-3"><PackagePlus className="h-5 w-5" /> Sell an item</Link>
          </div>
        </div>
      </section>
      <section className="section pt-4">
        <div className="container-page">
          <h2 className="text-2xl font-bold">Shop by category</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cats.loading && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            {cats.data?.categories?.map((c) => {
              const Icon = iconFor(c.icon, Package);
              return (
                <Link key={c._id} to={`/products?category=${c.slug}`} className="card flex items-center gap-3 p-4 transition hover:border-brand-200 hover:shadow-lift">
                  <div className="rounded-xl bg-brand-50 p-2.5"><Icon className="h-5 w-5 text-brand-700" /></div>
                  <div><p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-gray-400">{c.count} available</p></div>
                </Link>
              );
            })}
          </div>
          <div className="mt-14 flex items-end justify-between"><h2 className="text-2xl font-bold">Fresh listings</h2><Link to="/products" className="text-sm font-semibold text-brand-700 hover:underline">View all <ArrowRight className="inline h-4 w-4" /></Link></div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {latest.loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
            {latest.data?.items?.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        </div>
      </section>
    </>
  );
}
