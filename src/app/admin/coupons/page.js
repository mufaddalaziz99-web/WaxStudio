'use client';
import { useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, applyFieldError, fmtDateTime, formatINR } from '../_components/ui';

function couponState(c) {
  const now = Date.now();
  if (!c.is_active) return <Tag>Inactive</Tag>;
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return <Tag color="blue">Scheduled</Tag>;
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return <Tag color="default">Expired</Tag>;
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return <Tag color="orange">Used up</Tag>;
  return <Tag color="green">Active</Tag>;
}

function CouponModal({ editing, onClose }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { run } = useRunner();
  const [saving, setSaving] = useState(false);
  const isNew = editing === 'new';
  const type = Form.useWatch('type', form);

  const initial = isNew
    ? { code: '', description: '', type: 'percent', value: 10, max_discount: null, min_order: 0, range: null, usage_limit: null, first_order_only: false, show_on_site: false, is_active: true }
    : {
        ...editing,
        range: editing?.starts_at || editing?.ends_at ? [editing.starts_at ? dayjs(editing.starts_at) : null, editing.ends_at ? dayjs(editing.ends_at) : null] : null,
      };

  return (
    <Modal
      title={isNew ? 'New coupon' : `Edit ${editing?.code}`}
      open={Boolean(editing)}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save"
      okButtonProps={{ loading: saving }}
      destroyOnHidden
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={initial}
        onFinish={async (v) => {
          setSaving(true);
          const body = {
            code: v.code,
            description: v.description || '',
            type: v.type,
            value: v.value,
            max_discount: v.type === 'percent' ? v.max_discount ?? null : null,
            min_order: v.min_order ?? 0,
            starts_at: v.range?.[0] ? v.range[0].toISOString() : null,
            ends_at: v.range?.[1] ? v.range[1].toISOString() : null,
            usage_limit: v.usage_limit ?? null,
            first_order_only: Boolean(v.first_order_only),
            show_on_site: Boolean(v.show_on_site),
            is_active: Boolean(v.is_active),
          };
          const ok = await run('save', async () => {
            try {
              return await api(isNew ? '/api/admin/coupons' : `/api/admin/coupons/${editing.id}`, { method: isNew ? 'POST' : 'PUT', body });
            } catch (e) {
              if (e.data?.field === 'starts_at' || e.data?.field === 'ends_at') form.setFields([{ name: 'range', errors: [e.message] }]);
              else applyFieldError(form, e);
              throw e;
            }
          });
          setSaving(false);
          if (ok) {
            message.success('Coupon saved');
            onClose();
          }
        }}
      >
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="code"
              label="Code"
              normalize={(v) => (v || '').toUpperCase().replace(/\s/g, '')}
              rules={[
                { required: true, message: 'Enter a code' },
                { pattern: /^[A-Z0-9_-]{3,40}$/, message: '3–40 letters, digits, - or _' },
              ]}
            >
              <Input maxLength={40} placeholder="WELCOME10" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="type" label="Type">
              <Select
                options={[
                  { value: 'percent', label: 'Percent off' },
                  { value: 'flat', label: 'Flat ₹ off' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item
              name="value"
              label={type === 'percent' ? 'Percent' : 'Amount (₹)'}
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} max={type === 'percent' ? 100 : undefined} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          {type === 'percent' && (
            <Col xs={12} sm={8}>
              <Form.Item name="max_discount" label="Max discount (₹)">
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="No cap" />
              </Form.Item>
            </Col>
          )}
          <Col xs={12} sm={8}>
            <Form.Item name="min_order" label="Min items total (₹)">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16}>
            <Form.Item name="range" label="Valid from – until (optional)">
              <DatePicker.RangePicker showTime={{ format: 'HH:mm' }} format="DD MMM YYYY HH:mm" allowEmpty={[true, true]} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="usage_limit" label="Total uses">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Unlimited" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Description" extra="Shown on the offer card when it is shown on the site.">
              <Input maxLength={200} placeholder="10% off your first order" />
            </Form.Item>
          </Col>
        </Row>
        <Space size={24} wrap>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="first_order_only" label="First order only" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="show_on_site" label="Show on site" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}

export default function CouponsPage() {
  const q = useAdmin('/api/admin/coupons');
  const { run, busy } = useRunner();
  const [editing, setEditing] = useState(null);

  const columns = [
    {
      title: 'Code',
      render: (_, c) => (
        <div>
          <Typography.Text strong copyable>
            {c.code}
          </Typography.Text>
          {c.description && <div style={{ fontSize: 12, color: '#8c8178' }}>{c.description}</div>}
        </div>
      ),
    },
    {
      title: 'Discount',
      render: (_, c) =>
        c.type === 'percent' ? `${c.value}%${c.max_discount ? ` (max ${formatINR(c.max_discount)})` : ''}` : formatINR(c.value),
    },
    { title: 'Min order', dataIndex: 'min_order', align: 'right', render: (v) => (v ? formatINR(v) : '—') },
    {
      title: 'Used',
      align: 'right',
      render: (_, c) => (
        <span>
          {c.used_count}
          {c.usage_limit != null ? ` / ${c.usage_limit}` : ''}
        </span>
      ),
    },
    {
      title: 'Valid',
      responsive: ['md'],
      render: (_, c) => (c.starts_at || c.ends_at ? `${c.starts_at ? fmtDateTime(c.starts_at) : '…'} → ${c.ends_at ? fmtDateTime(c.ends_at) : '…'}` : 'Always'),
    },
    {
      title: 'Flags',
      render: (_, c) => (
        <Space size={4} wrap>
          {couponState(c)}
          {c.first_order_only && <Tag color="purple">1st order</Tag>}
          {c.show_on_site && <Tag color="gold">On site</Tag>}
        </Space>
      ),
    },
    {
      title: '',
      align: 'right',
      render: (_, c) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(c)} aria-label="Edit" />
          <Popconfirm
            title="Delete this coupon?"
            description="Past orders keep the code. Consider deactivating instead."
            okButtonProps={{ danger: true }}
            onConfirm={() => run(`d-${c.id}`, () => api(`/api/admin/coupons/${c.id}`, { method: 'DELETE' }), 'Coupon deleted')}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={busy === `d-${c.id}`} aria-label="Delete" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Coupons"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            New coupon
          </Button>
        }
      />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            <Table rowKey="id" columns={columns} dataSource={d.coupons} pagination={false} scroll={{ x: 800 }} />
          </Card>
        )}
      </QueryState>
      <CouponModal editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}
