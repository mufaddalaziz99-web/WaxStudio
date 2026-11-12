-- Richer product-page content (inspired by D2C grooming PDPs) — all editable in Admin → Products.
ALTER TABLE products
  ADD COLUMN tagline      TEXT NOT NULL DEFAULT '',            -- one-liner under the title
  ADD COLUMN badge        TEXT,                                -- e.g. "Bestseller", "New"
  ADD COLUMN rated_for    TEXT[] NOT NULL DEFAULT '{}',        -- "Highly rated for: Volume, Matte finish"
  ADD COLUMN claims       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ticked attributes, e.g. ["Matte finish", "No grease"]
  ADD COLUMN ingredients  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ name, benefit }]
  ADD COLUMN free_from    JSONB NOT NULL DEFAULT '[]'::jsonb;  -- ["Parabens", "Sulphates", ...]

ALTER TABLE product_variants
  ADD COLUMN badge TEXT;                                       -- e.g. "Best value", "Most popular"
