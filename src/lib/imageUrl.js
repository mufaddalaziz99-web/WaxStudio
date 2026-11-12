// Image URL helpers shared by browser and server.
// Cloudinary URLs get f_auto,q_auto (+ width); other URLs are returned unchanged.
export function imageUrl(src, { width, height, crop = 'fill' } = {}) {
  if (!src) return '/images/product/volume-powder-1.svg';
  if (!src.includes('res.cloudinary.com') || !src.includes('/upload/')) return src;
  const t = ['f_auto', 'q_auto'];
  if (width) t.push(`w_${width}`);
  if (height) t.push(`h_${height}`, `c_${crop}`);
  return src.replace('/upload/', `/upload/${t.join(',')}/`);
}

/** Full-size JPEG for feeds (Google Merchant wants real JPEG/PNG). */
export function feedImageUrl(src, siteUrl) {
  if (!src) return null;
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) return src.replace('/upload/', '/upload/f_jpg,q_90/');
  return src.startsWith('http') ? src : `${siteUrl}${src}`;
}

export const isSvg = (src) => typeof src === 'string' && src.split('?')[0].endsWith('.svg');
