import { redirect } from 'next/navigation';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { getSessionUser } from '@/lib/server/auth';
import AdminShell from './_components/AdminShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin');

  if (!user.is_admin) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f4f0' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p style={{ fontSize: 48, fontWeight: 700, color: '#bc6820', margin: 0 }}>403</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0' }}>Admins only</h1>
          <p style={{ color: '#6b625b', marginBottom: 20 }}>
            You are signed in as {user.email}, which does not have access to the admin panel.
          </p>
          <a href="/" style={{ color: '#bc6820', fontWeight: 600 }}>
            ← Back to the store
          </a>
        </div>
      </main>
    );
  }

  return (
    <AntdRegistry>
      <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>
    </AntdRegistry>
  );
}
