import CartClient from '@/components/cart/CartClient';
import { getSettings } from '@/lib/server/settings';
import { getSiteOffers } from '@/lib/server/catalog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your cart', robots: { index: false } };

export default async function CartPage() {
  const [settings, offers] = await Promise.all([getSettings(), getSiteOffers()]);
  return (
    <CartClient
      freeShippingThreshold={settings.shipping.freeShippingThreshold}
      offers={offers}
      codEnabled={settings.payments.codEnabled}
    />
  );
}
