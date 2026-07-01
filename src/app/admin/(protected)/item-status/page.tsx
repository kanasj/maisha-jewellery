import { createClient } from '@/lib/supabase/server'
import ItemStatusClient from './ItemStatusClient'

export default async function ItemStatusPage() {
  const supabase = createClient()
  const [{ data: products }, { data: customers }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, images, stock_qty, is_active, metal_type, metal_purity, custom_fields, categories!left(name)')
      .order('name', { ascending: true }),
    supabase.from('customers').select('id, name, notes').order('name', { ascending: true }),
  ])

  // Supabase returns categories as array from join; normalise to object | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalised = (products ?? []).map((p: any) => ({
    ...p,
    categories: Array.isArray(p.categories) ? (p.categories[0] ?? null) : (p.categories ?? null),
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-cormorant text-3xl text-[#1A1714]">Item Status</h1>
        <p className="text-sm text-gray-400 mt-1">Select products and update their stock status</p>
      </div>
      <ItemStatusClient
        initialProducts={normalised}
        initialCustomers={customers ?? []}
      />
    </div>
  )
}
