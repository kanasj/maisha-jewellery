-- Step 1: Copy custom_fields.diamond_weight_ct → stone_weight_ct
-- for products where the built-in column is null/0 but custom field has a value
UPDATE products
SET stone_weight_ct = (custom_fields->>'diamond_weight_ct')::numeric
WHERE
  (custom_fields->>'diamond_weight_ct') IS NOT NULL
  AND (custom_fields->>'diamond_weight_ct') != ''
  AND (custom_fields->>'diamond_weight_ct')::numeric > 0
  AND (stone_weight_ct IS NULL OR stone_weight_ct = 0);

-- Step 2: Remove diamond_weight_ct from custom_fields (no longer needed)
UPDATE products
SET custom_fields = custom_fields - 'diamond_weight_ct'
WHERE custom_fields ? 'diamond_weight_ct';

-- Step 3: Rename the column
ALTER TABLE products RENAME COLUMN stone_weight_ct TO diamond_weight_ct;
