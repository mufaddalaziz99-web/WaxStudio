'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/wishlist', label: 'Wishlist' },
];

export default function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Account">
      <ul className="flex min-w-max gap-2">
        {LINKS.map((l) => {
          const active = l.href === '/account' ? pathname === '/account' : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? 'bg-ink text-white' : 'bg-white text-ink-soft shadow-card hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
