import { NextResponse } from 'next/server';

// Next 16 proxy (formerly middleware). Old links like /product/<uuid> are 308-redirected to /product/<slug>.
// The proxy must not import server-only DB code, so the slug comes from GET /api/products/resolve.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const [, , segment, ...rest] = pathname.split('/'); // ['', 'product', '<slug>', ...]
  if (!segment || rest.length || !UUID_RE.test(segment)) return NextResponse.next();

  try {
    const res = await fetch(new URL(`/api/products/resolve?id=${segment}`, request.url), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return NextResponse.next();
    const { slug } = await res.json();
    if (!slug || slug === segment) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/product/${encodeURIComponent(slug)}`;
    url.search = search;
    return NextResponse.redirect(url, 308);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: '/product/:path*',
};
