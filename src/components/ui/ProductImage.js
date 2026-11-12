import Image from 'next/image';
import { imageUrl, isSvg } from '@/lib/imageUrl';

/** next/image wrapper: Cloudinary transforms, SVG placeholders served as-is. */
export default function ProductImage({ src, alt, width, height, fill, sizes, priority, className = '' }) {
  const url = imageUrl(src, { width: width ? width * 2 : undefined });
  const unoptimized = isSvg(url) || url.includes('res.cloudinary.com');
  return (
    <Image
      src={url}
      alt={alt || ''}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      className={className}
    />
  );
}
