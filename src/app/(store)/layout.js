import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import { getSettings } from '@/lib/server/settings';
import { listCategories } from '@/lib/server/catalog';

// Catalog pages are ISR; this is the daily safety refresh. Targeted revalidation handles changes.
export const revalidate = 86400;

export default async function StoreLayout({ children }) {
  const settings = await getSettings();
  const categories = await listCategories().catch(() => []);
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        storeName={settings.store.name}
        announcement={settings.announcement.enabled ? settings.announcement.text : ''}
        categories={categories.filter((c) => c.product_count > 0).map((c) => ({ name: c.name, slug: c.slug }))}
      />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
      <CartDrawer freeShippingThreshold={settings.shipping.freeShippingThreshold} />
    </div>
  );
}
