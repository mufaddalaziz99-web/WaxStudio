import 'server-only';

// Feature flags derived from environment variables. Everything except the DB is optional.
export const env = {
  get siteUrl() { return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''); },
  get hasRazorpay() { return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); },
  get hasRazorpayWebhook() { return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET); },
  get hasShiprocket() { return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD); },
  get hasGoogleMaps() { return Boolean(process.env.GOOGLE_MAPS_API_KEY); },
  get hasGoogleSignIn() { return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID); },
  get hasResend() { return Boolean(process.env.RESEND_API_KEY); },
  get hasCloudinary() {
    return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  },
  get storageDriver() {
    if (process.env.STORAGE_DRIVER) return process.env.STORAGE_DRIVER;
    return this.hasCloudinary ? 'cloudinary' : 'local';
  },
  get orderPrefix() { return process.env.ORDER_PREFIX || 'WAX'; },
  get isProd() { return process.env.NODE_ENV === 'production'; },
};
