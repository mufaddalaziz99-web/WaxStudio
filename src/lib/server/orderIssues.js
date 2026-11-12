import 'server-only';
import { many, one } from './db';
import { badRequest, notFound } from './http';
import { addHistory } from './orderHelpers';
import { ISSUE_REPORT_DAYS } from '../orderRules';

/** "Report a problem" — allowed for delivered orders within ISSUE_REPORT_DAYS of delivery. */
export async function reportIssue(orderId, input) {
  const order = await one('SELECT id, fulfillment_status, delivered_at FROM orders WHERE id = $1', [orderId]);
  if (!order) throw notFound('Order not found');
  if (order.fulfillment_status !== 'delivered') throw badRequest('You can report a problem once the order is delivered.', 'not_delivered');
  const deadline = new Date(order.delivered_at || Date.now()).getTime() + ISSUE_REPORT_DAYS * 86400_000;
  if (Date.now() > deadline) throw badRequest(`Problems must be reported within ${ISSUE_REPORT_DAYS} days of delivery. Please contact us.`, 'issue_deadline');
  const open = await one(`SELECT 1 FROM order_issues WHERE order_id = $1 AND status = 'open'`, [orderId]);
  if (open) throw badRequest('We are already looking into a problem on this order.', 'issue_open');
  const issue = await one(
    `INSERT INTO order_issues (order_id, type, description, images) VALUES ($1,$2,$3,$4) RETURNING *`,
    [orderId, input.type, input.description, JSON.stringify(input.images || [])],
  );
  await addHistory(null, orderId, 'delivered', `Problem reported: ${input.type.replace('_', ' ')}`, 'customer', false);
  return issue;
}

export async function listIssues({ status } = {}) {
  return many(
    `SELECT i.*, o.order_number, o.name, o.email, o.phone FROM order_issues i JOIN orders o ON o.id = i.order_id
     ${status ? 'WHERE i.status = $1' : ''} ORDER BY i.created_at DESC LIMIT 200`,
    status ? [status] : [],
  );
}

export async function resolveIssue(id, { status, adminNote }) {
  return one(
    `UPDATE order_issues SET status = $2, admin_note = $3, resolved_at = CASE WHEN $2 = 'open' THEN NULL ELSE now() END
     WHERE id = $1 RETURNING *`,
    [id, status, adminNote || null],
  );
}
