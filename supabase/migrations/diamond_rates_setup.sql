-- ── 1. Create diamond_rates table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diamond_rates (
  type    TEXT NOT NULL,
  color   TEXT NOT NULL,
  clarity TEXT NOT NULL,
  og_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  sp_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (type, color, clarity)
);

-- RLS: public read, authenticated write
ALTER TABLE diamond_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read diamond_rates"  ON diamond_rates FOR SELECT USING (true);
CREATE POLICY "Auth write diamond_rates"   ON diamond_rates FOR ALL USING (auth.role() = 'authenticated');

-- ── 2. Seed initial rates ─────────────────────────────────────────────────────
INSERT INTO diamond_rates (type, color, clarity, og_rate, sp_rate) VALUES
-- Diamond rates
('Diamond','D','VVS',40000,0),('Diamond','D','VS',35000,0),('Diamond','D','VS2',35000,0),('Diamond','D','VVS2',35000,0),('Diamond','D','SI',30000,0),('Diamond','D','SI2',30000,0),
('Diamond','E','VVS',30000,0),('Diamond','E','VS',30000,0),('Diamond','E','VS2',30000,0),('Diamond','E','VVS2',30000,0),('Diamond','E','SI',25000,0),('Diamond','E','SI2',25000,0),
('Diamond','F','VVS',35000,0),('Diamond','F','VS',35000,0),('Diamond','F','VS2',35000,0),('Diamond','F','VVS2',35000,0),('Diamond','F','SI',30000,0),('Diamond','F','SI2',30000,0),
('Diamond','G','VVS',30000,0),('Diamond','G','VS',25000,0),('Diamond','G','VS2',25000,0),('Diamond','G','VVS2',25000,0),('Diamond','G','SI',23000,0),('Diamond','G','SI2',23000,0),
('Diamond','H','VVS',21000,0),('Diamond','H','VS',21000,0),('Diamond','H','VS2',21000,0),('Diamond','H','VVS2',21000,0),('Diamond','H','SI',19000,0),('Diamond','H','SI2',19000,0),
('Diamond','I','VVS',16000,0),('Diamond','I','VS',16000,0),('Diamond','I','VS2',16000,0),('Diamond','I','VVS2',15000,0),('Diamond','I','SI',15000,0),('Diamond','I','SI2',15000,0),
('Diamond','J','VVS',14000,0),('Diamond','J','VS',14000,0),('Diamond','J','VS2',14000,0),('Diamond','J','VVS2',14000,0),('Diamond','J','SI',14000,0),('Diamond','J','SI2',14000,0),
('Diamond','K','VVS',13000,0),('Diamond','K','VS',13000,0),('Diamond','K','VS2',13000,0),('Diamond','K','VVS2',13000,0),('Diamond','K','SI',13000,0),('Diamond','K','SI2',13000,0),
('Diamond','L','VVS',12000,0),('Diamond','L','VS',12000,0),('Diamond','L','VS2',12000,0),('Diamond','L','VVS2',12000,0),('Diamond','L','SI',12000,0),('Diamond','L','SI2',12000,0),
('Diamond','M','VVS',10000,0),('Diamond','M','VS',10000,0),('Diamond','M','VS2',10000,0),('Diamond','M','VVS2',10000,0),('Diamond','M','SI',10000,0),('Diamond','M','SI2',10000,0),
-- CVD rates
('CVD','D','VVS',12000,0),('CVD','D','VS',12000,0),('CVD','D','VS2',12000,0),('CVD','D','VVS2',12000,0),('CVD','D','SI',12000,0),('CVD','D','SI2',12000,0),
('CVD','E','VVS',10000,0),('CVD','E','VS',10000,0),('CVD','E','VS2',10000,0),('CVD','E','VVS2',10000,0),('CVD','E','SI',10000,0),('CVD','E','SI2',10000,0),
('CVD','F','VVS',10000,0),('CVD','F','VS',10000,0),('CVD','F','VS2',10000,0),('CVD','F','VVS2',10000,0),('CVD','F','SI',10000,0),('CVD','F','SI2',10000,0),
('CVD','G','VVS',6000,0),('CVD','G','VS',6000,0),('CVD','G','VS2',6000,0),('CVD','G','VVS2',6000,0),('CVD','G','SI',6000,0),('CVD','G','SI2',6000,0),
('CVD','H','VVS',6000,0),('CVD','H','VS',6000,0),('CVD','H','VS2',6000,0),('CVD','H','VVS2',6000,0),('CVD','H','SI',6000,0),('CVD','H','SI2',6000,0),
('CVD','I','VVS',6000,0),('CVD','I','VS',6000,0),('CVD','I','VS2',6000,0),('CVD','I','VVS2',6000,0),('CVD','I','SI',6000,0),('CVD','I','SI2',6000,0),
('CVD','J','VVS',5000,0),('CVD','J','VS',5000,0),('CVD','J','VS2',5000,0),('CVD','J','VVS2',5000,0),('CVD','J','SI',5000,0),('CVD','J','SI2',5000,0),
('CVD','K','VVS',5000,0),('CVD','K','VS',5000,0),('CVD','K','VS2',5000,0),('CVD','K','VVS2',5000,0),('CVD','K','SI',5000,0),('CVD','K','SI2',5000,0),
('CVD','L','VVS',5000,0),('CVD','L','VS',5000,0),('CVD','L','VS2',5000,0),('CVD','L','VVS2',5000,0),('CVD','L','SI',5000,0),('CVD','L','SI2',5000,0),
('CVD','M','VVS',5000,0),('CVD','M','VS',5000,0),('CVD','M','VS2',5000,0),('CVD','M','VVS2',5000,0),('CVD','M','SI',5000,0),('CVD','M','SI2',5000,0)
ON CONFLICT (type, color, clarity) DO NOTHING;

