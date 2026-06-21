import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetail from './ProductDetail'
import type { ProductParam } from '@/lib/types'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: product }, { data: productParams }] = await Promise.all([
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
  ])

  if (!product) notFound()
  return <ProductDetail product={product} productParams={(productParams as ProductParam[]) ?? []} />
}
