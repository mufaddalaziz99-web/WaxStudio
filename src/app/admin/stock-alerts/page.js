'use client';
import Link from 'next/link';
import { Button, Card, Popconfirm, Table, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, fmtDateTime } from '../_components/ui';

export default function StockAlertsPage() {
  const q = useAdmin('/api/admin/stock-alerts');
  const { run, busy } = useRunner();

  const columns = [
    {
      title: 'Product',
      render: (_, a) => (
        <div>
          <Link href={`/admin/products/${a.product_id}`}>{a.product_name}</Link>
          {a.variant_name && <span style={{ color: '#6b625b' }}> — {a.variant_name}</span>}
          {a.is_hidden && <Tag style={{ marginLeft: 6 }}>Hidden</Tag>}
        </div>
      ),
    },
    { title: 'Stock now', dataIndex: 'stock', align: 'right', render: (s) => <Tag color={s > 0 ? 'green' : 'red'}>{s > 0 ? s : 'Sold out'}</Tag> },
    { title: 'Waiting', dataIndex: 'pending', align: 'right', render: (n) => (n ? <strong>{n}</strong> : 0) },
    { title: 'Already notified', dataIndex: 'notified', align: 'right' },
    { title: 'Last request', dataIndex: 'last_requested_at', render: fmtDateTime, responsive: ['md'] },
  ];

  return (
    <>
      <PageHeader
        title="Back-in-stock alerts"
        subtitle={
          <>
            Customers waiting for sold-out items. Emails go out automatically when you restock (and daily). <Link href="/admin/products">← Products</Link>
          </>
        }
        extra={
          <Popconfirm
            title="Email everyone waiting on items that are back in stock?"
            onConfirm={() =>
              run('send', () => api('/api/admin/stock-alerts', { method: 'POST' }), (r) => `${r.sent} email${r.sent === 1 ? '' : 's'} sent`)
            }
          >
            <Button icon={<SendOutlined />} loading={busy === 'send'}>
              Send due alerts now
            </Button>
          </Popconfirm>
        }
      />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            <Table
              rowKey={(a) => `${a.product_id}-${a.variant_id || ''}`}
              columns={columns}
              dataSource={d.alerts}
              scroll={{ x: 640 }}
              pagination={{ pageSize: 50, hideOnSinglePage: true }}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
