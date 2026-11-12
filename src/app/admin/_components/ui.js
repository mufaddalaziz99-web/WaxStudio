'use client';
import { Alert, Button, Result, Space, Spin, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { PAYMENT_LABELS, STATUS_LABELS } from '@/lib/orderRules';
import { formatINR } from '@/lib/rules';

export { formatINR };

const IST = { timeZone: 'Asia/Kolkata' };
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const STATUS_COLORS = {
  placed: 'default',
  confirmed: 'blue',
  packed: 'geekblue',
  shipped: 'purple',
  out_for_delivery: 'cyan',
  delivered: 'green',
  cancelled: 'red',
};
export const PAYMENT_COLORS = {
  pending: 'gold',
  paid: 'green',
  failed: 'red',
  refunded: 'magenta',
  partially_refunded: 'orange',
};

export function StatusTag({ status }) {
  return <Tag color={STATUS_COLORS[status] || 'default'}>{STATUS_LABELS[status] || status}</Tag>;
}

export function PaymentTag({ status, method }) {
  return (
    <Space size={4} wrap>
      <Tag color={PAYMENT_COLORS[status] || 'default'}>{PAYMENT_LABELS[status] || status}</Tag>
      {method && <Tag>{method === 'cod' ? 'COD' : 'Online'}</Tag>}
    </Space>
  );
}

export function PageHeader({ title, subtitle, extra }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {extra && (
        <Space wrap size={8}>
          {extra}
        </Space>
      )}
    </div>
  );
}

/** Loading / error wrapper for a react-query result. */
export function QueryState({ query, children }) {
  if (query.isPending) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (query.isError) {
    if (query.error?.status === 404) return <Result status="404" title="Not found" subTitle={query.error.message} />;
    return (
      <Alert
        type="error"
        showIcon
        title="Could not load"
        description={query.error?.message}
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={() => query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }
  return children(query.data);
}

/** Minimal bordered list (antd's List is deprecated in v6). */
export function RowList({ items, render, rowKey = (x, i) => x.id ?? i, empty }) {
  if (!items?.length) return empty || null;
  return (
    <div>
      {items.map((item, i) => (
        <div
          key={rowKey(item, i)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', minWidth: 0,
            borderTop: i ? '1px solid #f0ebe5' : undefined,
          }}
        >
          {render(item, i)}
        </div>
      ))}
    </div>
  );
}

/** Turn a "field: message" API validation error into antd Form field errors. */
export function applyFieldError(form, err) {
  const field = err?.data?.field;
  if (!field) return false;
  const name = field.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  form.setFields([{ name, errors: [String(err.message).replace(/^[^:]+:\s*/, '')] }]);
  try {
    form.scrollToField(name);
  } catch {}
  return true;
}
