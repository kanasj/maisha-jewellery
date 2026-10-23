-- ─── Karigars ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS karigars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE karigars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access on karigars" ON karigars FOR ALL USING (true);

-- ─── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref           TEXT NOT NULL UNIQUE,
  reference_photo_url TEXT,
  status              TEXT NOT NULL DEFAULT 'started'
                        CHECK (status IN ('started','in_progress','completed','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access on orders" ON orders FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

-- ─── Order ↔ Karigar (many-to-many) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_karigars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  karigar_id  UUID NOT NULL REFERENCES karigars(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id, karigar_id)
);

ALTER TABLE order_karigars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access on order_karigars" ON order_karigars FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS order_karigars_order_idx   ON order_karigars(order_id);
CREATE INDEX IF NOT EXISTS order_karigars_karigar_idx ON order_karigars(karigar_id);

-- ─── Order Events ─────────────────────────────────────────────────────────────
-- event_type values:
--   order_created     — auto on order creation
--   material_movement — manual send/receive of materials
--   karigar_added     — auto when a karigar is assigned (initial or later)
--   status_changed    — auto on every status change
--   order_completed   — auto when status → completed
--   note_added        — manual free-text note with no materials
CREATE TABLE IF NOT EXISTS order_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
                  'order_created','material_movement','karigar_added',
                  'status_changed','order_completed','note_added'
                )),
  direction    TEXT CHECK (direction IN ('send','receive')),  -- only for material_movement
  meta         JSONB,          -- stores extra info: status transitions, karigar name etc.
  notes        TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT false,  -- system events cannot be deleted
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access on order_events" ON order_events FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id, created_at ASC);

-- ─── Order Event Items (line items within a material_movement event) ───────────
CREATE TABLE IF NOT EXISTS order_event_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES order_events(id) ON DELETE CASCADE,
  material          TEXT NOT NULL CHECK (material IN (
                      'diamond','stone','cvd','gold','silver','other'
                    )),
  other_label       TEXT,             -- only when material = 'other'
  quantity_count    INTEGER,
  weight_g          NUMERIC(10,3),    -- grams (gold, silver, stone)
  weight_ct         NUMERIC(10,3),    -- carats (diamond, cvd)
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_event_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access on order_event_items" ON order_event_items FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS order_event_items_event_idx ON order_event_items(event_id);

-- ─── Auto-update orders.updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_updated_at_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_orders_updated_at();
