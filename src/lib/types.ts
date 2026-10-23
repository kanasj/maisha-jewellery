export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  image_url: string | null
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category_id: string | null
  metal_type: string | null
  metal_purity: string | null
  stone_type: string | null
  diamond_weight_ct: number | null
  gross_weight_g: number | null
  og_price_inr: number | null
  price_inr: number | null
  mrp_inr: number | null
  price_overridden: boolean
  selling_price_overridden: boolean
  stock_qty: number
  is_active: boolean
  images: string[]
  tags: string[]
  is_featured: boolean
  custom_fields: Record<string, unknown>
  created_at: string
  categories?: Category
}

export type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'toggle' | 'date'

export interface ProductParam {
  id: string
  name: string
  label: string
  field_type: FieldType
  options: string[] | null
  is_required: boolean
  visible_on_storefront: boolean
  sort_order: number
  created_at: string
}

// ─── Order Management ─────────────────────────────────────────────────────────

export interface Karigar {
  id: string
  name: string
  phone: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export type OrderStatus = 'started' | 'in_progress' | 'completed' | 'cancelled'

export interface Order {
  id: string
  order_ref: string
  reference_photo_url: string | null
  status: OrderStatus
  notes: string | null
  created_at: string
  updated_at: string
  order_karigars?: OrderKarigar[]
}

export interface OrderKarigar {
  id: string
  order_id: string
  karigar_id: string
  assigned_at: string
  karigars?: Karigar
}

export type OrderEventType =
  | 'order_created'
  | 'material_movement'
  | 'karigar_added'
  | 'status_changed'
  | 'order_completed'
  | 'note_added'

export type MaterialDirection = 'send' | 'receive'

export type MaterialType = 'diamond' | 'stone' | 'cvd' | 'gold' | 'silver' | 'other'

export interface OrderEvent {
  id: string
  order_id: string
  event_type: OrderEventType
  direction: MaterialDirection | null
  meta: Record<string, unknown> | null
  notes: string | null
  is_system: boolean
  created_at: string
  order_event_items?: OrderEventItem[]
}

export interface OrderEventItem {
  id: string
  event_id: string
  material: MaterialType
  other_label: string | null
  quantity_count: number | null
  weight_g: number | null
  weight_ct: number | null
}

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  diamond: 'Diamond',
  stone: 'Stone',
  cvd: 'CVD',
  gold: 'Gold',
  silver: 'Silver',
  other: 'Other',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  started: 'Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  started: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

// ─────────────────────────────────────────────────────────────────────────────

export const BUILTIN_SPEC_FIELDS = [
  { key: 'show_metal',        label: 'Metal Type & Purity' },
  { key: 'show_stone',        label: 'Diamond Weight (ct)' },
  { key: 'show_gross_weight', label: 'Gross Weight (g)' },
] as const

export type BuiltinFieldKey = typeof BUILTIN_SPEC_FIELDS[number]['key']
