import { route } from '@/lib/server/http';
import { env } from '@/lib/server/env';
import { getSettings, publicSettings } from '@/lib/server/settings';
import { getSessionUser } from '@/lib/server/auth';
import { many } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// What the checkout needs: enabled payment methods, public settings, saved addresses.
export const GET = route(async () => {
  const settings = await getSettings();
  const user = await getSessionUser();
  const addresses = user
    ? await many(
        `SELECT id, name, phone, email, line1, line2, landmark, city, state, pincode, is_default
         FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
        [user.id],
      )
    : [];
  return {
    razorpayEnabled: env.hasRazorpay,
    codEnabled: Boolean(settings.payments.codEnabled),
    addressSearch: env.hasGoogleMaps,
    pincodeLookup: env.hasShiprocket,
    settings: publicSettings(settings),
    user: user ? { name: user.name, email: user.email, phone: user.phone } : null,
    addresses,
  };
});
