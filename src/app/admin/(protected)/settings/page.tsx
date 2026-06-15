import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import { DEFAULT_SETTINGS } from '@/lib/settings'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')

  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

  const current = {
    site_name: map.site_name ?? DEFAULT_SETTINGS.site_name,
    heading_font: map.heading_font ?? DEFAULT_SETTINGS.heading_font,
    banner_1: map.banner_1 ?? '',
    banner_2: map.banner_2 ?? '',
    banner_3: map.banner_3 ?? '',
  }

  return (
    <div>
      <h1 className="font-cormorant text-3xl mb-2">Site Maintenance</h1>
      <p className="text-sm text-gray-400 mb-8">Changes apply instantly across the entire storefront.</p>
      <SettingsClient current={current} />
    </div>
  )
}
