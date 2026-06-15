'use client'
import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { AVAILABLE_FONTS, getFontUrl, type AvailableFont } from '@/lib/settings-shared'
import { Loader2, CheckCircle, Upload, X, ImageIcon } from 'lucide-react'

interface Props {
  current: {
    site_name: string
    heading_font: string
    banner_1: string
    banner_2: string
    banner_3: string
  }
}

type Tab = 'general' | 'banners'

export default function SettingsClient({ current }: Props) {
  const [tab, setTab] = useState<Tab>('general')

  // General
  const [siteName, setSiteName] = useState(current.site_name)
  const [font, setFont] = useState<AvailableFont>(current.heading_font as AvailableFont)

  // Banners
  const [banners, setBanners] = useState<[string, string, string]>([
    current.banner_1,
    current.banner_2,
    current.banner_3,
  ])
  const [uploading, setUploading] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    setSaved(false)
    await supabase.from('site_settings').upsert(
      [
        { key: 'site_name', value: siteName },
        { key: 'heading_font', value: font },
        { key: 'banner_1', value: banners[0] },
        { key: 'banner_2', value: banners[1] },
        { key: 'banner_3', value: banners[2] },
      ],
      { onConflict: 'key' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function uploadBanner(index: number, file: File) {
    setUploading(index)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    const newBanners = [...banners] as [string, string, string]
    newBanners[index] = data.url
    setBanners(newBanners)
    setUploading(null)
  }

  function clearBanner(index: number) {
    const newBanners = [...banners] as [string, string, string]
    newBanners[index] = ''
    setBanners(newBanners)
  }

  return (
    <div className="max-w-2xl">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8">
        {([['general', 'General'], ['banners', 'Hero Banners']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-6 py-3 text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-[#B8973A] text-[#B8973A]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {tab === 'general' && (
        <div className="space-y-8">
          {/* Site Name */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-xs tracking-widest uppercase text-gray-500 mb-1">Site Name</p>
            <p className="text-xs text-gray-400 mb-4">Appears in the navbar, footer, and browser tab.</p>
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#B8973A] rounded"
              placeholder="e.g. Maisha Jewellery"
            />
            <p className="text-sm text-gray-300 mt-3" style={{ fontFamily: `'${font}', serif` }}>
              Preview: {siteName}
            </p>
          </div>

          {/* Font Picker */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-xs tracking-widest uppercase text-gray-500 mb-1">Heading Font</p>
            <p className="text-xs text-gray-400 mb-5">Applied to all headings and the site name.</p>
            {AVAILABLE_FONTS.map((f) => (
              <link key={f} rel="stylesheet" href={getFontUrl(f)} />
            ))}
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFont(f)}
                  className={`border-2 rounded-lg px-4 py-4 text-left transition-all ${
                    font === f ? 'border-[#B8973A] bg-amber-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <p className="text-xs tracking-widest uppercase text-gray-400 mb-2">{f}</p>
                  <p className="text-2xl text-[#1A1714] leading-tight" style={{ fontFamily: `'${f}', serif` }}>
                    Maisha Jewellery
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Banners Tab */}
      {tab === 'banners' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
            Upload up to 3 banner images. They will auto-rotate on the homepage every 5 seconds.
            Best size: <strong>1920 × 1080px</strong> or wider. The Mughal-style poster image works perfectly here.
          </div>

          {(['Banner 1', 'Banner 2', 'Banner 3'] as const).map((label, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs tracking-widest uppercase text-gray-500">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{i === 0 ? 'Primary banner (shown first)' : `Slide ${i + 1}`}</p>
                </div>
                {banners[i] && (
                  <button
                    onClick={() => clearBanner(i)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X size={12} /> Remove
                  </button>
                )}
              </div>

              {banners[i] ? (
                <div className="relative w-full aspect-video rounded overflow-hidden border border-gray-100">
                  <Image
                    src={banners[i]}
                    alt={label}
                    fill
                    className="object-cover"
                    sizes="600px"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <label className="cursor-pointer flex items-center gap-2 bg-white/90 text-xs tracking-widest uppercase px-4 py-2 rounded">
                      <Upload size={12} />
                      Replace
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadBanner(i, e.target.files[0])}
                      />
                    </label>
                  </div>
                  {uploading === i && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading === i ? 'border-[#B8973A] bg-amber-50' : 'border-gray-200 hover:border-[#B8973A] hover:bg-amber-50/30'}`}>
                  {uploading === i ? (
                    <Loader2 size={28} className="animate-spin text-[#B8973A] mb-2" />
                  ) : (
                    <ImageIcon size={28} className="text-gray-300 mb-2" />
                  )}
                  <p className="text-sm text-gray-400">
                    {uploading === i ? 'Uploading…' : 'Click to upload image'}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => e.target.files?.[0] && uploadBanner(i, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={save}
          disabled={saving || uploading !== null}
          className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-8 py-3 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle size={16} />
            Saved! Refresh the storefront to see changes.
          </span>
        )}
      </div>
    </div>
  )
}
