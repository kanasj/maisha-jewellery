import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EventFormClient from '../../EventFormClient'

export const metadata = { title: 'Edit Event — Maisha Admin' }

export default async function EditEventPage({ params }: { params: { id: string; eventId: string } }) {
  const supabase = createClient()

  const [{ data: order }, { data: event }] = await Promise.all([
    supabase.from('orders').select('id, order_ref').eq('id', params.id).single(),
    supabase.from('order_events').select('*, order_event_items(*)').eq('id', params.eventId).single(),
  ])

  if (!order || !event) notFound()
  if (event.is_system) notFound() // system events cannot be edited

  return (
    <EventFormClient
      orderId={params.id}
      orderRef={order.order_ref}
      existingEvent={event}
    />
  )
}
