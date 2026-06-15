// Server-only — do not import in client components
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/settings-shared'

export { AVAILABLE_FONTS, DEFAULT_SETTINGS, getFontUrl } from '@/lib/settings-shared'
export type { AvailableFont, SiteSettings } from '@/lib/settings-shared'

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = createClient()
    const { data } = await supabase.from('site_settings').select('key, value')
    if (!data?.length) return DEFAULT_SETTINGS
    const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
    return {
      site_name: map.site_name ?? DEFAULT_SETTINGS.site_name,
      heading_font: map.heading_font ?? DEFAULT_SETTINGS.heading_font,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}
