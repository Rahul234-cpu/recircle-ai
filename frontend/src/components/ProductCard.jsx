import { Link } from 'react-router-dom';
import { Heart, MapPin } from 'lucide-react';
import { inr } from '../utils/format';
import { StatusBadge } from './ui';

export default function ProductCard({ product, onToggleFavourite, isFavourite, showStatus = false }) {
  const img = product.images?.[0]?.url;
  const discount = product.originalPrice > product.sellingPrice ? Math.round((1 - product.sellingPrice / product.originalPrice) * 100) : null;
  return (
    <div className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/products/${product._id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-brand-50">
          {img ? <img src={img} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : null}
          <span className="absolute left-3 top-3 badge bg-white/95 text-gray-700 shadow-sm">{product.condition}</span>
          {showStatus && <span className="absolute bottom-3 left-3"><StatusBadge status={product.status} /></span>}
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/products/${product._id}`} className="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-700">{product.title}</Link>
          {onToggleFavourite && (
            <button type="button" onClick={() => onToggleFavourite(product._id)} className="shrink-0 rounded-lg p-1 hover:bg-gray-100" aria-label={isFavourite ? 'Remove from favourites' : 'Save to favourites'}>
              <Heart className={`h-5 w-5 ${isFavourite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-ink">{inr(product.sellingPrice)}</span>
          {discount > 0 && <span className="text-xs text-gray-400 line-through">{inr(product.originalPrice)}</span>}
          {discount > 0 && <span className="text-xs font-semibold text-brand-700">{discount}% off</span>}
        </div>
        {product.locationLabel?.city && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" />{[product.locationLabel.locality, product.locationLabel.city].filter(Boolean).join(', ')}</p>
        )}
      </div>
    </div>
  );
}
