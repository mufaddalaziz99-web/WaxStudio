'use client';
import { useState } from 'react';
import { Button, Card, Segmented, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, UndoOutlined } from '@ant-design/icons';
import { api, useAdmin, useRunner } from '../_components/hooks';
import { PageHeader, QueryState, fmtDateTime } from '../_components/ui';

export default function MessagesPage() {
  const [filter, setFilter] = useState('false');
  const q = useAdmin(`/api/admin/messages${filter === 'all' ? '' : `?handled=${filter}`}`);
  const { run, busy } = useRunner();

  const columns = [
    {
      title: 'From',
      width: 260,
      render: (_, m) => (
        <div>
          <strong>{m.name}</strong>
          <div>
            <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message')}`}>{m.email}</a>
          </div>
          {m.phone && (
            <div>
              <a href={`tel:+91${m.phone}`}>{m.phone}</a> ·{' '}
              <a href={`https://wa.me/91${m.phone}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {fmtDateTime(m.created_at)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Message',
      render: (_, m) => (
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0, maxWidth: 640 }} ellipsis={{ rows: 5, expandable: true, symbol: 'more' }}>
          {m.message}
        </Typography.Paragraph>
      ),
    },
    {
      title: '',
      align: 'right',
      width: 150,
      render: (_, m) => (
        <Space orientation="vertical" align="end" size={4}>
          {m.handled ? <Tag color="green">Handled</Tag> : <Tag color="gold">New</Tag>}
          <Button
            size="small"
            icon={m.handled ? <UndoOutlined /> : <CheckOutlined />}
            loading={busy === m.id}
            onClick={() =>
              run(m.id, () => api(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { handled: !m.handled } }), m.handled ? 'Marked as new' : 'Marked as handled')
            }
          >
            {m.handled ? 'Mark new' : 'Mark handled'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Contact form submissions"
        extra={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'false', label: 'New' },
              { value: 'true', label: 'Handled' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      <QueryState query={q}>
        {(d) => (
          <Card size="small">
            <Table rowKey="id" columns={columns} dataSource={d.messages} scroll={{ x: 760 }} pagination={{ pageSize: 25, hideOnSinglePage: true }} />
          </Card>
        )}
      </QueryState>
    </>
  );
}
