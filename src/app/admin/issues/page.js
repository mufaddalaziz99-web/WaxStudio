'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Modal, Segmented, Space, Table, Tag, Typography } from 'antd';
import { ISSUE_TYPES } from '@/lib/orderRules';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, fmtDateTime } from '../_components/ui';

const COLORS = { open: 'red', resolved: 'green', rejected: 'default' };

export default function IssuesPage() {
  const [status, setStatus] = useState('open');
  const q = useAdmin(`/api/admin/issues${status === 'all' ? '' : `?status=${status}`}`);
  const { run, busy } = useRunner();
  const [acting, setActing] = useState(null); // { issue, status }
  const [note, setNote] = useState('');

  const open = (issue, next) => {
    setActing({ issue, status: next });
    setNote(issue.admin_note || '');
  };

  const columns = [
    {
      title: 'Problem',
      render: (_, i) => (
        <div style={{ maxWidth: 560 }}>
          <Space wrap size={6}>
            <strong>{ISSUE_TYPES[i.type] || i.type}</strong>
            <Tag color={COLORS[i.status]}>{i.status}</Tag>
          </Space>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 4 }} ellipsis={{ rows: 4, expandable: true, symbol: 'more' }}>
            {i.description}
          </Typography.Paragraph>
          {Array.isArray(i.images) && i.images.length > 0 && (
            <Space wrap>
              {i.images.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                </a>
              ))}
            </Space>
          )}
          {i.admin_note && (
            <div style={{ marginTop: 6, color: '#6b625b' }}>
              Note: {i.admin_note}
              {i.resolved_at ? ` (${fmtDateTime(i.resolved_at)})` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Order',
      render: (_, i) => (
        <div>
          <Link href={`/admin/orders/${i.order_id}`}>{i.order_number}</Link>
          <div style={{ fontSize: 12, color: '#8c8178' }}>{i.name}</div>
          <div style={{ fontSize: 12, color: '#8c8178' }}>
            <a href={`tel:+91${i.phone}`}>{i.phone}</a> · <a href={`mailto:${i.email}`}>{i.email}</a>
          </div>
          <div style={{ fontSize: 12, color: '#8c8178' }}>Reported {fmtDateTime(i.created_at)}</div>
        </div>
      ),
    },
    {
      title: '',
      align: 'right',
      render: (_, i) => (
        <Space orientation="vertical" size={4} align="end">
          {i.status !== 'resolved' && (
            <Button size="small" type="primary" onClick={() => open(i, 'resolved')}>
              Resolve
            </Button>
          )}
          {i.status !== 'rejected' && (
            <Button size="small" onClick={() => open(i, 'rejected')}>
              Reject
            </Button>
          )}
          {i.status !== 'open' && (
            <Button size="small" type="text" onClick={() => open(i, 'open')}>
              Reopen
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Issues"
        subtitle="Problems customers reported after delivery. Refunds and replacements are handled from the order."
        extra={
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            <Table rowKey="id" columns={columns} dataSource={d.issues} scroll={{ x: 800 }} pagination={{ pageSize: 25, hideOnSinglePage: true }} />
          </Card>
        )}
      </QueryState>
      <Modal
        title={acting ? `${acting.status === 'open' ? 'Reopen' : acting.status === 'resolved' ? 'Resolve' : 'Reject'} issue on ${acting.issue.order_number}` : ''}
        open={Boolean(acting)}
        onCancel={() => setActing(null)}
        okText="Save"
        okButtonProps={{ loading: busy === 'issue' }}
        onOk={async () => {
          const ok = await run(
            'issue',
            () => api(`/api/admin/issues/${acting.issue.id}`, { method: 'PATCH', body: { status: acting.status, adminNote: note.trim() } }),
            'Issue updated',
          );
          if (ok) setActing(null);
        }}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">Internal note — e.g. “Replacement sent, AWB …” or “Refunded ₹299”.</Typography.Paragraph>
        <Input.TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Modal>
    </>
  );
}
