'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Input, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { BellOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, formatINR } from '../_components/ui';

function stockTag(stock, threshold = 5) {
  return <Tag color={stock <= 0 ? 'red' : stock < threshold ? 'orange' : 'green'}>{stock <= 0 ? 'Sold out' : stock}</Tag>;
}

export default function ProductsPage() {
  const q = useAdmin('/api/admin/products');
  const { run, busy } = useRunner();
  const { message } = App.useApp();
  const [search, setSearch] = useState('');

  const toggle = (id, patch, label) => run(`t-${id}`, () => api(`/api/admin/products/${id}`, { method: 'PATCH', body: patch }), label);

  const columns = [
    {
      title: 'Product',
      fixed: 'left',
      render: (_, p) => (
        <Space>
          {p.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0]} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f3eee8' }} />
          )}
          <div>
            <Link href={`/admin/products/${p.id}`} style={{ fontWeight: 600 }}>
              {p.name}
            </Link>
            <div style={{ fontSize: 12, color: '#8c8178' }}>
              /{p.slug}
              {p.sku ? ` · ${p.sku}` : ''}
            </div>
          </div>
        </Space>
      ),
    },
    { title: 'Category', dataIndex: 'category_name', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Price',
      align: 'right',
      render: (_, p) => {
        const prices = p.variants.filter((v) => !v.is_hidden).map((v) => v.price ?? p.price);
        if (!prices.length) return formatINR(p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
      },
    },
    {
      title: 'Stock',
      render: (_, p) =>
        p.variants.length ? (
          <Space size={[4, 4]} wrap style={{ maxWidth: 320 }}>
            {p.variants.map((v) => (
              <Tooltip key={v.id} title={v.is_hidden ? 'Hidden variant' : v.sku || undefined}>
                <span style={{ opacity: v.is_hidden ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12 }}>{v.name}</span> {stockTag(v.stock)}
                </span>
              </Tooltip>
            ))}
          </Space>
        ) : (
          stockTag(p.stock)
        ),
    },
    {
      title: 'Visible',
      align: 'center',
      render: (_, p) => (
        <Switch
          size="small"
          checked={!p.is_hidden}
          loading={busy === `t-${p.id}`}
          onChange={(on) => toggle(p.id, { is_hidden: !on }, on ? 'Product is visible' : 'Product hidden')}
        />
      ),
    },
    {
      title: 'Featured',
      align: 'center',
      render: (_, p) => (
        <Switch
          size="small"
          checked={p.is_featured}
          loading={busy === `t-${p.id}`}
          onChange={(on) => toggle(p.id, { is_featured: on }, on ? 'Featured' : 'No longer featured')}
        />
      ),
    },
    {
      title: 'Rating',
      align: 'right',
      responsive: ['lg'],
      render: (_, p) => (p.rating_count ? `${Number(p.rating_avg).toFixed(1)} ★ (${p.rating_count})` : '—'),
    },
    {
      title: 'Waiting',
      align: 'right',
      responsive: ['lg'],
      render: (_, p) => (p.pending_alerts ? <Tag icon={<BellOutlined />} color="gold">{p.pending_alerts}</Tag> : '—'),
    },
    {
      title: '',
      align: 'right',
      render: (_, p) => (
        <Space size={4}>
          <Link href={`/admin/products/${p.id}`}>
            <Button size="small" icon={<EditOutlined />} aria-label="Edit" />
          </Link>
          <Popconfirm
            title={p.order_lines ? 'Hide this product?' : 'Delete this product?'}
            description={p.order_lines ? 'It has orders, so it will be hidden instead of deleted.' : 'This cannot be undone.'}
            okText={p.order_lines ? 'Hide' : 'Delete'}
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              const r = await run(`d-${p.id}`, () => api(`/api/admin/products/${p.id}`, { method: 'DELETE' }));
              if (r) message.success(r.hidden ? 'Product hidden (it has orders)' : 'Product deleted');
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={busy === `d-${p.id}`} aria-label="Delete" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rows = useMemo(() => {
    const list = q.data?.products || [];
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((p) =>
      [p.name, p.slug, p.sku, p.category_name, ...p.variants.map((v) => `${v.name} ${v.sku || ''}`)].some((x) => x && String(x).toLowerCase().includes(s)),
    );
  }, [q.data, search]);

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={q.data ? `${q.data.products.length} products` : ' '}
        extra={
          <>
            <Link href="/admin/stock-alerts">
              <Button icon={<BellOutlined />}>Stock alerts</Button>
            </Link>
            <Link href="/admin/products/new">
              <Button type="primary" icon={<PlusOutlined />}>
                New product
              </Button>
            </Link>
          </>
        }
      />
      <QueryState query={q}>
        {() => (
          <Card size="small">
            <Input.Search allowClear placeholder="Search name, slug, SKU, variant" onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} />
            <Table rowKey="id" columns={columns} dataSource={rows} scroll={{ x: 1000 }} pagination={{ pageSize: 50, hideOnSinglePage: true }} />
          </Card>
        )}
      </QueryState>
    </>
  );
}
