'use client';
import { useEffect } from 'react';
import { track } from '@/lib/client/analytics';

/** Tracks clicks on any wa.me link; the source comes from data-ref or a "[ref: …]" tag in the prefilled text. */
export default function WhatsAppClicks() {
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.('a[href*="wa.me"]');
      if (!a) return;
      const href = decodeURIComponent(a.getAttribute('href') || '');
      const ref = a.dataset.ref || href.match(/\[ref:\s*([^\]]+)\]/)?.[1] || 'unknown';
      track('whatsapp_click', { source: ref });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
