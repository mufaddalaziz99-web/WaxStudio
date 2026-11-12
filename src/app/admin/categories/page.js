'use client';
import { useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { slugify } from '@/lib/rules';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { ImageInput } from '../_components/ImageInputs';
import { PageHeader, QueryState, applyFieldError } from '../_components/ui';

function CategoryModal({ editing, onClose }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { run } = useRunner();
  const [saving, setSaving] = useState(false);
  const isNew = editing === 'new';
  const slug = Form.useWatch('slug', form);
  const name = Form.useWatch('name', form);

  return (
    <Modal
      title={isNew ? 'New category' : `Edit ${editing?.name}`}
      open={Boolean(editing)}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save"
      okButtonProps={{ loading: saving }}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          isNew
            ? { name: '', slug: '', description: '', image: null, sort_order: 0, is_hidden: false }
            : { ...editing, image: editing?.image || null }
        }
        onFinish={async (v) => {
          setSaving(true);
          const body = { name: v.name, slug: v.slug?.trim() || undefined, description: v.description || '', image: v.image || null, sort_order: v.sort_order ?? 0, is_hidden: Boolean(v.is_hidden) };
          const ok = await run('save', async () => {
            try {
              return await api(isNew ? '/api/admin/categories' : `/api/admin/categories/${editing.id}`, { method: isNew ? 'POST' : 'PUT', body });
            } catch (e) {
              applyFieldError(form, e);
              throw e;
            }
          });
          setSaving(false);
          if (ok) {
            message.success('Category saved');
            onClose();
          }
        }}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Enter a name' }]}>
          <Input maxLength={80} />
        </Form.Item>
        <Form.Item
          name="slug"
          label="URL slug"
          extra={
            <>
              /shop/{slugify(slug || name || '') || '…'}
              {!isNew && slug && slugify(slug) !== editing.slug ? ' — the old URL will redirect here.' : ''}
            </>
          }
        >
          <Input maxLength={90} placeholder="Generated from the name" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={1000} />
        </Form.Item>
        <Form.Item name="image" label="Image">
          <ImageInput folder="categories" />
        </Form.Item>
        <Space size={24}>
          <Form.Item name="sort_order" label="Sort order">
            <InputNumber precision={0} />
          </Form.Item>
          <Form.Item name="is_hidden" label="Hidden" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const q = useAdmin('/api/admin/categories');
  const { run, busy } = useRunner();
  const [editing, setEditing] = useState(null);

  const columns = [
    {
      title: 'Category',
      render: (_, c) => (
        <Space>
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
          ) : null}
          <div>
            <strong>{c.name}</strong>
            <div style={{ fontSize: 12, color: '#8c8178' }}>/shop/{c.slug}</div>
            {c.redirects?.length > 0 && <div style={{ fontSize: 11, color: '#8c8178' }}>Redirects from: {c.redirects.join(', ')}</div>}
          </div>
        </Space>
      ),
    },
    { title: 'Products', dataIndex: 'product_count', align: 'right' },
    { title: 'Sort', dataIndex: 'sort_order', align: 'right' },
    { title: 'Status', render: (_, c) => (c.is_hidden ? <Tag>Hidden</Tag> : <Tag color="green">Visible</Tag>) },
    {
      title: '',
      align: 'right',
      render: (_, c) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(c)} aria-label="Edit" />
          <Popconfirm
            title="Delete this category?"
            description={c.product_count ? `${c.product_count} product(s) will become uncategorised.` : undefined}
            okButtonProps={{ danger: true }}
            onConfirm={() => run(`d-${c.id}`, () => api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }), 'Category deleted')}
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
        title="Categories"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            New category
          </Button>
        }
      />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            {d.categories.length ? (
              <Table rowKey="id" columns={columns} dataSource={d.categories} pagination={false} scroll={{ x: 640 }} />
            ) : (
              <Typography.Text type="secondary">No categories yet.</Typography.Text>
            )}
          </Card>
        )}
      </QueryState>
      <CategoryModal editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}
