import AccountNav from '@/components/account/AccountNav';

export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }) {
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink underline decoration-brand-400 decoration-2 underline-offset-2">My account</p>
        <AccountNav />
      </div>
      {children}
    </div>
  );
}
