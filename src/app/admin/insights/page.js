'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, Col, Empty, Progress, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { useAdmin } from '../_components/hooks';
import { PageHeader, QueryState } from '../_components/ui';

const pct = (n) => `${n}%`;
const emptyText = (t) => ({ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t} /> });

function Funnel({ f }) {
  const max = Math.max(f.views, 1);
  const rows = [
    { label: 'Product views', value: f.views, note: null },
    { label: 'Added to cart', value: f.add_to_cart, note: `${f.viewToCart}% of views` },
    { label: 'Purchased (units)', value: f.purchases, note: `${f.cartToPurchase}% of add-to-carts · ${f.viewToPurchase}% of views` },
  ];
  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={12}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong>{r.label}</strong>
            <span>
              {r.value.toLocaleString('en-IN')}
              {r.note && <Typography.Text type="secondary"> · {r.note}</Typography.Text>}
            </span>
          </div>
          <Progress percent={Math.round((r.value / max) * 100)} showInfo={false} strokeColor="#bc6820" />
        </div>
      ))}
    </Space>
  );
}

function InsightsView({ d }) {
  const productColumns = [
    { title: 'Product', render: (_, p) => <Link href={`/admin/products/${p.id}`}>{p.name}</Link> },
    { title: 'Views', dataIndex: 'views', align: 'right', sorter: (a, b) => a.views - b.views, defaultSortOrder: 'descend' },
    { title: 'Add to cart', dataIndex: 'add_to_cart', align: 'right', sorter: (a, b) => a.add_to_cart - b.add_to_cart },
    { title: 'Purchased', dataIndex: 'purchases', align: 'right', sorter: (a, b) => a.purchases - b.purchases },
    { title: 'Cart rate', dataIndex: 'cartRate', align: 'right', render: pct, sorter: (a, b) => a.cartRate - b.cartRate },
    { title: 'Conversion', dataIndex: 'conversion', align: 'right', render: pct, sorter: (a, b) => a.conversion - b.conversion },
  ];
  const dailyColumns = [
    { title: 'Day', dataIndex: 'day' },
    { title: 'Views', dataIndex: 'views', align: 'right' },
    { title: 'Add to cart', dataIndex: 'add_to_cart', align: 'right' },
    { title: 'Purchased', dataIndex: 'purchases', align: 'right' },
  ];
  const searchColumns = [
    { title: 'Search', dataIndex: 'query', render: (v) => <Typography.Text code>{v}</Typography.Text> },
    { title: 'Searches', dataIndex: 'count', align: 'right' },
    { title: 'Avg results', dataIndex: 'avg_results', align: 'right' },
    { title: 'No results', dataIndex: 'zero_results', align: 'right', render: (n) => (n ? <Tag color="red">{n}</Tag> : 0) },
  ];
  const pincodeColumns = [
    { title: 'Pincode', dataIndex: 'pincode' },
    { title: 'Checks', dataIndex: 'checks', align: 'right' },
    { title: 'At checkout', dataIndex: 'at_checkout', align: 'right' },
    {
      title: 'Serviceable',
      align: 'right',
      render: (_, p) =>
        p.unserviceable ? <Tag color="red">No ({p.unserviceable})</Tag> : p.ever_serviceable ? <Tag color="green">Yes</Tag> : <Tag>Unknown</Tag>,
    },
  ];
  const counterColumns = [{ title: 'Day', dataIndex: 'day', fixed: 'left' }, ...d.counterKeys.map((k) => ({ title: k, dataIndex: k, align: 'right', render: (v) => v ?? 0 }))];

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Product views" value={d.funnel.views} />
            <Typography.Text type="secondary">Last {d.days} days</Typography.Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Add to cart" value={d.funnel.add_to_cart} />
            <Typography.Text type="secondary">{d.funnel.viewToCart}% of views</Typography.Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Units purchased" value={d.funnel.purchases} />
            <Typography.Text type="secondary">{d.funnel.viewToPurchase}% of views</Typography.Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Unserviceable pincode checks" value={d.pincodeTotals.unserviceablePct} suffix="%" />
            <Typography.Text type="secondary">
              {d.pincodeTotals.unserviceable} of {d.pincodeTotals.known} checks · {d.pincodeTotals.distinct_pincodes} pincodes
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card size="small" title="Funnel">
            <Funnel f={d.funnel} />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title="Products">
            <Table rowKey="id" size="small" columns={productColumns} dataSource={d.products} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 560 }} locale={emptyText('No product activity yet')} />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Tabs
          items={[
            {
              key: 'search',
              label: `Searches (${d.searchTotals.total})`,
              children: (
                <>
                  <Typography.Paragraph type="secondary">
                    {d.searchTotals.zero} of {d.searchTotals.total} searches ({d.searchTotals.zeroPct}%) found nothing — consider adding those words as product tags.
                  </Typography.Paragraph>
                  <Table rowKey="query" size="small" columns={searchColumns} dataSource={d.searches} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 480 }} locale={emptyText('No searches yet')} />
                </>
              ),
            },
            {
              key: 'pincodes',
              label: `Pincode demand (${d.pincodeTotals.total})`,
              children: (
                <Table rowKey="pincode" size="small" columns={pincodeColumns} dataSource={d.pincodes} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 480 }} locale={emptyText('No pincode checks yet')} />
              ),
            },
            {
              key: 'daily',
              label: 'Daily product activity',
              children: (
                <Table rowKey="day" size="small" columns={dailyColumns} dataSource={d.daily} pagination={{ pageSize: 31, hideOnSinglePage: true }} scroll={{ x: 400 }} locale={emptyText('No activity yet')} />
              ),
            },
            {
              key: 'counters',
              label: 'Counters',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 12 }}>
                    {d.counters.map((c) => (
                      <Tag key={c.key}>
                        {c.key}: <strong>{c.count}</strong>
                      </Tag>
                    ))}
                  </Space>
                  <Table rowKey="day" size="small" columns={counterColumns} dataSource={d.counterDaily} pagination={{ pageSize: 31, hideOnSinglePage: true }} scroll={{ x: true }} locale={emptyText('No counters yet')} />
                </>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

export default function InsightsPage() {
  const [days, setDays] = useState(30);
  const q = useAdmin(`/api/admin/insights?days=${days}`, { placeholderData: (prev) => prev });
  return (
    <>
      <PageHeader
        title="Insights"
        subtitle={`Last ${days} days`}
        extra={
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
            ]}
          />
        }
      />
      <QueryState query={q}>{(d) => <InsightsView d={d} />}</QueryState>
    </>
  );
}
