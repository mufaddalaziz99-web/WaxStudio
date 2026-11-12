-- Reviews, alerts, issues, contact, insights
CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  email        TEXT,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title        TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  images       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  admin_reply  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_idx ON reviews(product_id, status, created_at DESC);
CREATE UNIQUE INDEX reviews_order_product_idx ON reviews(order_id, product_id) WHERE order_id IS NOT NULL;

CREATE TABLE stock_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id   UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stock_alerts_unique_idx
  ON stock_alerts(product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email))
  WHERE notified_at IS NULL;

CREATE TABLE order_issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('damaged','wrong_item','missing_item','quality','other')),
  description  TEXT NOT NULL,
  images       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX order_issues_status_idx ON order_issues(status, created_at DESC);

CREATE TABLE contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  handled     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insights
CREATE TABLE search_events (
  id             BIGSERIAL PRIMARY KEY,
  query          TEXT NOT NULL,
  results_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX search_events_created_idx ON search_events(created_at DESC);

CREATE TABLE product_stats_daily (
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  views        INTEGER NOT NULL DEFAULT 0,
  add_to_cart  INTEGER NOT NULL DEFAULT 0,
  purchases    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);

CREATE TABLE pincode_checks (
  id           BIGSERIAL PRIMARY KEY,
  pincode      TEXT NOT NULL,
  serviceable  BOOLEAN,
  source       TEXT NOT NULL DEFAULT 'product',  -- product | checkout
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pincode_checks_created_idx ON pincode_checks(created_at DESC);

CREATE TABLE daily_counters (
  day    DATE NOT NULL,
  key    TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);
