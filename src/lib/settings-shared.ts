// Shared constants — safe to import in both server and client components

export const AVAILABLE_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'EB Garamond',
  'Cinzel',
  'Libre Baskerville',
  'Italiana',
] as const

export type AvailableFont = (typeof AVAILABLE_FONTS)[number]

export interface SiteSettings {
  site_name: string
  heading_font: AvailableFont
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'Maisha Jewellery',
  heading_font: 'Cormorant Garamond',
}

export function getFontUrl(font: string): string {
  const family = font.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`
}
