import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import OrderDetailClient from './OrderDetailClient'

export const metadata = { title: 'Order Detail — Maisha Admin' }

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: order }, { data: events }, { data: karigars }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        order_karigars (
          id, karigar_id, assigned_at,
          karigars ( id, name )
        )
      `)
      .eq('id', params.id)
      .single(),
    supabase
      .from('order_events')
      .select('*, order_event_items(*)')
      .eq('order_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('karigars')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  if (!order) notFound()

  return (
    <OrderDetailClient
      order={order}
      events={events ?? []}
      allKarigars={karigars ?? []}
    />
  )
}
