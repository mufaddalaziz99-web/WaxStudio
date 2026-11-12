'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Marquee from './Marquee';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { BagIcon, HeartIcon, MenuIcon, UserIcon, CloseIcon, SearchIcon } from '@/components/ui/Icons';

export default function Header({ storeName, announcement, categories = [] }) {
  const { count, openDrawer, hydrated } = useCart();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [bump, setBump] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onFly = () => setBump((b) => b + 1);
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('cart:fly', onFly);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('cart:fly', onFly);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const links = [
    { href: '/shop', label: 'Shop all' },
    ...categories.slice(0, 3).map((c) => ({ href: `/shop/${c.slug}`, label: c.name })),
    { href: '/about', label: 'Our story' },
    { href: '/track-order', label: 'Track order' },
  ];

  const submitSearch = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      {announcement && <Marquee text={announcement} />}
      <header className={`sticky top-0 z-40 bg-cream/95 backdrop-blur transition-shadow ${scrolled ? 'shadow-[0_1px_0_#e6e2d8]' : ''}`}>
        <div className="container-page flex h-16 items-center gap-4 sm:h-[72px]">
          <button className="-ml-2 rounded-lg p-2 lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </button>
          <Link href="/" className="display text-[28px] tracking-[-0.01em] sm:text-[32px]" aria-label={`${storeName} home`}>
            {storeName}
          </Link>
          <nav className="ml-10 hidden items-center gap-7 lg:flex" aria-label="Main">
            {links.map((l) => {
              const active = pathname === l.href || (l.href !== '/shop' && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition ${active ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-ink' : 'text-ink-muted hover:text-ink'}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => setSearchOpen((s) => !s)} className="rounded-full p-2.5 hover:bg-ink/5" aria-label="Search" aria-expanded={searchOpen}>
              <SearchIcon />
            </button>
            <Link href="/account/wishlist" className="relative hidden rounded-full p-2.5 hover:bg-ink/5 sm:block" aria-label="Wishlist">
              <HeartIcon />
              {wishlist.hydrated && wishlist.ids.length > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-cream bg-ink" />}
            </Link>
            <Link href={user ? '/account' : '/login'} className="rounded-full p-2.5 hover:bg-ink/5" aria-label={user ? 'Your account' : 'Sign in'}>
              <UserIcon />
            </Link>
            <motion.button
              key={bump}
              data-cart-target
              animate={bump ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : {}}
              transition={{ duration: 0.45 }}
              onClick={openDrawer}
              className="relative ml-1 rounded-full p-2.5 hover:bg-ink/5"
              aria-label={`Cart, ${count} items`}
            >
              <BagIcon />
              {hydrated && count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium text-cream ring-2 ring-cream">
                  {count}
                </span>
              )}
            </motion.button>
          </div>
        </div>
        <AnimatePresence>
          {searchOpen && (
            <motion.form
              onSubmit={submitSearch}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-line"
              role="search"
            >
              <div className="container-page flex gap-2 py-3">
                <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search for hair removal powder…" aria-label="Search products" />
                <button className="btn-primary">Search</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.nav
              className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-sm flex-col bg-ink p-6 text-white"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }}
              aria-label="Mobile"
            >
              <div className="mb-10 flex items-center justify-between">
                <span className="display text-3xl">{storeName}</span>
                <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-white/10"><CloseIcon /></button>
              </div>
              {[{ href: '/', label: 'Home' }, ...links].map((l) => (
                <Link key={l.href} href={l.href} className="display border-b border-white/10 py-4 text-3xl hover:text-white/70">{l.label}</Link>
              ))}
              <div className="mt-auto space-y-3 pt-8">
                <Link href={user ? '/account' : '/login'} className="btn-accent w-full">{user ? 'My account' : 'Sign in'}</Link>
                <Link href="/contact" className="block text-center text-sm text-white/70">Need help? Contact us</Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
