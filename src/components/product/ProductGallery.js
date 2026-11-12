'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ProductImage from '@/components/ui/ProductImage';
import { CloseIcon } from '@/components/ui/Icons';

/** Gallery: vertical thumbnails (desktop), swipe + dots (mobile), badge, full-screen lightbox. */
export default function ProductGallery({ images = [], name, activeImage, badge }) {
  const list = images.length ? images : [null];
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [touchX, setTouchX] = useState(null);

  useEffect(() => {
    if (!activeImage) return;
    const i = list.indexOf(activeImage);
    if (i >= 0) setIndex(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImage]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(false);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % list.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + list.length) % list.length);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox, list.length]);

  const go = (d) => setIndex((i) => (i + d + list.length) % list.length);

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start">
      {list.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto md:max-h-[560px] md:flex-col md:overflow-y-auto">
          {list.map((src, i) => (
            <button
              key={`${src}-${i}`}
              onClick={() => setIndex(i)}
              className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-brand-200 ring-1 ring-offset-2 ring-offset-cream transition md:h-20 md:w-20 ${i === index ? 'ring-ink' : 'ring-transparent opacity-70 hover:opacity-100'}`}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
            >
              <ProductImage src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div
        className="relative aspect-square w-full min-w-0 cursor-zoom-in overflow-hidden rounded-2xl bg-brand-200 md:flex-1"
        onClick={() => setLightbox(true)}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX == null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          setTouchX(null);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={index} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <ProductImage src={list[index]} alt={`${name} — image ${index + 1}`} fill priority={index === 0} sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        {badge && <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink">{badge}</span>}
        <span className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-ink">{index + 1} / {list.length}</span>
        {list.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl shadow md:flex" aria-label="Previous image">‹</button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl shadow md:flex" aria-label="Next image">›</button>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 md:hidden">
              {list.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-ink' : 'w-1.5 bg-ink/30'}`} />)}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
            role="dialog" aria-label="Image viewer"
          >
            <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><CloseIcon /></button>
            {list.length > 1 && (
              <>
                <button className="absolute left-4 z-10 rounded-full bg-white/10 px-4 py-3 text-2xl text-white" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous image">‹</button>
                <button className="absolute right-4 z-10 rounded-full bg-white/10 px-4 py-3 text-2xl text-white" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next image">›</button>
              </>
            )}
            <div className="relative h-[82vh] w-[92vw] max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <ProductImage src={list[index]} alt={name} fill sizes="92vw" className="object-contain" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
