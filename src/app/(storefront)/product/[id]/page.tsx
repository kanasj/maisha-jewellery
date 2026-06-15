import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetail from './ProductDetail'

export default async function ProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (!product) notFound()
  return <ProductDetail product={product} />
}
