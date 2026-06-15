import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ProductsTable from './ProductsTable'

export default async function AdminProductsPage() {
  const supabase = createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-cormorant text-3xl">Products</h1>
        <Link
          href="/admin/products/new"
          className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-[#A07C2A] transition-colors"
        >
          + Add Product
        </Link>
      </div>
      <ProductsTable initialProducts={products ?? []} />
    </div>
  )
}
