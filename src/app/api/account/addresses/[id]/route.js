import { z } from 'zod';
import { route, readJson, notFound } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { savedAddressSchema } from '@/lib/validation';
import { deleteAddress, updateAddress } from '@/lib/server/accounts';

export const dynamic = 'force-dynamic';

async function addressId(params) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw notFound('Address not found');
  return id;
}

// PATCH /api/account/addresses/[id] — the full address (savedAddressSchema), or { isDefault: true } alone.
export const PATCH = route(async (req, { params }) => {
  const user = await requireUser();
  const id = await addressId(params);
  const raw = await readJson(req);
  const onlyDefault = raw && typeof raw === 'object' && Object.keys(raw).length === 1 && raw.isDefault === true;
  const body = onlyDefault ? { isDefault: true } : savedAddressSchema.parse(raw);
  return { address: await updateAddress(user.id, id, body) };
});

// DELETE /api/account/addresses/[id] -> { ok: true } (the newest remaining address becomes default if needed)
export const DELETE = route(async (req, { params }) => {
  const user = await requireUser();
  const id = await addressId(params);
  return deleteAddress(user.id, id);
});
