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

export const BUILTIN_SPEC_FIELDS = [
  { key: 'show_metal',        label: 'Metal Type & Purity' },
  { key: 'show_stone',        label: 'Diamond Weight (ct)' },
  { key: 'show_gross_weight', label: 'Gross Weight (g)' },
] as const

export type BuiltinFieldKey = typeof BUILTIN_SPEC_FIELDS[number]['key']
