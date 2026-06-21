export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
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
  stone_weight_ct: number | null
  gross_weight_g: number | null
  price_inr: number | null
  mrp_inr: number | null
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
  sort_order: number
  created_at: string
}
