import { createClient } from '@/lib/supabase/server'
import CategoriesClient from './CategoriesClient'

export default async function CategoriesPage() {
  const supabase = createClient()
  const { data: categories } = await supabase.from('categories').select('*').order('name')
  return (
    <div>
      <h1 className="font-cormorant text-3xl mb-8">Categories</h1>
      <CategoriesClient initialCategories={categories ?? []} />
    </div>
  )
}
