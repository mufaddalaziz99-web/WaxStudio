-- Core: settings, catalog, users
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  image        TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_hidden    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE category_redirects (
  old_slug     TEXT PRIMARY KEY,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE products (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  short_description  TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  price              INTEGER NOT NULL CHECK (price >= 0),           -- whole rupees
  compare_at_price   INTEGER CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  stock              INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), -- used when product has no variants
  sku                TEXT,
  category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
  images             JSONB NOT NULL DEFAULT '[]'::jsonb,            -- array of URLs
  tags               TEXT[] NOT NULL DEFAULT '{}',
  highlights         JSONB NOT NULL DEFAULT '[]'::jsonb,            -- array of strings
  specs              JSONB NOT NULL DEFAULT '[]'::jsonb,            -- array of {label, value}
  faqs               JSONB NOT NULL DEFAULT '[]'::jsonb,            -- array of {q, a}
  how_to_use         JSONB NOT NULL DEFAULT '[]'::jsonb,            -- array of strings (steps)
  weight_grams       INTEGER,                                       -- shipping weight per unit
  length_cm          NUMERIC(6,1),
  breadth_cm         NUMERIC(6,1),
  height_cm          NUMERIC(6,1),
  hsn_code           TEXT,
  tax_rate           NUMERIC(5,2) NOT NULL DEFAULT 18,              -- % GST included in price
  max_per_order      INTEGER NOT NULL DEFAULT 10,
  is_hidden          BOOLEAN NOT NULL DEFAULT false,
  is_featured        BOOLEAN NOT NULL DEFAULT false,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  rating_avg         NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count       INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_visible_idx ON products(is_hidden, sort_order);

CREATE TABLE product_slug_redirects (
  old_slug    TEXT PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

-- Variants (size / pack / shade). Equivalent of Yarnimals' product_colors, generalised.
CREATE TABLE product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  sku               TEXT,
  price             INTEGER CHECK (price IS NULL OR price >= 0),            -- NULL => product price
  compare_at_price  INTEGER,
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  weight_grams      INTEGER,                                                 -- NULL => product weight
  image             TEXT,
  swatch            TEXT,                                                    -- optional hex colour
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_hidden         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON product_variants(product_id);

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  phone              TEXT,
  password_hash      TEXT,
  google_sub         TEXT UNIQUE,
  avatar_url         TEXT,
  email_verified_at  TIMESTAMPTZ,
  is_admin           BOOLEAN NOT NULL DEFAULT false,
  saved_cart         JSONB NOT NULL DEFAULT '[]'::jsonb,
  saved_wishlist     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE email_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      TEXT NOT NULL DEFAULT 'verify' CHECK (purpose IN ('verify','reset')),
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_verifications_user_idx ON email_verifications(user_id, purpose);

CREATE TABLE addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  line1       TEXT NOT NULL,
  line2       TEXT NOT NULL DEFAULT '',
  landmark    TEXT NOT NULL DEFAULT '',
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  pincode     TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON addresses(user_id);
