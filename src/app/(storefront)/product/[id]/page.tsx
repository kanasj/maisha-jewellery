import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetail from './ProductDetail'
import type { ProductParam } from '@/lib/types'
import { BUILTIN_SPEC_FIELDS } from '@/lib/types'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: product }, { data: productParams }, { data: settingsData }] = await Promise.all([
    supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('id', params.id)
      .eq('is_active', true)
      .single(),
    supabase
      .from('product_params')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', BUILTIN_SPEC_FIELDS.map((f) => f.key)),
  ])

  if (!product) notFound()

  const settingsMap = Object.fromEntries(
    (settingsData ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
  )
  const builtinVisibility = {
    show_metal:        settingsMap.show_metal        !== 'false',
    show_stone:        settingsMap.show_stone        !== 'false',
    show_gross_weight: settingsMap.show_gross_weight !== 'false',
  }

  return (
    <ProductDetail
      product={product}
      productParams={(productParams as ProductParam[]) ?? []}
      builtinVisibility={builtinVisibility}
    />
  )
}
