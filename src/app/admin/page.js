'use client';
import Link from 'next/link';
import { Alert, Badge, Card, Col, Empty, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useAdmin } from './_components/hooks';
import { PageHeader, PaymentTag, QueryState, RowList, StatusTag, fmtDateTime, formatINR } from './_components/ui';

const orderColumns = [
  {
    title: 'Order',
    dataIndex: 'order_number',
    render: (v, r) => (
      <Space size={4} wrap>
        <Link href={`/admin/orders/${r.id}`}>{v}</Link>
        {r.refund_required && <Tag color="red">REFUND REQUIRED</Tag>}
        {r.is_gift && <Tag color="magenta">Gift</Tag>}
      </Space>
    ),
  },
  { title: 'Placed', dataIndex: 'created_at', render: fmtDateTime, responsive: ['md'] },
  { title: 'Customer', dataIndex: 'name', render: (v, r) => <>{v}<div style={{ fontSize: 12, color: '#8c8178' }}>{r.city}</div></> },
  { title: 'Total', dataIndex: 'total', align: 'right', render: formatINR },
  { title: 'Payment', render: (_, r) => <PaymentTag status={r.payment_status} method={r.payment_method} />, responsive: ['sm'] },
  { title: 'Status', dataIndex: 'fulfillment_status', render: (s) => <StatusTag status={s} /> },
];

function Stat({ title, revenue, orders }) {
  return (
    <Card size="small">
      <Statistic title={title} value={revenue} formatter={(v) => formatINR(v)} />
      <Typography.Text type="secondary">
        {orders} order{orders === 1 ? '' : 's'}
      </Typography.Text>
    </Card>
  );
}

function CountCard({ title, count, href, warn }) {
  const body = (
    <Card size="small" hoverable={Boolean(href)}>
      <Statistic title={title} value={count} styles={{ content: warn && count > 0 ? { color: '#cf1322' } : undefined }} />
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const q = useAdmin('/api/admin/dashboard', { refetchInterval: 60_000 });
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Revenue counts paid orders and COD orders that are not cancelled (IST days)." />
      <QueryState query={q}>
        {(d) => (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            {d.refundRequired.length > 0 && (
              <Alert
                type="error"
                showIcon
                title={`REFUND REQUIRED on ${d.refundRequired.length} order${d.refundRequired.length === 1 ? '' : 's'}`}
                description={
                  <Space wrap>
                    {d.refundRequired.map((o) => (
                      <Link key={o.id} href={`/admin/orders/${o.id}`}>
                        {o.order_number} ({formatINR(o.total)})
                      </Link>
                    ))}
                  </Space>
                }
              />
            )}
            {d.shiprocketErrors.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`Shiprocket errors on ${d.shiprocketErrors.length} order${d.shiprocketErrors.length === 1 ? '' : 's'}`}
                description={
                  <RowList
                    items={d.shiprocketErrors}
                    render={(o) => (
                      <>
                        <Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                        <Typography.Text type="secondary" ellipsis style={{ flex: 1, minWidth: 0 }}>
                          {o.shiprocket_error}
                        </Typography.Text>
                      </>
                    )}
                  />
                }
              />
            )}

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Stat title="Today" revenue={d.stats.today_revenue} orders={d.stats.today_orders} />
              </Col>
              <Col xs={24} sm={8}>
                <Stat title="Last 7 days" revenue={d.stats.week_revenue} orders={d.stats.week_orders} />
              </Col>
              <Col xs={24} sm={8}>
                <Stat title="Last 30 days" revenue={d.stats.month_revenue} orders={d.stats.month_orders} />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={12} md={8} xl={4}>
                <CountCard title="To pack" count={d.toPack.length} href="/admin/orders?status=confirmed" warn />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <CountCard title="In transit" count={d.counts.in_transit} href="/admin/orders?status=shipped" />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <CountCard title="Awaiting payment" count={d.counts.awaiting_payment} href="/admin/orders?status=placed" />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <CountCard title="Open issues" count={d.openIssues.length} href="/admin/issues" warn />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <CountCard title="Pending reviews" count={d.counts.pending_reviews} href="/admin/reviews" />
              </Col>
              <Col xs={12} md={8} xl={4}>
                <CountCard title="New messages" count={d.counts.unhandled_messages} href="/admin/messages" />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={14}>
                <Card
                  title={<Badge count={d.toPack.length} offset={[12, 0]} color="#bc6820">Confirmed — not packed yet</Badge>}
                  size="small"
                  extra={<Link href="/admin/orders?status=confirmed">All</Link>}
                >
                  <Table
                    rowKey="id"
                    size="small"
                    columns={orderColumns}
                    dataSource={d.toPack}
                    pagination={d.toPack.length > 10 ? { pageSize: 10 } : false}
                    scroll={{ x: true }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing to pack" /> }}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={10}>
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <Card title={`Low stock (below ${d.lowStockThreshold})`} size="small" extra={<Link href="/admin/products">Products</Link>}>
                    <RowList
                      items={d.lowStock}
                      rowKey={(r) => `${r.product_id}-${r.variant_id || ''}`}
                      empty={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Stock looks healthy" />}
                      render={(r) => (
                        <>
                          <Link href={`/admin/products/${r.product_id}`} style={{ flex: 1, minWidth: 0 }}>
                            {r.product_name}
                            {r.variant_name ? ` — ${r.variant_name}` : ''}
                          </Link>
                          <Tag color={r.stock <= 0 ? 'red' : 'orange'}>{r.stock <= 0 ? 'Sold out' : `${r.stock} left`}</Tag>
                        </>
                      )}
                    />
                  </Card>
                  <Card title="Open issues" size="small" extra={<Link href="/admin/issues">All</Link>}>
                    <RowList
                      items={d.openIssues}
                      empty={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No open issues" />}
                      render={(i) => (
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/admin/orders/${i.order_id}`}>
                            {i.order_number} · {i.type.replace('_', ' ')}
                          </Link>
                          <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ margin: 0 }}>
                            {i.description}
                          </Typography.Paragraph>
                        </div>
                      )}
                    />
                  </Card>
                </Space>
              </Col>
            </Row>

            <Card title="Recent orders" size="small" extra={<Link href="/admin/orders">All orders</Link>}>
              <Table rowKey="id" size="small" columns={orderColumns} dataSource={d.recent} pagination={false} scroll={{ x: true }} />
            </Card>
          </Space>
        )}
      </QueryState>
    </>
  );
}
