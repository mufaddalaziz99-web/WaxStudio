import { env } from '@/lib/server/env';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/checkout', '/cart', '/account', '/order-confirmation'],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
