import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = createClient()
  const [{ count: productCount }, { count: categoryCount }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div>
      <h1 className="font-cormorant text-3xl mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-md mb-10">
        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Total Products</p>
          <p className="font-cormorant text-4xl">{productCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Categories</p>
          <p className="font-cormorant text-4xl">{categoryCount ?? 0}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link href="/admin/products/new" className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-[#A07C2A] transition-colors">
          + Add Product
        </Link>
        <Link href="/" target="_blank" className="border border-gray-200 text-gray-500 text-xs tracking-widest uppercase px-6 py-3 hover:bg-gray-50 transition-colors">
          View Storefront ↗
        </Link>
      </div>
    </div>
  )
}