-- ── 3. Write J/VS defaults to existing products with diamond weight ────────────
UPDATE products
SET custom_fields = custom_fields ||
  jsonb_build_object('diamond_color', 'J', 'diamond_clarity', 'VS')
WHERE diamond_weight_ct IS NOT NULL
  AND diamond_weight_ct > 0
  AND (custom_fields->>'diamond_color' IS NULL OR custom_fields->>'diamond_color' = '');

-- ── 4. Write J/VS defaults to existing products with CVD weight ───────────────
UPDATE products
SET custom_fields = custom_fields ||
  jsonb_build_object('cvd_color', 'J', 'cvd_clarity', 'VS')
WHERE (custom_fields->>'cvd_weight_ct') IS NOT NULL
  AND (custom_fields->>'cvd_weight_ct')::numeric > 0
  AND (custom_fields->>'cvd_color' IS NULL OR custom_fields->>'cvd_color' = '');

-- ── 5. Insert product_params for diamond/CVD color, clarity, rate override ────
INSERT INTO product_params (name, label, field_type, options, is_required, visible_on_storefront, sort_order)
VALUES
  ('diamond_color',         'Diamond Color',          'select', ARRAY['D','E','F','G','H','I','J','K','L','M'], false, false, 100),
  ('diamond_clarity',       'Diamond Clarity',        'select', ARRAY['VVS','VS','VS2','VVS2','SI','SI2'],       false, false, 101),
  ('diamond_rate_override', 'Diamond Rate Override',  'number', NULL,                                             false, false, 102),
  ('cvd_color',             'CVD Color',              'select', ARRAY['D','E','F','G','H','I','J','K','L','M'], false, false, 103),
  ('cvd_clarity',           'CVD Clarity',            'select', ARRAY['VVS','VS','VS2','VVS2','SI','SI2'],       false, false, 104),
  ('cvd_rate_override',     'CVD Rate Override',      'number', NULL,                                             false, false, 105)
ON CONFLICT (name) DO NOTHING;
