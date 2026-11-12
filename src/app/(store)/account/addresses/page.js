import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/auth';
import { listAddresses } from '@/lib/server/accounts';
import AddressBook from '@/components/account/AddressBook';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saved addresses', robots: { index: false, follow: false } };

export default async function AddressesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=%2Faccount%2Faddresses');
  const addresses = await listAddresses(user.id);
  return <AddressBook initialAddresses={addresses} defaults={{ name: user.name || '', phone: user.phone || '', email: user.email }} />;
}
