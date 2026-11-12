-- Coupons, orders, payments, shipping
CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  type              TEXT NOT NULL CHECK (type IN ('percent','flat')),
  value             INTEGER NOT NULL CHECK (value > 0),
  max_discount      INTEGER,                         -- cap for percent coupons
  min_order         INTEGER NOT NULL DEFAULT 0,      -- items total threshold
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  usage_limit       INTEGER,                         -- NULL => unlimited
  used_count        INTEGER NOT NULL DEFAULT 0,
  first_order_only  BOOLEAN NOT NULL DEFAULT false,
  show_on_site      BOOLEAN NOT NULL DEFAULT false,  -- shown as a site-wide offer card
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coupons_code_upper_idx ON coupons (upper(code));

CREATE SEQUENCE order_number_seq START 1001;

CREATE TABLE orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            TEXT NOT NULL UNIQUE,
  client_request_id       UUID NOT NULL UNIQUE,
  user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  email                   TEXT NOT NULL,
  phone                   TEXT NOT NULL,
  shipping_address        JSONB NOT NULL,
  items_total             INTEGER NOT NULL,
  discount                INTEGER NOT NULL DEFAULT 0,
  coupon_id               UUID REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code             TEXT,
  shipping_fee            INTEGER NOT NULL DEFAULT 0,
  cod_fee                 INTEGER NOT NULL DEFAULT 0,
  gift_wrap_fee           INTEGER NOT NULL DEFAULT 0,
  total                   INTEGER NOT NULL,
  payment_method          TEXT NOT NULL CHECK (payment_method IN ('razorpay','cod')),
  payment_status          TEXT NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
  fulfillment_status      TEXT NOT NULL DEFAULT 'placed'
                          CHECK (fulfillment_status IN ('placed','confirmed','packed','shipped','out_for_delivery','delivered','cancelled')),
  expired                 BOOLEAN NOT NULL DEFAULT false,
  refund_required         BOOLEAN NOT NULL DEFAULT false,
  cancel_reason           TEXT,
  cancelled_by            TEXT,
  cancelled_at            TIMESTAMPTZ,
  razorpay_order_id       TEXT UNIQUE,
  razorpay_payment_id     TEXT,
  razorpay_signature      TEXT,
  paid_at                 TIMESTAMPTZ,
  shipping_option_id      TEXT NOT NULL,
  shipping_option         JSONB NOT NULL DEFAULT '{}'::jsonb,
  shiprocket_courier_id   INTEGER,
  shiprocket_order_id     TEXT,
  shiprocket_shipment_id  TEXT,
  awb_code                TEXT,
  courier_name            TEXT,
  tracking_url            TEXT,
  label_url               TEXT,
  pickup_scheduled_at     TIMESTAMPTZ,
  shiprocket_error        TEXT,
  is_gift                 BOOLEAN NOT NULL DEFAULT false,
  gift_wrap               BOOLEAN NOT NULL DEFAULT false,
  gift_message            TEXT,
  customer_note           TEXT,
  admin_note              TEXT,
  customer_emailed_at     TIMESTAMPTZ,
  shop_emailed_at         TIMESTAMPTZ,
  cancel_emailed_at       TIMESTAMPTZ,
  payment_failed_emailed_at TIMESTAMPTZ,
  shipped_emailed_at      TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  review_token            UUID NOT NULL DEFAULT gen_random_uuid(),
  review_requested_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders(user_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders(fulfillment_status, payment_status, created_at);
CREATE INDEX orders_email_idx ON orders(lower(email));
CREATE INDEX orders_phone_idx ON orders(phone);
CREATE INDEX orders_awb_idx ON orders(awb_code);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id    UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,        -- snapshot
  variant_name  TEXT,                 -- snapshot
  image         TEXT,                 -- snapshot
  sku           TEXT,                 -- snapshot
  hsn_code      TEXT,
  tax_rate      NUMERIC(5,2) NOT NULL DEFAULT 0,
  price         INTEGER NOT NULL,     -- unit price snapshot
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    INTEGER NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_product_idx ON order_items(product_id);

CREATE TABLE order_status_history (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  actor       TEXT NOT NULL DEFAULT 'system',  -- system | customer | admin | webhook | courier
  is_public   BOOLEAN NOT NULL DEFAULT true,   -- shown on the customer's timeline
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history(order_id, created_at);

CREATE TABLE refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount              INTEGER NOT NULL CHECK (amount > 0),
  razorpay_refund_id  TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','failed')),
  reason              TEXT,
  is_manual           BOOLEAN NOT NULL DEFAULT false,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON refunds(order_id);

CREATE TABLE shipment_events (
  id           BIGSERIAL PRIMARY KEY,
  order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
  awb          TEXT,
  status       TEXT,          -- our mapped step, NULL if not mapped
  raw_status   TEXT NOT NULL,
  location     TEXT,
  event_time   TIMESTAMPTZ,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shipment_events_order_idx ON shipment_events(order_id, created_at);
CREATE UNIQUE INDEX shipment_events_dedupe_idx ON shipment_events(awb, raw_status, event_time);
