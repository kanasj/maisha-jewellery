import { createClient } from '@/lib/supabase/server'
import KarigarsClient from './KarigarsClient'

export const metadata = { title: 'Karigars — Maisha Admin' }

export default async function KarigarsPage() {
  const supabase = createClient()
  const { data: karigars } = await supabase
    .from('karigars')
    .select('*')
    .order('name')

  return <KarigarsClient initialKarigars={karigars ?? []} />
}
