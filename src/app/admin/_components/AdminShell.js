'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { App, Button, ConfigProvider, Drawer, Grid, Layout, Menu, Typography } from 'antd';
import {
  AppstoreOutlined, BarChartOutlined, DashboardOutlined, FolderOutlined, MailOutlined, MenuOutlined,
  PercentageOutlined, SettingOutlined, ShopOutlined, ShoppingCartOutlined, StarOutlined, WarningOutlined,
} from '@ant-design/icons';

const theme = {
  token: {
    colorPrimary: '#141414',
    borderRadius: 10,
    fontFamily: 'var(--font-sans), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Layout: { siderBg: '#1f1a17', headerBg: '#ffffff', bodyBg: '#f7f4f0' },
    Menu: { darkItemBg: '#1f1a17', darkSubMenuItemBg: '#1f1a17', darkItemSelectedBg: '#bc6820' },
  },
};

const NAV = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: 'orders', href: '/admin/orders', label: 'Orders', icon: <ShoppingCartOutlined /> },
  { key: 'products', href: '/admin/products', label: 'Products', icon: <AppstoreOutlined /> },
  { key: 'categories', href: '/admin/categories', label: 'Categories', icon: <FolderOutlined /> },
  { key: 'coupons', href: '/admin/coupons', label: 'Coupons', icon: <PercentageOutlined /> },
  { key: 'reviews', href: '/admin/reviews', label: 'Reviews', icon: <StarOutlined /> },
  { key: 'issues', href: '/admin/issues', label: 'Issues', icon: <WarningOutlined /> },
  { key: 'messages', href: '/admin/messages', label: 'Messages', icon: <MailOutlined /> },
  { key: 'insights', href: '/admin/insights', label: 'Insights', icon: <BarChartOutlined /> },
  { key: 'settings', href: '/admin/settings', label: 'Settings', icon: <SettingOutlined /> },
];

function selectedKey(pathname) {
  const seg = (pathname || '').replace(/^\/admin\/?/, '').split('/')[0];
  if (!seg) return 'dashboard';
  if (seg === 'stock-alerts') return 'products';
  return seg;
}

function NavMenu({ pathname, onNavigate }) {
  const items = [
    ...NAV.map((n) => ({ key: n.key, icon: n.icon, label: <Link href={n.href} onClick={onNavigate}>{n.label}</Link> })),
    { type: 'divider' },
    {
      key: 'store',
      icon: <ShopOutlined />,
      label: <a href="/" target="_blank" rel="noreferrer">View store</a>,
    },
  ];
  return <Menu theme="dark" mode="inline" selectedKeys={[selectedKey(pathname)]} items={items} style={{ borderInlineEnd: 0 }} />;
}

function Brand() {
  return (
    <Link href="/admin" style={{ display: 'block', padding: '18px 24px', color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>
      Store admin
    </Link>
  );
}

function Shell({ user, children }) {
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const desktop = Boolean(screens.lg);
  const [open, setOpen] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {desktop && (
        <Layout.Sider width={220} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}>
          <Brand />
          <NavMenu pathname={pathname} />
        </Layout.Sider>
      )}
      {!desktop && (
        <Drawer
          placement="left"
          open={open}
          onClose={() => setOpen(false)}
          size={240}
          closable={false}
          styles={{ body: { padding: 0, background: '#1f1a17' }, header: { display: 'none' } }}
        >
          <Brand />
          <NavMenu pathname={pathname} onNavigate={() => setOpen(false)} />
        </Drawer>
      )}
      <Layout>
        <Layout.Header
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: desktop ? '0 24px' : '0 12px',
            borderBottom: '1px solid #eee5dc', position: 'sticky', top: 0, zIndex: 10, height: 56, lineHeight: '56px',
          }}
        >
          {!desktop && <Button type="text" icon={<MenuOutlined />} onClick={() => setOpen(true)} aria-label="Open menu" />}
          <div style={{ flex: 1 }} />
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: 260 }}>
            {user?.name || user?.email}
          </Typography.Text>
        </Layout.Header>
        <Layout.Content style={{ padding: desktop ? 24 : 12, minWidth: 0 }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>{children}</div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export default function AdminShell({ user, children }) {
  return (
    <ConfigProvider theme={theme}>
      <App>
        <Shell user={user}>{children}</Shell>
      </App>
    </ConfigProvider>
  );
}
