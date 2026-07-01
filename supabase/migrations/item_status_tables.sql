-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on customers" ON customers FOR ALL USING (true);

-- Item history table (one row per status change)
CREATE TABLE IF NOT EXISTS item_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status      TEXT NOT NULL CHECK (status IN ('in_stock', 'out_of_stock', 'on_approval')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE item_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on item_history" ON item_history FOR ALL USING (true);

-- Index for fast per-product history lookups
CREATE INDEX IF NOT EXISTS item_history_product_id_idx ON item_history(product_id, created_at DESC);
