'use client';
import { useState } from 'react';
import { App, Button, Card, Col, Descriptions, Form, Input, InputNumber, Row, Switch, Tabs, Tag, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, applyFieldError } from '../_components/ui';

const GROUPS = [
  { key: 'store', label: 'Store' },
  { key: 'announcement', label: 'Announcement bar' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'payments', label: 'Payments' },
  { key: 'checkout', label: 'Checkout' },
  { key: 'reviews', label: 'Reviews' },
];

// Labels + help for known keys; unknown keys fall back to a humanised name.
const META = {
  store: {
    name: { label: 'Store name' },
    tagline: { label: 'Tagline', textarea: true },
    supportEmail: { label: 'Support email' },
    supportPhone: { label: 'Support phone' },
    whatsapp: { label: 'WhatsApp number', help: 'Digits incl. country code, e.g. 919876543210' },
    instagram: { label: 'Instagram handle or URL' },
    address: { label: 'Business address', textarea: true, help: 'Printed on invoices.' },
    gstin: { label: 'GSTIN', help: 'Printed on invoices.' },
    legalName: { label: 'Legal name', help: 'Registered business name for invoices (defaults to the store name).' },
    brandColor: { label: 'Brand colour', help: 'Hex, e.g. #d6852a — used for Razorpay checkout.' },
  },
  announcement: {
    enabled: { label: 'Show announcement bar' },
    text: { label: 'Text', textarea: true },
  },
  shipping: {
    flatRate: { label: 'Flat shipping rate (₹)', help: 'Used when Shiprocket is not configured or fails.' },
    flatRateEtaDays: { label: 'Flat-rate delivery time (days)', help: 'e.g. 4–7' },
    freeShippingThreshold: { label: 'Free shipping at items total (₹)', help: '0 turns free shipping off.' },
    pickupPincode: { label: 'Pickup pincode' },
    packagingWeightGrams: { label: 'Packaging weight (g)' },
    defaultWeightGrams: { label: 'Default product weight (g)' },
    defaultLengthCm: { label: 'Default box length (cm)' },
    defaultBreadthCm: { label: 'Default box breadth (cm)' },
    defaultHeightCm: { label: 'Default box height (cm)' },
  },
  payments: {
    codEnabled: { label: 'Cash on Delivery enabled' },
    codFee: { label: 'COD fee (₹)' },
    codFreeAbove: { label: 'Waive COD fee at items total (₹)', help: '0 = never waived.' },
    codMaxOrder: { label: 'Hide COD above order total (₹)', help: '0 = no limit.' },
  },
  checkout: {
    holidayMode: { label: 'Holiday mode (pause orders)' },
    holidayMessage: { label: 'Holiday message', textarea: true },
    giftWrapFee: { label: 'Gift wrap fee (₹)', help: '0 = free.' },
    lowStockThreshold: { label: 'Low-stock warning below', help: 'Flags variants on the dashboard.' },
  },
  reviews: {
    requestAfterDays: { label: 'Ask for a review after delivery (days)' },
    autoApprove: { label: 'Auto-approve verified-buyer reviews' },
  },
};

const humanize = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function GroupForm({ group, values, defaults }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { run, busy } = useRunner();
  const [dirty, setDirty] = useState(false);
  const fields = Object.entries(defaults);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={values}
      onValuesChange={() => setDirty(true)}
      onFinish={async (v) => {
        const ok = await run(`save-${group}`, async () => {
          try {
            return await api(`/api/admin/settings/${group}`, { method: 'PUT', body: v });
          } catch (e) {
            applyFieldError(form, e);
            throw e;
          }
        });
        if (ok) {
          message.success('Settings saved');
          setDirty(false);
          if (ok.values) form.setFieldsValue(ok.values);
        }
      }}
    >
      <Row gutter={16}>
        {fields.map(([key, def]) => {
          const meta = META[group]?.[key] || {};
          const label = meta.label || humanize(key);
          if (typeof def === 'boolean') {
            return (
              <Col xs={24} md={12} key={key}>
                <Form.Item name={key} label={label} valuePropName="checked" extra={meta.help}>
                  <Switch />
                </Form.Item>
              </Col>
            );
          }
          if (typeof def === 'number') {
            return (
              <Col xs={24} md={12} key={key}>
                <Form.Item name={key} label={label} extra={meta.help} rules={[{ required: true, message: 'Enter a number' }]}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            );
          }
          return (
            <Col xs={24} md={meta.textarea ? 24 : 12} key={key}>
              <Form.Item name={key} label={label} extra={meta.help}>
                {meta.textarea ? <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} /> : <Input maxLength={300} />}
              </Form.Item>
            </Col>
          );
        })}
      </Row>
      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={busy === `save-${group}`} disabled={!dirty}>
        Save {GROUPS.find((g) => g.key === group)?.label.toLowerCase()}
      </Button>
    </Form>
  );
}

function Integration({ on, label }) {
  return on ? <Tag color="green">{label || 'Configured'}</Tag> : <Tag>{label || 'Not configured'}</Tag>;
}

function Integrations({ i }) {
  return (
    <>
      <Typography.Paragraph type="secondary">
        Integrations are configured with environment variables on the server (see <code>.env.example</code>). Everything except the database is optional.
      </Typography.Paragraph>
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          { key: 'rzp', label: 'Razorpay (online payments)', children: <><Integration on={i.razorpay} /> {!i.razorpay && <Typography.Text type="secondary">Cash on Delivery only</Typography.Text>}</> },
          { key: 'rzpw', label: 'Razorpay webhook secret', children: <Integration on={i.razorpayWebhook} /> },
          { key: 'sr', label: 'Shiprocket (couriers, live rates)', children: <><Integration on={i.shiprocket} /> {!i.shiprocket && <Typography.Text type="secondary">Flat-rate shipping, manual tracking</Typography.Text>}</> },
          { key: 'gm', label: 'Google Maps (address search)', children: <Integration on={i.googleMaps} /> },
          { key: 'gs', label: 'Google Sign-In', children: <Integration on={i.googleSignIn} /> },
          { key: 'rs', label: 'Resend (email)', children: <><Integration on={i.resend} /> {!i.resend && <Typography.Text type="secondary">Emails are logged to the console</Typography.Text>}</> },
          { key: 'cl', label: 'Cloudinary (images)', children: <><Integration on={i.cloudinary} /> <Typography.Text type="secondary">Storage: {i.storageDriver}</Typography.Text></> },
          { key: 'url', label: 'Site URL', children: <Typography.Text code>{i.siteUrl}</Typography.Text> },
          { key: 'prefix', label: 'Order number prefix', children: <Typography.Text code>{i.orderPrefix}</Typography.Text> },
        ]}
      />
    </>
  );
}

export default function SettingsPage() {
  const q = useAdmin('/api/admin/settings', { staleTime: 0 });
  return (
    <>
      <PageHeader title="Settings" subtitle="Changes apply to the storefront within a minute." />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            <Tabs
              items={[
                ...GROUPS.filter((g) => d.defaults[g.key]).map((g) => ({
                  key: g.key,
                  label: g.label,
                  children: <GroupForm group={g.key} values={d.settings[g.key]} defaults={d.defaults[g.key]} />,
                })),
                { key: 'integrations', label: 'Integrations', children: <Integrations i={d.integrations} /> },
              ]}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
