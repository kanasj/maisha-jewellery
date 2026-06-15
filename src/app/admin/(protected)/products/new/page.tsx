import { createClient } from '@/lib/supabase/server'
import ProductForm from '../ProductForm'

export default async function NewProductPage() {
  const supabase = createClient()
  const { data: categories } = await supabase.from('categories').select('*').order('name')
  return (
    <div>
      <h1 className="font-cormorant text-3xl mb-8">Add Product</h1>
      <ProductForm categories={categories ?? []} />
    </div>
  )
}
