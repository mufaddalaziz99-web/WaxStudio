import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser, publicUser } from '@/lib/server/auth';
import ProfileForm from '@/components/account/ProfileForm';
import SignOutButton from '@/components/account/SignOutButton';
import { BagIcon, HeartIcon, TruckIcon, UserIcon } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account', robots: { index: false, follow: false } };

const LINKS = [
  { href: '/account/orders', title: 'Your orders', text: 'Track, cancel or get help with an order', Icon: BagIcon },
  { href: '/account/addresses', title: 'Saved addresses', text: 'Faster checkout next time', Icon: UserIcon },
  { href: '/account/wishlist', title: 'Wishlist', text: 'Products you saved for later', Icon: HeartIcon },
  { href: '/track-order', title: 'Track an order', text: 'Using an order number and phone', Icon: TruckIcon },
];

export default async function AccountPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login?next=%2Faccount');
  const user = publicUser(session);
  const firstName = (user.name || '').split(' ')[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="card p-6 sm:p-8">
          <h1 className="font-display text-3xl text-ink">{firstName ? `Hi, ${firstName}` : 'Hello!'}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Signed in as <span className="font-semibold text-ink">{user.email}</span>
            {user.verified && <span className="chip ml-2 bg-green-100 text-green-800">Verified</span>}
          </p>
          <div className="mt-6 border-t border-ink/5 pt-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">Profile</h2>
            <ProfileForm initialUser={user} />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {LINKS.map(({ href, title, text, Icon }) => (
            <Link key={href} href={href} className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-ink">
                <Icon />
              </span>
              <span>
                <span className="block font-semibold text-ink group-hover:underline decoration-brand-400 decoration-2 underline-offset-4">{title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{text}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="card p-6">
          <h2 className="font-semibold text-ink">Sign-in &amp; security</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {user.hasPassword ? 'You sign in with your email and password.' : 'You sign in with Google.'}
          </p>
          <Link href="/forgot-password?next=%2Faccount" className="btn-outline mt-4 w-full">
            {user.hasPassword ? 'Change password' : 'Set a password'}
          </Link>
          <SignOutButton className="btn-ghost mt-2 w-full" />
        </div>
        {user.isAdmin && (
          <Link href="/admin" className="btn-dark w-full">Open admin panel</Link>
        )}
        <div className="rounded-2xl bg-brand-50 p-5 text-sm text-ink-soft">
          Need help with something? <Link href="/contact" className="font-semibold text-ink underline decoration-brand-400 decoration-2 underline-offset-2 underline">Contact us</Link> and
          we&apos;ll get back to you within a day.
        </div>
      </aside>
    </div>
  );
}
