// Zod schemas shared by client forms and server handlers, so rules cannot drift apart.
import { z } from 'zod';
import { GIFT_MESSAGE_MAX, MAX_CART_LINES, MAX_QTY_PER_LINE, PHONE_RE, PINCODE_RE } from './rules';

const trimmed = (max, label) =>
  z.string().trim().min(1, { error: `${label} is required` }).max(max, { error: `${label} is too long` });

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: 'Enter a valid email' }));
export const phoneSchema = z
  .string()
  .transform((v) => String(v).replace(/\D/g, '').slice(-10))
  .pipe(z.string().regex(PHONE_RE, { error: 'Enter a valid 10-digit mobile number' }));
export const pincodeSchema = z.string().trim().regex(PINCODE_RE, { error: 'Enter a valid 6-digit pincode' });

export const addressSchema = z.object({
  name: trimmed(80, 'Name'),
  phone: phoneSchema,
  email: emailSchema,
  line1: trimmed(160, 'Address line 1'),
  line2: z.string().trim().max(160).optional().default(''),
  landmark: z.string().trim().max(120).optional().default(''),
  city: trimmed(80, 'City'),
  state: trimmed(80, 'State'),
  pincode: pincodeSchema,
});

export const savedAddressSchema = addressSchema.extend({
  email: emailSchema.optional().or(z.literal('')),
  isDefault: z.boolean().optional().default(false),
});

export const cartItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable().optional().default(null),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const cartItemsSchema = z.array(cartItemSchema).min(1, { error: 'Your cart is empty' }).max(MAX_CART_LINES);

export const shippingQuoteSchema = z.object({
  pincode: pincodeSchema,
  items: cartItemsSchema,
});

export const placeOrderSchema = z.object({
  clientRequestId: z.uuid(),
  items: cartItemsSchema,
  address: addressSchema,
  shippingOptionId: z.string().trim().min(1).max(60),
  paymentMethod: z.enum(['razorpay', 'cod']),
  couponCode: z.string().trim().max(40).optional().nullable(),
  gift: z
    .object({
      isGift: z.boolean().default(false),
      wrap: z.boolean().default(false),
      message: z.string().trim().max(GIFT_MESSAGE_MAX).optional().default(''),
    })
    .optional()
    .default({ isGift: false, wrap: false, message: '' }),
  note: z.string().trim().max(300).optional().default(''),
  saveAddress: z.boolean().optional().default(false),
});

export const couponCheckSchema = z.object({
  code: z.string().trim().min(1).max(40),
  itemsTotal: z.number().int().min(0),
  email: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
});

export const verifyPaymentSchema = z.object({
  orderId: z.uuid(),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// ---- Auth ----
export const passwordSchema = z.string().min(8, { error: 'Use at least 8 characters' }).max(128);
export const signupSchema = z.object({
  name: trimmed(80, 'Name'),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const verifyCodeSchema = z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/, { error: 'Enter the 6-digit code' }) });
export const emailOnlySchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/), password: passwordSchema });
export const profileSchema = z.object({
  name: trimmed(80, 'Name'),
  phone: z.union([phoneSchema, z.literal('')]).optional(),
});

// ---- Customer actions ----
export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(3).max(30).transform((v) => v.toUpperCase()),
  phone: phoneSchema,
});
export const cancelOrderSchema = z.object({ reason: trimmed(300, 'Reason') });
export const issueSchema = z.object({
  type: z.enum(['damaged', 'wrong_item', 'missing_item', 'quality', 'other']),
  description: trimmed(1000, 'Description'),
  images: z.array(z.string().max(500)).max(5).optional().default([]),
});
export const reviewSchema = z.object({
  productId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  name: trimmed(60, 'Name'),
  email: emailSchema.optional().or(z.literal('')),
  title: z.string().trim().max(100).optional().default(''),
  body: z.string().trim().min(10, { error: 'Tell us a bit more (10+ characters)' }).max(2000),
  images: z.array(z.string().max(500)).max(4).optional().default([]),
  token: z.uuid().optional(), // review_token from a review-request email => verified
});
export const stockAlertSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable().optional(),
  email: emailSchema,
});
export const contactSchema = z.object({
  name: trimmed(80, 'Name'),
  email: emailSchema,
  phone: z.union([phoneSchema, z.literal('')]).optional(),
  message: trimmed(2000, 'Message'),
});
export const pincodeCheckSchema = z.object({ pincode: pincodeSchema, productId: z.uuid().optional() });

// ---- Account: cart + wishlist mirrored to the signed-in user (AccountSync) ----
export const savedCartLineSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable().optional().default(null),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  name: z.string().max(200).nullish(),
  variantName: z.string().max(100).nullish(),
  slug: z.string().max(120).nullish(),
  price: z.number().min(0).nullish(),
  image: z.string().max(500).nullish(),
  maxQty: z.number().int().min(0).max(1000).nullish(),
});
export const savedItemsSchema = z.object({
  cart: z.array(savedCartLineSchema).max(MAX_CART_LINES).optional(),
  wishlist: z.array(z.uuid()).max(100).optional(),
});
export const googleCredentialSchema = z.object({ credential: z.string().min(20).max(8192) });

