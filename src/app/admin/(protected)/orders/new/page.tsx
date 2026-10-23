import { createClient } from '@/lib/supabase/server'
import NewOrderClient from './NewOrderClient'

export const metadata = { title: 'New Order — Maisha Admin' }

export default async function NewOrderPage() {
  const supabase = createClient()
  const { data: karigars } = await supabase
    .from('karigars')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return <NewOrderClient karigars={karigars ?? []} />
}
