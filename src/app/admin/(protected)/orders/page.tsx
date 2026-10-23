import { createClient } from '@/lib/supabase/server'
import OrdersClient from './OrdersClient'

export const metadata = { title: 'Orders — Maisha Admin' }

export default async function OrdersPage() {
  const supabase = createClient()

  const [{ data: orders }, { data: karigars }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        order_karigars (
          id, karigar_id, assigned_at,
          karigars ( id, name, is_active )
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('karigars')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <OrdersClient
      initialOrders={orders ?? []}
      karigars={karigars ?? []}
    />
  )
}
