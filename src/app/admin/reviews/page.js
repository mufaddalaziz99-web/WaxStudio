'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Modal, Popconfirm, Rate, Segmented, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, fmtDateTime } from '../_components/ui';

const STATUS_COLORS = { pending: 'gold', approved: 'green', rejected: 'red' };

export default function ReviewsPage() {
  const [status, setStatus] = useState('pending');
  const q = useAdmin(`/api/admin/reviews${status === 'all' ? '' : `?status=${status}`}`);
  const { run, busy } = useRunner();
  const [replying, setReplying] = useState(null);
  const [reply, setReply] = useState('');

  const moderate = (r, body, label) => run(`m-${r.id}`, () => api(`/api/admin/reviews/${r.id}`, { method: 'PATCH', body }), label);

  const columns = [
    {
      title: 'Review',
      render: (_, r) => (
        <div style={{ maxWidth: 560 }}>
          <Space wrap size={6}>
            <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
            <Tag color={STATUS_COLORS[r.status]}>{r.status}</Tag>
            {r.is_verified && <Tag color="blue">Verified buyer</Tag>}
          </Space>
          {r.title && <div style={{ fontWeight: 600, marginTop: 4 }}>{r.title}</div>}
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 4 }} ellipsis={{ rows: 4, expandable: true, symbol: 'more' }}>
            {r.body}
          </Typography.Paragraph>
          {Array.isArray(r.images) && r.images.length > 0 && (
            <Space wrap>
              {r.images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                </a>
              ))}
            </Space>
          )}
          {r.admin_reply && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: '#f7f4f0', borderRadius: 8 }}>
              <Typography.Text type="secondary">Your reply: </Typography.Text>
              {r.admin_reply}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Product',
      render: (_, r) => (
        <div>
          <Link href={`/admin/products/${r.product_id}`}>{r.product_name}</Link>
          <div style={{ fontSize: 12, color: '#8c8178' }}>
            {r.name}
            {r.email ? ` · ${r.email}` : ''}
          </div>
          {r.order_number && <div style={{ fontSize: 12, color: '#8c8178' }}>Order {r.order_number}</div>}
          <div style={{ fontSize: 12, color: '#8c8178' }}>{fmtDateTime(r.created_at)}</div>
        </div>
      ),
    },
    {
      title: '',
      align: 'right',
      render: (_, r) => (
        <Space orientation="vertical" size={4} align="end">
          {r.status !== 'approved' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} loading={busy === `m-${r.id}`} onClick={() => moderate(r, { status: 'approved' }, 'Review approved')}>
              Approve
            </Button>
          )}
          {r.status !== 'rejected' && (
            <Button size="small" icon={<CloseOutlined />} loading={busy === `m-${r.id}`} onClick={() => moderate(r, { status: 'rejected' }, 'Review rejected')}>
              Reject
            </Button>
          )}
          <Button
            size="small"
            icon={<MessageOutlined />}
            onClick={() => {
              setReplying(r);
              setReply(r.admin_reply || '');
            }}
          >
            {r.admin_reply ? 'Edit reply' : 'Reply'}
          </Button>
          <Popconfirm
            title="Delete this review permanently?"
            okButtonProps={{ danger: true }}
            onConfirm={() => run(`d-${r.id}`, () => api(`/api/admin/reviews/${r.id}`, { method: 'DELETE' }), 'Review deleted')}
          >
            <Button size="small" danger type="text" icon={<DeleteOutlined />} loading={busy === `d-${r.id}`}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reviews"
        extra={
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            <Table rowKey="id" columns={columns} dataSource={d.reviews} scroll={{ x: 800 }} pagination={{ pageSize: 25, hideOnSinglePage: true }} />
          </Card>
        )}
      </QueryState>
      <Modal
        title="Reply to review"
        open={Boolean(replying)}
        onCancel={() => setReplying(null)}
        okText="Save reply"
        okButtonProps={{ loading: busy === `m-${replying?.id}` }}
        onOk={async () => {
          const ok = await moderate(replying, { adminReply: reply.trim() }, reply.trim() ? 'Reply saved' : 'Reply removed');
          if (ok) setReplying(null);
        }}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">Replies appear under the review on the product page. Leave empty to remove the reply.</Typography.Paragraph>
        <Input.TextArea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} showCount />
      </Modal>
    </>
  );
}
