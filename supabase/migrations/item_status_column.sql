-- Add item_status column to products (replaces the stock_qty=-1 hack)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS item_status text NOT NULL DEFAULT 'in_stock'
  CHECK (item_status IN ('in_stock', 'out_of_stock', 'on_approval', 'partial_approval'));

-- Backfill from old encoding
UPDATE products SET item_status = 'on_approval',  stock_qty = 0 WHERE stock_qty = -1;
UPDATE products SET item_status = 'out_of_stock'               WHERE stock_qty = 0 AND item_status = 'in_stock';
-- stock_qty >= 1 already defaults to 'in_stock', no action needed

-- Add qty_changed to item_history for piece-level audit trail
ALTER TABLE item_history
  ADD COLUMN IF NOT EXISTS qty_changed integer;
