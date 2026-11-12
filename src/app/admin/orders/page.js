'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { FULFILLMENT_STEPS, PAYMENT_LABELS, STATUS_LABELS } from '@/lib/orderRules';
import { useAdmin } from '../_components/hooks';
import { PageHeader, PaymentTag, StatusTag, fmtDateTime, formatINR } from '../_components/ui';

const STATUS_OPTIONS = [...FULFILLMENT_STEPS, 'cancelled'].map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const PAYMENT_OPTIONS = Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label }));
const FILTER_KEYS = ['status', 'payment', 'method', 'q', 'from', 'to', 'attention', 'page', 'pageSize'];

function OrdersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || ''])), [sp]);
  const [search, setSearch] = useState(filters.q);
  const [selected, setSelected] = useState([]);
  useEffect(() => setSearch(filters.q), [filters.q]);

  const apiQs = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    if (!filters[k]) continue;
    // Dates in the URL are YYYY-MM-DD in the admin's timezone; send exact instants.
    if (k === 'from') apiQs.set(k, dayjs(filters.from).startOf('day').toISOString());
    else if (k === 'to') apiQs.set(k, dayjs(filters.to).endOf('day').toISOString());
    else apiQs.set(k, filters[k]);
  }
  const q = useAdmin(`/api/admin/orders?${apiQs}`, { placeholderData: (prev) => prev });

  const setFilters = (patch) => {
    const next = new URLSearchParams();
    const merged = { ...filters, page: '', ...patch };
    for (const k of FILTER_KEYS) if (merged[k]) next.set(k, merged[k]);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    setSelected([]);
  };

  const columns = [
    {
      title: 'Order',
      dataIndex: 'order_number',
      fixed: 'left',
      render: (v, r) => (
        <div>
          <Link href={`/admin/orders/${r.id}`} style={{ fontWeight: 600 }}>
            {v}
          </Link>
          <div>
            {r.refund_required && <Tag color="red">REFUND REQUIRED</Tag>}
            {r.shiprocket_error && (
              <Tooltip title={r.shiprocket_error}>
                <Tag color="orange">Shiprocket error</Tag>
              </Tooltip>
            )}
            {r.is_gift && <Tag color="magenta">Gift</Tag>}
            {r.expired && <Tag>Expired</Tag>}
          </div>
        </div>
      ),
    },
    { title: 'Placed', dataIndex: 'created_at', render: fmtDateTime },
    {
      title: 'Customer',
      dataIndex: 'name',
      render: (v, r) => (
        <div>
          {v}
          <div style={{ fontSize: 12, color: '#8c8178' }}>
            {r.phone} · {r.city} {r.pincode}
          </div>
        </div>
      ),
    },
    { title: 'Items', dataIndex: 'item_count', align: 'right' },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v) => <strong>{formatINR(v)}</strong> },
    { title: 'Payment', render: (_, r) => <PaymentTag status={r.payment_status} method={r.payment_method} /> },
    { title: 'Status', dataIndex: 'fulfillment_status', render: (s) => <StatusTag status={s} /> },
    {
      title: 'Shipment',
      render: (_, r) =>
        r.awb_code ? (
          <span style={{ fontSize: 12 }}>
            {r.courier_name}
            <br />
            {r.awb_code}
          </span>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

  const data = q.data;
  const range = filters.from || filters.to ? [filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null] : null;

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={data ? `${data.total} order${data.total === 1 ? '' : 's'}` : ' '}
        extra={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => q.refetch()} loading={q.isFetching}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              disabled={!selected.length}
              onClick={() => window.open(`/api/admin/packing-slips?ids=${selected.join(',')}`, '_blank', 'noopener')}
            >
              Print packing slips{selected.length ? ` (${selected.length})` : ''}
            </Button>
          </>
        }
      />
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={[8, 8]}>
          <Input.Search
            allowClear
            placeholder="Order no., name, phone, email, AWB"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => setFilters({ q: v.trim() })}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="Status"
            options={STATUS_OPTIONS}
            value={filters.status || undefined}
            onChange={(v) => setFilters({ status: v || '' })}
            style={{ width: 170 }}
          />
          <Select
            allowClear
            placeholder="Payment"
            options={PAYMENT_OPTIONS}
            value={filters.payment || undefined}
            onChange={(v) => setFilters({ payment: v || '' })}
            style={{ width: 170 }}
          />
          <Select
            allowClear
            placeholder="Method"
            options={[
              { value: 'razorpay', label: 'Online (Razorpay)' },
              { value: 'cod', label: 'Cash on Delivery' },
            ]}
            value={filters.method || undefined}
            onChange={(v) => setFilters({ method: v || '' })}
            style={{ width: 170 }}
          />
          <DatePicker.RangePicker
            value={range}
            allowEmpty={[true, true]}
            onChange={(v) =>
              setFilters({ from: v?.[0] ? v[0].format('YYYY-MM-DD') : '', to: v?.[1] ? v[1].format('YYYY-MM-DD') : '' })
            }
          />
          <Select
            allowClear
            placeholder="Needs attention"
            options={[
              { value: 'refund', label: 'Refund required' },
              { value: 'shiprocket', label: 'Shiprocket error' },
            ]}
            value={filters.attention || undefined}
            onChange={(v) => setFilters({ attention: v || '' })}
            style={{ width: 180 }}
          />
          {FILTER_KEYS.some((k) => k !== 'pageSize' && filters[k]) && (
            <Button type="link" onClick={() => router.replace(pathname)}>
              Clear filters
            </Button>
          )}
        </Space>
      </Card>
      <Card size="small">
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={data?.orders || []}
          loading={q.isFetching}
          scroll={{ x: 1000 }}
          rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys), preserveSelectedRowKeys: true }}
          pagination={{
            current: data?.page || 1,
            pageSize: data?.pageSize || 25,
            total: data?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: [25, 50, 100, 200],
            onChange: (page, pageSize) => {
              const next = new URLSearchParams();
              const merged = { ...filters, page: String(page), pageSize: String(pageSize) };
              for (const k of FILTER_KEYS) if (merged[k]) next.set(k, merged[k]);
              router.replace(`${pathname}?${next}`, { scroll: false });
            },
          }}
        />
      </Card>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersInner />
    </Suspense>
  );
}