// ---- Admin ----
const optionalInt = z.union([z.number().int().min(0), z.null()]).optional();
export const variantInputSchema = z.object({
  id: z.uuid().optional(),
  name: trimmed(60, 'Variant name'),
  sku: z.string().trim().max(60).optional().nullable(),
  price: optionalInt,
  compare_at_price: optionalInt,
  stock: z.number().int().min(0),
  weight_grams: optionalInt,
  image: z.string().max(500).optional().nullable(),
  swatch: z.string().max(20).optional().nullable(),
  badge: z.string().trim().max(30).optional().nullable(),
  sort_order: z.number().int().optional().default(0),
  is_hidden: z.boolean().optional().default(false),
});
export const productInputSchema = z.object({
  name: trimmed(160, 'Name'),
  slug: z.string().trim().max(90).optional(),
  short_description: z.string().trim().max(400).default(''),
  description: z.string().trim().max(10000).default(''),
  price: z.number().int().min(0),
  compare_at_price: optionalInt,
  stock: z.number().int().min(0).default(0),
  sku: z.string().trim().max(60).optional().nullable(),
  category_id: z.uuid().nullable().optional(),
  images: z.array(z.string().max(500)).max(12).default([]),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  highlights: z.array(z.string().trim().max(200)).max(12).default([]),
  specs: z.array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(200) })).max(20).default([]),
  faqs: z.array(z.object({ q: z.string().trim().max(200), a: z.string().trim().max(1000) })).max(20).default([]),
  how_to_use: z.array(z.string().trim().max(300)).max(12).default([]),
  tagline: z.string().trim().max(160).default(''),
  badge: z.string().trim().max(30).nullable().optional(),
  rated_for: z.array(z.string().trim().max(40)).max(6).default([]),
  claims: z.array(z.string().trim().max(60)).max(8).default([]),
  ingredients: z.array(z.object({ name: z.string().trim().max(80), benefit: z.string().trim().max(300) })).max(12).default([]),
  free_from: z.array(z.string().trim().max(40)).max(8).default([]),
  weight_grams: optionalInt,
  length_cm: z.number().min(0).nullable().optional(),
  breadth_cm: z.number().min(0).nullable().optional(),
  height_cm: z.number().min(0).nullable().optional(),
  hsn_code: z.string().trim().max(20).optional().nullable(),
  tax_rate: z.number().min(0).max(28).default(18),
  max_per_order: z.number().int().min(1).max(50).default(10),
  is_hidden: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  variants: z.array(variantInputSchema).max(30).default([]),
});
export const categoryInputSchema = z.object({
  name: trimmed(80, 'Name'),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().max(1000).default(''),
  image: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().default(0),
  is_hidden: z.boolean().default(false),
});
export const couponInputSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, { error: 'Letters, digits, - and _ only' }).transform((v) => v.toUpperCase()),
  description: z.string().trim().max(200).default(''),
  type: z.enum(['percent', 'flat']),
  value: z.number().int().min(1),
  max_discount: optionalInt,
  min_order: z.number().int().min(0).default(0),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  usage_limit: optionalInt,
  first_order_only: z.boolean().default(false),
  show_on_site: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export const adminStatusSchema = z.object({
  status: z.enum(['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered']),
  note: z.string().trim().max(300).optional().default(''),
});
export const adminCancelSchema = z.object({
  reason: trimmed(300, 'Reason'),
  refund: z.boolean().default(true),
  restock: z.boolean().default(true),
});
export const refundInputSchema = z.object({
  amount: z.number().int().min(1),
  reason: z.string().trim().max(300).default(''),
  manual: z.boolean().default(false),
});
// Admin order edits: private note and/or manually entered tracking (no Shiprocket).
export const adminOrderPatchSchema = z.object({
  admin_note: z.string().trim().max(2000).nullable().optional(),
  courier_name: z.string().trim().max(80).nullable().optional(),
  awb_code: z.string().trim().max(60).nullable().optional(),
  tracking_url: z.union([z.url().max(500), z.literal('')]).nullable().optional(),
});
export const adminShiprocketSchema = z.object({ action: z.enum(['push', 'awb', 'label', 'pickup']) });
export const adminReviewSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  adminReply: z.string().trim().max(1000).nullable().optional(),
});
export const adminIssueSchema = z.object({
  status: z.enum(['open', 'resolved', 'rejected']),
  adminNote: z.string().trim().max(1000).optional().default(''),
});
export const adminProductToggleSchema = z.object({
  is_hidden: z.boolean().optional(),
  is_featured: z.boolean().optional(),
});
