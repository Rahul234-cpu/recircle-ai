import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

/**
 * Controlled multi-image picker with client-side validation (server validates again).
 * value: File[]   existing: [{url}] (already uploaded, removable)
 */
export default function ImageUploader({ value = [], onChange, existing = [], onRemoveExisting, max = 6, label = 'Add photos' }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const previews = useMemo(() => value.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [value]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const total = existing.length + value.length;

  const addFiles = (files) => {
    setError('');
    const list = Array.from(files || []);
    const ok = [];
    for (const f of list) {
      if (!ALLOWED.includes(f.type)) { setError(`${f.name}: only JPG, PNG or WebP images`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { setError(`${f.name}: must be under ${MAX_MB} MB`); continue; }
      ok.push(f);
    }
    const room = max - total;
    if (ok.length > room) setError(`You can add up to ${max} images`);
    onChange([...value, ...ok.slice(0, Math.max(0, room))]);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {existing.map((img) => (
          <div key={img.url} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {onRemoveExisting && (
              <button type="button" onClick={() => onRemoveExisting(img)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
        ))}
        {previews.map((p, i) => (
          <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {total < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition hover:border-brand-600 hover:text-brand-700"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="px-1 text-center text-xs font-medium">{label}</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ALLOWED.join(',')} multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <p className="mt-2 text-xs text-gray-400">JPG, PNG or WebP · up to {MAX_MB} MB each · max {max}</p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
