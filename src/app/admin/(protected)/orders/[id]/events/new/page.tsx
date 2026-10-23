import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EventFormClient from '../EventFormClient'

export const metadata = { title: 'Log Event — Maisha Admin' }

export default async function NewEventPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_ref')
    .eq('id', params.id)
    .single()

  if (!order) notFound()

  return <EventFormClient orderId={params.id} orderRef={order.order_ref} existingEvent={null} />
}
