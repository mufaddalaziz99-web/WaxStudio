import { after } from 'next/server';
import { route, readJson, rateLimit } from '@/lib/server/http';
import { contactSchema } from '@/lib/validation';
import { one } from '@/lib/server/db';
import { sendContactNotification } from '@/lib/server/orderEmails';

export const dynamic = 'force-dynamic';

// POST /api/contact { name, email, phone?, message } -> { ok: true }
export const POST = route(async (req) => {
  rateLimit(req, 'contact', 5, 10 * 60_000);
  const body = contactSchema.parse(await readJson(req));
  const msg = { name: body.name, email: body.email, phone: body.phone || null, message: body.message };
  await one(
    'INSERT INTO contact_messages (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING id',
    [msg.name, msg.email, msg.phone, msg.message],
  );
  after(() => sendContactNotification(msg).catch((e) => console.error('[contact] notify failed', e.message)));
  return { ok: true };
});
