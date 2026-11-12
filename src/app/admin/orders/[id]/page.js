'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert, App, Button, Card, Col, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch,
  Table, Tag, Timeline, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CarOutlined, CloseCircleOutlined, DollarOutlined, FilePdfOutlined, LinkOutlined, PrinterOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { CANCEL_REASONS, FULFILLMENT_STEPS, ISSUE_TYPES, STATUS_LABELS, ADMIN_CANCELLABLE, stepIndex } from '@/lib/orderRules';
import { api, useAdmin, useRunner } from '../../_components/hooks';
import { PageHeader, PaymentTag, QueryState, StatusTag, fmtDateTime, formatINR } from '../../_components/ui';

const ADMIN_STEPS = FULFILLMENT_STEPS.filter((s) => s !== 'placed');

function Money({ label, value, strong, negative }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: strong ? 700 : 400, fontSize: strong ? 16 : 14 }}>
      <span style={{ color: strong ? undefined : '#6b625b' }}>{label}</span>
      <span>
        {negative ? '−' : ''}
        {typeof value === 'number' ? formatINR(value) : value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatusCard({ order, run, busy }) {
  const forward = ADMIN_STEPS.filter((s) => stepIndex(s) > stepIndex(order.fulfillment_status));
  const [status, setStatus] = useState(forward[0]);
  const [note, setNote] = useState('');
  useEffect(() => {
    setStatus(forward[0]);
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.fulfillment_status]);

  const unpaidOnline = order.fulfillment_status === 'placed';
  if (order.fulfillment_status === 'cancelled' || !forward.length) return null;

  return (
    <Card size="small" title="Update status">
      {unpaidOnline ? (
        <Typography.Text type="secondary">This online order is awaiting payment. It moves to Confirmed once paid.</Typography.Text>
      ) : (
        <Space wrap align="start">
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 190 }}
            options={forward.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <Input placeholder="Note (optional, shown to customer)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 280 }} maxLength={300} />
          <Popconfirm
            title={`Mark as ${STATUS_LABELS[status]}?`}
            description={status === 'shipped' ? 'The customer gets a "shipped" email.' : status === 'delivered' && order.payment_method === 'cod' ? 'COD payment will be marked as collected.' : undefined}
            onConfirm={() =>
              run('status', () => api(`/api/admin/orders/${order.id}/status`, { method: 'POST', body: { status, note } }), `Marked as ${STATUS_LABELS[status]}`)
            }
          >
            <Button type="primary" loading={busy === 'status'} disabled={!status}>
              Update
            </Button>
          </Popconfirm>
        </Space>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ManualTrackingForm({ order, run, busy }) {
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({ courier_name: order.courier_name || '', awb_code: order.awb_code || '', tracking_url: order.tracking_url || '' });
  }, [form, order.courier_name, order.awb_code, order.tracking_url]);
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={(v) =>
        run(
          'tracking',
          () =>
            api(`/api/admin/orders/${order.id}`, {
              method: 'PATCH',
              body: { courier_name: v.courier_name?.trim() || null, awb_code: v.awb_code?.trim() || null, tracking_url: v.tracking_url?.trim() || '' },
            }),
          'Tracking saved',
        )
      }
    >
      <Row gutter={12}>
        <Col xs={24} md={8}>
          <Form.Item name="courier_name" label="Courier">
            <Input placeholder="e.g. Delhivery" maxLength={80} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="awb_code" label="AWB / tracking no.">
            <Input maxLength={60} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="tracking_url" label="Tracking URL" rules={[{ type: 'url', message: 'Enter a full URL (https://…)' }]}>
            <Input placeholder="https://…" />
          </Form.Item>
        </Col>
      </Row>
      <Button htmlType="submit" loading={busy === 'tracking'}>
        Save tracking
      </Button>
    </Form>
  );
}

function ShippingCard({ order, integrations, run, busy }) {
  const sr = integrations.shiprocket;
  const live = !['cancelled', 'placed'].includes(order.fulfillment_status);
  const act = (action, label) =>
    run(`sr-${action}`, () => api(`/api/admin/orders/${order.id}/shiprocket`, { method: 'POST', body: { action } }), label);

  const items = [
    { key: 'option', label: 'Shipping option', children: order.shipping_option?.label || order.shipping_option_id || '—' },
    { key: 'courier', label: 'Courier', children: order.courier_name || '—' },
    {
      key: 'awb',
      label: 'AWB',
      children: order.awb_code ? (
        <Space>
          <Typography.Text copyable>{order.awb_code}</Typography.Text>
          {order.tracking_url && (
            <a href={order.tracking_url} target="_blank" rel="noreferrer">
              <LinkOutlined /> Track
            </a>
          )}
        </Space>
      ) : (
        '—'
      ),
    },
  ];
  if (sr) {
    items.push(
      { key: 'sro', label: 'Shiprocket order', children: order.shiprocket_order_id || '—' },
      { key: 'srs', label: 'Shipment id', children: order.shiprocket_shipment_id || '—' },
      {
        key: 'label',
        label: 'Label',
        children: order.label_url ? (
          <a href={order.label_url} target="_blank" rel="noreferrer">
            <FilePdfOutlined /> Download label
          </a>
        ) : (
          '—'
        ),
      },
      { key: 'pickup', label: 'Pickup', children: order.pickup_scheduled_at ? fmtDateTime(order.pickup_scheduled_at) : '—' },
    );
  }
  const pkg = order.shipping_option?.package;
  if (pkg) items.push({ key: 'pkg', label: 'Package', children: `${pkg.weightKg ?? '?'} kg · ${pkg.length ?? '?'}×${pkg.breadth ?? '?'}×${pkg.height ?? '?'} cm` });

  return (
    <Card size="small" title={<><CarOutlined /> Shipping</>}>
      {order.shiprocket_error && live && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Shiprocket error" description={order.shiprocket_error} />
      )}
      <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={items} />
      {sr && live && (
        <Space wrap style={{ marginTop: 12 }}>
          {!order.shiprocket_order_id && (
            <Button type="primary" loading={busy === 'sr-push'} onClick={() => act('push', 'Pushed to Shiprocket')}>
              {order.shiprocket_error ? 'Retry push to Shiprocket' : 'Push to Shiprocket'}
            </Button>
          )}
          {order.shiprocket_shipment_id && !order.awb_code && (
            <Button type="primary" loading={busy === 'sr-awb'} onClick={() => act('awb', 'Courier booked')}>
              Book courier
            </Button>
          )}
          {order.awb_code && order.shiprocket_shipment_id && (
            <Button loading={busy === 'sr-label'} onClick={() => act('label', 'Label generated')}>
              {order.label_url ? 'Regenerate label' : 'Generate label'}
            </Button>
          )}
          {order.awb_code && order.shiprocket_shipment_id && !order.pickup_scheduled_at && (
            <Button loading={busy === 'sr-pickup'} onClick={() => act('pickup', 'Pickup scheduled')}>
              Schedule pickup
            </Button>
          )}
        </Space>
      )}
      {live && (
        <div style={{ marginTop: 16 }}>
          {sr ? (
            <details>
              <summary style={{ cursor: 'pointer', color: '#6b625b' }}>Enter tracking manually</summary>
              <div style={{ marginTop: 12 }}>
                <ManualTrackingForm order={order} run={run} busy={busy} />
              </div>
            </details>
          ) : (
            <>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                Shiprocket is not configured — enter the courier and AWB after booking it yourself.
              </Typography.Paragraph>
              <ManualTrackingForm order={order} run={run} busy={busy} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function CancelModal({ order, open, onClose, run, busy }) {
  const [form] = Form.useForm();
  const paidOnline = order.payment_method === 'razorpay' && order.payment_status === 'paid';
  const preset = Form.useWatch('preset', form);
  return (
    <Modal
      title={`Cancel ${order.order_number}?`}
      open={open}
      onCancel={onClose}
      okText="Cancel order"
      okButtonProps={{ danger: true, loading: busy === 'cancel' }}
      cancelText="Keep order"
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ preset: 'Out of stock', reason: '', refund: true, restock: true }}
        onFinish={async (v) => {
          const reason = (v.preset === 'Other' ? v.reason : [v.preset, v.reason].filter(Boolean).join(' — ')).trim();
          const ok = await run(
            'cancel',
            () => api(`/api/admin/orders/${order.id}/cancel`, { method: 'POST', body: { reason, refund: paidOnline ? v.refund : false, restock: v.restock } }),
            'Order cancelled',
          );
          if (ok) onClose();
        }}
      >
        <Form.Item name="preset" label="Reason">
          <Select options={['Out of stock', 'Customer request', 'Unserviceable pincode', 'Suspected fraud', ...CANCEL_REASONS.filter((r) => r !== 'Other'), 'Other'].map((r) => ({ value: r, label: r }))} />
        </Form.Item>
        <Form.Item
          name="reason"
          label={preset === 'Other' ? 'Details' : 'Details (optional)'}
          rules={preset === 'Other' ? [{ required: true, message: 'Please describe the reason' }] : []}
        >
          <Input.TextArea rows={2} maxLength={250} />
        </Form.Item>
        <Typography.Paragraph type="secondary">The customer is emailed about the cancellation.</Typography.Paragraph>
        {paidOnline && (
          <Form.Item name="refund" label={`Refund ${formatINR(order.total - (order.refunded_amount || 0))} through Razorpay`} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
        <Form.Item name="restock" label="Return items to stock" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function RefundModal({ order, integrations, open, onClose, run, busy }) {
  const [form] = Form.useForm();
  const remaining = order.total - (order.refunded_amount || 0);
  const canOnline = order.payment_method === 'razorpay' && order.razorpay_payment_id && order.razorpay_payment_id !== 'manual' && integrations.razorpay;
  const manual = Form.useWatch('manual', form);
  return (
    <Modal
      title={`Refund ${order.order_number}`}
      open={open}
      onCancel={onClose}
      okText={manual ? 'Record refund' : 'Refund via Razorpay'}
      okButtonProps={{ loading: busy === 'refund' }}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ amount: remaining, reason: '', manual: !canOnline }}
        onFinish={async (v) => {
          const ok = await run(
            'refund',
            () => api(`/api/admin/orders/${order.id}/refund`, { method: 'POST', body: { amount: v.amount, reason: v.reason || '', manual: Boolean(v.manual) } }),
            v.manual ? 'Refund recorded' : 'Refund initiated',
          );
          if (ok) onClose();
        }}
      >
        <Typography.Paragraph type="secondary">
          Paid {formatINR(order.total)} · already refunded {formatINR(order.refunded_amount || 0)} · up to {formatINR(remaining)} refundable.
        </Typography.Paragraph>
        <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Enter an amount' }]}>
          <InputNumber min={1} max={remaining} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="reason" label="Reason">
          <Input maxLength={300} placeholder="e.g. Damaged item, partial refund" />
        </Form.Item>
        <Form.Item
          name="manual"
          label="Record a manual refund (UPI / bank transfer — no money moves through Razorpay)"
          valuePropName="checked"
          extra={canOnline ? undefined : 'This order cannot be refunded through Razorpay, so the refund is recorded manually.'}
        >
          <Switch disabled={!canOnline} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function NoteCard({ order, run, busy }) {
  const [note, setNote] = useState(order.admin_note || '');
  useEffect(() => setNote(order.admin_note || ''), [order.admin_note]);
  const dirty = (order.admin_note || '') !== note;
  return (
    <Card size="small" title="Internal note">
      <Input.TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Only admins see this" />
      <Button
        style={{ marginTop: 8 }}
        disabled={!dirty}
        loading={busy === 'note'}
        onClick={() => run('note', () => api(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: { admin_note: note.trim() || null } }), 'Note saved')}
      >
        Save note
      </Button>
    </Card>
  );
}

function OrderView({ data }) {
  const { order, integrations } = data;
  const { run, busy } = useRunner();
  const { modal } = App.useApp();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const a = order.shipping_address || {};
  const refundable = ['paid', 'partially_refunded'].includes(order.payment_status) && order.total - (order.refunded_amount || 0) > 0;
  const cancellable = ADMIN_CANCELLABLE.includes(order.fulfillment_status);
  const manualPayable = order.payment_method === 'razorpay' && order.payment_status === 'pending' && order.fulfillment_status === 'placed';

  const itemColumns = [
    {
      title: 'Item',
      render: (_, i) => (
        <Space>
          {i.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={i.image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }} />
          ) : null}
          <div>
            {i.product_id ? <Link href={`/admin/products/${i.product_id}`}>{i.name}</Link> : i.name}
            {i.variant_name && <div style={{ color: '#6b625b', fontSize: 12 }}>{i.variant_name}</div>}
            {i.sku && <div style={{ color: '#8c8178', fontSize: 12 }}>SKU {i.sku}</div>}
          </div>
        </Space>
      ),
    },
    { title: 'HSN', dataIndex: 'hsn_code', responsive: ['md'], render: (v, i) => (v ? `${v} · ${Number(i.tax_rate)}%` : '—') },
    { title: 'Price', dataIndex: 'price', align: 'right', render: formatINR },
    { title: 'Qty', dataIndex: 'quantity', align: 'right' },
    { title: 'Total', dataIndex: 'line_total', align: 'right', render: (v) => <strong>{formatINR(v)}</strong> },
  ];

  const history = order.history.map((h) => ({
    key: h.id,
    color: h.status === 'cancelled' ? 'red' : h.status === 'delivered' ? 'green' : h.is_public ? 'blue' : 'gray',
    title: fmtDateTime(h.created_at),
    content: (
      <div>
        <Space size={4} wrap>
          <strong>{STATUS_LABELS[h.status] || h.status}</strong>
          <Tag>{h.actor}</Tag>
          {!h.is_public && <Tag color="default">private</Tag>}
        </Space>
        {h.note && <div style={{ color: '#4a423c', whiteSpace: 'pre-wrap' }}>{h.note}</div>}
      </div>
    ),
  }));

  return (
    <>
      <PageHeader
        title={
          <Space wrap>
            <Link href="/admin/orders" aria-label="Back to orders">
              <ArrowLeftOutlined />
            </Link>
            {order.order_number}
            <StatusTag status={order.fulfillment_status} />
          </Space>
        }
        subtitle={`Placed ${fmtDateTime(order.created_at)}`}
        extra={
          <>
            <Button icon={<FilePdfOutlined />} href={`/api/admin/orders/${order.id}/invoice`}>
              Invoice
            </Button>
            <Button icon={<PrinterOutlined />} href={`/api/admin/packing-slips?ids=${order.id}`} target="_blank">
              Packing slip
            </Button>
            {manualPayable && (
              <Button
                icon={<DollarOutlined />}
                loading={busy === 'paid'}
                onClick={() =>
                  modal.confirm({
                    title: 'Mark as paid (manual)?',
                    content: `Use this only when you have received ${formatINR(order.total)} outside Razorpay checkout. The order is confirmed and the customer gets the confirmation email.`,
                    okText: 'Mark as paid',
                    onOk: () => run('paid', () => api(`/api/admin/orders/${order.id}/mark-paid`, { method: 'POST' }), 'Marked as paid'),
                  })
                }
              >
                Mark as paid (manual)
              </Button>
            )}
            {refundable && (
              <Button icon={<ReloadOutlined />} onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
            )}
            {cancellable && (
              <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            )}
          </>
        }
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {order.refund_required && (
          <Alert
            type="error"
            showIcon
            title="REFUND REQUIRED"
            description="Payment was received for an order that cannot be fulfilled, or an automatic refund failed. Refund the customer, then the flag clears once fully refunded."
            action={refundable ? <Button size="small" danger onClick={() => setRefundOpen(true)}>Refund now</Button> : undefined}
          />
        )}
        {order.fulfillment_status === 'cancelled' && (
          <Alert
            type="warning"
            showIcon
            title={`Cancelled ${fmtDateTime(order.cancelled_at)}${order.cancelled_by ? ` by ${order.cancelled_by}` : ''}`}
            description={order.cancel_reason || undefined}
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <StatusCard order={order} run={run} busy={busy} />

              <Card size="small" title={`Items (${order.items.reduce((s, i) => s + i.quantity, 0)})`}>
                <Table rowKey="id" size="small" columns={itemColumns} dataSource={order.items} pagination={false} scroll={{ x: true }} />
                <div style={{ maxWidth: 360, marginLeft: 'auto', marginTop: 12 }}>
                  <Money label="Items" value={order.items_total} />
                  {order.discount > 0 && <Money label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`} value={order.discount} negative />}
                  <Money label="Shipping" value={order.shipping_fee ? order.shipping_fee : 'Free'} />
                  {order.cod_fee > 0 && <Money label="COD fee" value={order.cod_fee} />}
                  {order.gift_wrap_fee > 0 && <Money label="Gift wrap" value={order.gift_wrap_fee} />}
                  <div style={{ borderTop: '1px solid #eee5dc', marginTop: 6, paddingTop: 6 }}>
                    <Money label="Total" value={order.total} strong />
                  </div>
                  {order.refunded_amount > 0 && <Money label="Refunded" value={order.refunded_amount} negative />}
                </div>
              </Card>

              <ShippingCard order={order} integrations={integrations} run={run} busy={busy} />

              <Card size="small" title="History">
                {history.length ? <Timeline items={history} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              </Card>

              {order.shipment_events.length > 0 && (
                <Card size="small" title="Courier events">
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: true }}
                    dataSource={[...order.shipment_events].reverse()}
                    columns={[
                      { title: 'Time', render: (_, e) => fmtDateTime(e.event_time || e.created_at) },
                      { title: 'Courier status', dataIndex: 'raw_status' },
                      { title: 'Mapped', dataIndex: 'status', render: (s) => (s ? <StatusTag status={s} /> : '—') },
                      { title: 'Location', dataIndex: 'location', render: (v) => v || '—' },
                    ]}
                  />
                </Card>
              )}

              {order.refunds.length > 0 && (
                <Card size="small" title="Refunds">
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: true }}
                    dataSource={order.refunds}
                    columns={[
                      { title: 'Date', dataIndex: 'created_at', render: fmtDateTime },
                      { title: 'Amount', dataIndex: 'amount', align: 'right', render: formatINR },
                      { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'processed' ? 'green' : s === 'failed' ? 'red' : 'gold'}>{s}</Tag> },
                      { title: 'Type', render: (_, r) => (r.is_manual ? 'Manual' : `Razorpay ${r.razorpay_refund_id || ''}`) },
                      { title: 'Reason', dataIndex: 'reason', render: (v) => v || '—' },
                      { title: 'By', dataIndex: 'created_by' },
                    ]}
                  />
                </Card>
              )}

              {order.issues.length > 0 && (
                <Card size="small" title="Reported problems" extra={<Link href="/admin/issues">All issues</Link>}>
                  {order.issues.map((i) => (
                    <div key={i.id} style={{ padding: '8px 0', borderTop: '1px solid #f0ebe5' }}>
                      <Space wrap>
                        <strong>{ISSUE_TYPES[i.type] || i.type}</strong>
                        <Tag color={i.status === 'open' ? 'red' : i.status === 'resolved' ? 'green' : 'default'}>{i.status}</Tag>
                        <Typography.Text type="secondary">{fmtDateTime(i.created_at)}</Typography.Text>
                      </Space>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{i.description}</div>
                      {Array.isArray(i.images) && i.images.length > 0 && (
                        <Space wrap style={{ marginTop: 6 }}>
                          {i.images.map((src) => (
                            <a key={src} href={src} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                            </a>
                          ))}
                        </Space>
                      )}
                      {i.admin_note && <div style={{ color: '#6b625b' }}>Note: {i.admin_note}</div>}
                    </div>
                  ))}
                </Card>
              )}
            </Space>
          </Col>

          <Col xs={24} xl={8}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" title="Customer">
                <div style={{ fontWeight: 600 }}>{order.name}</div>
                <div>
                  <a href={`mailto:${order.email}`}>{order.email}</a>
                </div>
                <div>
                  <a href={`tel:+91${order.phone}`}>{order.phone}</a>
                  {' · '}
                  <a href={`https://wa.me/91${order.phone}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </div>
                <Typography.Text type="secondary">
                  {order.user_id ? 'Registered customer' : 'Guest checkout'} · {order.customer_orders} order{order.customer_orders === 1 ? '' : 's'}
                </Typography.Text>
              </Card>

              <Card size="small" title="Ship to">
                <Typography.Paragraph copyable={{ text: [a.name, a.line1, a.line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`, a.phone].filter(Boolean).join('\n') }} style={{ margin: 0 }}>
                  {a.name}
                  <br />
                  {a.line1}
                  {a.line2 && (
                    <>
                      <br />
                      {a.line2}
                    </>
                  )}
                  {a.landmark && (
                    <>
                      <br />
                      Landmark: {a.landmark}
                    </>
                  )}
                  <br />
                  {a.city}, {a.state} {a.pincode}
                  <br />
                  {a.phone}
                </Typography.Paragraph>
              </Card>

              <Card size="small" title="Payment">
                <PaymentTag status={order.payment_status} method={order.payment_method} />
                <Descriptions
                  size="small"
                  column={1}
                  style={{ marginTop: 8 }}
                  items={[
                    { key: 'm', label: 'Method', children: order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online (Razorpay)' },
                    order.razorpay_order_id && { key: 'ro', label: 'Razorpay order', children: <Typography.Text copyable>{order.razorpay_order_id}</Typography.Text> },
                    order.razorpay_payment_id && {
                      key: 'rp',
                      label: 'Payment id',
                      children: <Typography.Text copyable>{order.razorpay_payment_id}</Typography.Text>,
                    },
                    order.paid_at && { key: 'pa', label: 'Paid at', children: fmtDateTime(order.paid_at) },
                    order.refunded_amount > 0 && { key: 'rf', label: 'Refunded', children: formatINR(order.refunded_amount) },
                  ].filter(Boolean)}
                />
              </Card>

              {(order.is_gift || order.customer_note) && (
                <Card size="small" title={order.is_gift ? 'Gift' : 'Customer note'}>
                  {order.is_gift && (
                    <>
                      <Space wrap>
                        <Tag color="magenta">Gift order — no prices in parcel</Tag>
                        {order.gift_wrap && <Tag color="purple">Gift wrap</Tag>}
                      </Space>
                      {order.gift_message && <Typography.Paragraph style={{ marginTop: 8, fontStyle: 'italic' }}>“{order.gift_message}”</Typography.Paragraph>}
                    </>
                  )}
                  {order.customer_note && (
                    <div style={{ marginTop: order.is_gift ? 8 : 0 }}>
                      {order.is_gift && <Typography.Text type="secondary">Customer note: </Typography.Text>}
                      <span style={{ whiteSpace: 'pre-wrap' }}>{order.customer_note}</span>
                    </div>
                  )}
                </Card>
              )}

              <NoteCard order={order} run={run} busy={busy} />
            </Space>
          </Col>
        </Row>
      </Space>

      <CancelModal order={order} open={cancelOpen} onClose={() => setCancelOpen(false)} run={run} busy={busy} />
      <RefundModal order={order} integrations={integrations} open={refundOpen} onClose={() => setRefundOpen(false)} run={run} busy={busy} />
    </>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const q = useAdmin(`/api/admin/orders/${id}`);
  return <QueryState query={q}>{(data) => <OrderView data={data} />}</QueryState>;
}
