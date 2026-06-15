import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ShopClient from './ShopClient'
import type { Category, Product } from '@/lib/types'

export default async function ShopPage() {
  const supabase = createClient()
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*, categories(name, slug)').eq('is_active', true).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
  ])

  return (
    <Suspense>
      <ShopClient products={(products as Product[]) ?? []} categories={(categories as Category[]) ?? []} />
    </Suspense>
  )
}
