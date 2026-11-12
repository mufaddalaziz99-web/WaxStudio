import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/auth';
import WishlistGrid from '@/components/account/WishlistGrid';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My wishlist', robots: { index: false, follow: false } };

export default async function WishlistPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=%2Faccount%2Fwishlist');
  return <WishlistGrid />;
}
