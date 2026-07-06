import { createClient } from '@/lib/supabase/server'
import ItemStatusClient from './ItemStatusClient'

export default async function ItemStatusPage() {
  const supabase = createClient()
  const [{ data: products }, { data: customers }, { data: params }, { data: settings }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, images, stock_qty, is_active, metal_type, metal_purity, price_inr, gross_weight_g, diamond_weight_ct, custom_fields, categories!left(name)')
      .order('name', { ascending: true }),
    supabase.from('customers').select('id, name, notes').order('name', { ascending: true }),
    supabase.from('product_params').select('name, visible_on_storefront'),
    supabase.from('site_settings').select('key, value').in('key', ['show_metal', 'show_stone', 'show_gross_weight']),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalised = (products ?? []).map((p: any) => ({
    ...p,
    categories: Array.isArray(p.categories) ? (p.categories[0] ?? null) : (p.categories ?? null),
  }))

  const visibleCustomParams = (params ?? [])
    .filter((p) => p.visible_on_storefront)
    .map((p) => p.name as string)

  const settingsMap = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]))
  const builtinVisibility = {
    show_metal:        settingsMap['show_metal']        !== 'false',
    show_stone:        settingsMap['show_stone']        !== 'false',
    show_gross_weight: settingsMap['show_gross_weight'] !== 'false',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-cormorant text-3xl text-[#1A1714]">Item Status</h1>
        <p className="text-sm text-gray-400 mt-1">Select products and update their stock status</p>
      </div>
      <ItemStatusClient
        initialProducts={normalised}
        initialCustomers={customers ?? []}
        visibleCustomParams={visibleCustomParams}
        builtinVisibility={builtinVisibility}
      />
    </div>
  )
}
