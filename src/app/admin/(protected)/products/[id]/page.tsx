import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductForm from '../ProductForm'

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).single(),
    supabase.from('categories').select('*').order('name'),
  ])
  if (!product) notFound()
  return (
    <div>
      <h1 className="font-cormorant text-3xl mb-8">Edit: {product.name}</h1>
      <ProductForm categories={categories ?? []} initialData={product} productId={params.id} />
    </div>
  )
}
