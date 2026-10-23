import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditOrderClient from './EditOrderClient'

export const metadata = { title: 'Edit Order — Maisha Admin' }

export default async function EditOrderPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: order }, { data: karigars }] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_karigars(id, karigar_id, assigned_at, karigars(id, name))')
      .eq('id', params.id)
      .single(),
    supabase
      .from('karigars')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  if (!order) notFound()

  return <EditOrderClient order={order} allKarigars={karigars ?? []} />
}
