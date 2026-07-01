'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { Category, ProductParam } from '@/lib/types'
import { calcPrice, calcPriceBreakdown, buildPricingParams, PRICING_PARAM_KEYS, type PricingParams, type DiamondRateRow, type PriceBreakdownLine } from '@/lib/pricing'
import { Upload, X, Loader2, RefreshCw, AlertTriangle, Zap, Sparkles, ScanLine, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'

const schema = z.object({
  sku:            z.string().min(1, 'SKU is required'),
  name:           z.string().min(1, 'Name is required'),
  description:    z.string().optional(),
  category_id:    z.string().optional(),
  metal_type:     z.string().optional(),
  metal_purity:   z.string().optional(),
  diamond_weight_ct:z.coerce.number().optional(),
  gross_weight_g: z.coerce.number().optional(),
  stock_qty:      z.coerce.number().optional(),
  is_active:      z.boolean().optional(),
  is_featured:    z.boolean().optional(),
  tags:           z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface InitialData {
  images?: string[]
  tags?: string[]
  [key: string]: unknown
}

interface Props {
  categories: Category[]
  initialData?: InitialData
  productId?: string
}

const inputCls = 'w-full border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#B8973A] transition-colors rounded'

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ─── Price field with override indicator ─────────────────────────────────────
function PriceField({
  label,
  value,
  overridden,
  autoSupported,
  onChange,
  onRecalc,
  hint,
}: {
  label: string
  value: string
  overridden: boolean
  autoSupported: boolean
  onChange: (v: string) => void
  onRecalc: () => void
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs tracking-widest uppercase text-gray-500">{label}</label>
        {autoSupported && (
          overridden ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              <AlertTriangle size={9} /> Overridden
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded">
              <Zap size={9} /> Auto
            </span>
          )
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={`${inputCls} pr-8 ${overridden ? 'border-amber-300 bg-amber-50/30' : ''}`}
        />
        {overridden && autoSupported && (
          <button
            type="button"
            onClick={onRecalc}
            title="Recalculate"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#B8973A] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function ProductForm({ categories, initialData, productId }: Props) {
  const router  = useRouter()
  const supabase = createClient()

  // ── SKU generation ───────────────────────────────────────────────────────────
  const [skuGenerating, setSkuGenerating] = useState(false)
  const [skuGenError,   setSkuGenError]   = useState('')

  // ── Images ──────────────────────────────────────────────────────────────────
  const [images, setImages]       = useState<string[]>(initialData?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [imgSaveState, setImgSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const imgSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function saveImageOrder(newImages: string[]) {
    if (!productId) return
    setImgSaveState('saving')
    await supabase.from('products').update({ images: newImages }).eq('id', productId)
    setImgSaveState('saved')
    if (imgSaveTimer.current) clearTimeout(imgSaveTimer.current)
    imgSaveTimer.current = setTimeout(() => setImgSaveState('idle'), 2500)
  }

  function moveImage(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    setImages(next)
    saveImageOrder(next)
  }

  function handleDragStart(i: number) {
    setDragIndex(i)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === i) return
    const next = [...images]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(i, 0, moved)
    setImages(next)
    setDragIndex(i)
  }

  function handleDragEnd() {
    if (dragIndex !== null) saveImageOrder(images)
    setDragIndex(null)
  }

  // ── Custom fields ───────────────────────────────────────────────────────────
  const [params, setParams]         = useState<ProductParam[]>([])
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    (initialData?.custom_fields as Record<string, unknown>) ?? {}
  )


  // ── Pricing state (managed outside RHF for auto-calc control) ───────────────
  const [ogPrice, setOgPrice]   = useState<string>(String(initialData?.og_price_inr ?? ''))
  const [spPrice, setSpPrice]   = useState<string>(String(initialData?.price_inr   ?? ''))
  const [mrp, setMrp]           = useState<string>(String(initialData?.mrp_inr     ?? ''))

  const [ogOverridden, setOgOverridden] = useState<boolean>(Boolean(initialData?.price_overridden))
  const [spOverridden, setSpOverridden] = useState<boolean>(Boolean(initialData?.selling_price_overridden))

  const [ogParams, setOgParams]   = useState<PricingParams | null>(null)
  const [spParams, setSpParams]   = useState<PricingParams | null>(null)
  const [paramsLoaded, setParamsLoaded] = useState(false)
  const [diamondRates, setDiamondRates]               = useState<DiamondRateRow[]>([])
  const [diamondSpMultiplier, setDiamondSpMultiplier] = useState(2)
  const [ogBreakdown, setOgBreakdown]                 = useState<PriceBreakdownLine[]>([])

  // ── RHF ─────────────────────────────────────────────────────────────────────
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: initialData
      ? ({ ...initialData, tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '' } as Partial<FormValues>)
      : { stock_qty: 1, is_active: true, is_featured: false },
  })

  const watchedMetalType    = watch('metal_type')
  const watchedMetalPurity  = watch('metal_purity')
  const watchedGrossWeight  = watch('gross_weight_g')
  const watchedCategoryId   = watch('category_id')
  const watchedDiamondWeight = watch('diamond_weight_ct')

  // ── AI Scan state ────────────────────────────────────────────────────────────
  const [tagFile, setTagFile]           = useState<File | null>(null)
  const [tagPreview, setTagPreview]     = useState<string | null>(null)
  const [scanning, setScanning]         = useState(false)
  const [scanMsg, setScanMsg]           = useState<{ text: string; ok: boolean } | null>(null)
  const [categoryHint, setCategoryHint] = useState<string | null>(null)

  async function handleAIScan() {
    if (!tagFile) return
    setScanning(true)
    setScanMsg(null)
    setCategoryHint(null)
    try {
      const subCatOptions = params.find((p) => p.name === 'stone_category')?.options ?? []

      const fd = new FormData()
      fd.append('tag_image', tagFile)
      fd.append('categories', JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name }))))
      fd.append('subcategory_options', JSON.stringify(subCatOptions))

      const res = await fetch('/api/sku-identify', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')

      if (data.sku)          setValue('sku', data.sku)
      if (data.name)         setValue('name', data.name)
      if (data.description)  setValue('description', data.description)
      if (data.metal_type)   setValue('metal_type', data.metal_type)
      if (data.metal_purity) setValue('metal_purity', String(data.metal_purity))
      if (data.gross_weight_g  != null) setValue('gross_weight_g',  data.gross_weight_g)
      if (data.diamond_weight_ct != null) setValue('diamond_weight_ct', data.diamond_weight_ct)
      if (Array.isArray(data.tags) && data.tags.length)
        setValue('tags', (data.tags as string[]).join(', '))

      // Category — set if matched, otherwise surface the hint
      if (data.category_id) {
        setValue('category_id', data.category_id)
      } else if (data.category_hint) {
        setCategoryHint(data.category_hint)
      }

      setCustomFields((prev) => ({
        ...prev,
        ...(data.net_weight_gm        != null ? { net_weight_gm:        data.net_weight_gm }        : {}),
        ...(data.cvd_weight_ct        != null ? { cvd_weight_ct:        data.cvd_weight_ct }        : {}),
        ...(data.polki_weight_ct      != null ? { polki_weight_g:        data.polki_weight_ct }      : {}),
        ...(data.stone_details                ? { stone_details:        data.stone_details }         : {}),
        ...(data.stone_category       ? { stone_category: data.stone_category } : {}),
      }))

      if (data.og_price_inr != null) {
        setOgPrice(String(data.og_price_inr))
        setOgOverridden(true)
      }

      setScanMsg({ text: 'Fields filled — review and save.', ok: true })
    } catch (e) {
      setScanMsg({ text: e instanceof Error ? e.message : 'Scan failed', ok: false })
    } finally {
      setScanning(false)
    }
  }

  // Track whether the next price change comes from user input vs auto-fill
  const autoFillingRef = useRef(false)

  // ── Load product_params ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('product_params')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setParams((data as ProductParam[]) ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load pricing params + diamond rates ──────────────────────────────────────
  useEffect(() => {
    const settingsKeys = [
      ...PRICING_PARAM_KEYS.map((k) => `og_${k}`),
      ...PRICING_PARAM_KEYS.map((k) => `sp_${k}`),
      'diamond_sp_multiplier',
    ]
    Promise.all([
      supabase.from('site_settings').select('key, value').in('key', settingsKeys),
      supabase.from('diamond_rates').select('*'),
    ]).then(([{ data: settingsData }, { data: ratesData }]) => {
      const rows = (settingsData ?? []) as { key: string; value: string }[]
      setOgParams(buildPricingParams(rows, 'og'))
      setSpParams(buildPricingParams(rows, 'sp'))
      const mult = rows.find((r) => r.key === 'diamond_sp_multiplier')?.value
      if (mult) setDiamondSpMultiplier(parseFloat(mult) || 2)
      setDiamondRates((ratesData ?? []) as DiamondRateRow[])
      setParamsLoaded(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-calculate prices whenever inputs change ──────────────────────────────
  useEffect(() => {
    if (!paramsLoaded) return

    const fields = {
      metal_type:     watchedMetalType,
      metal_purity:   watchedMetalPurity,
      gross_weight_g: watchedGrossWeight  ? Number(watchedGrossWeight)  : undefined,
      diamond_weight_ct: watchedDiamondWeight ? Number(watchedDiamondWeight) : undefined,
      custom_fields:  customFields,
    }

    autoFillingRef.current = true

    if (!ogOverridden && ogParams) {
      const computed = calcPrice(fields, ogParams, { diamondRates, rateCol: 'og_rate' })
      if (computed !== null) setOgPrice(String(computed))
    }
    if (ogParams) {
      setOgBreakdown(calcPriceBreakdown(fields, ogParams, { diamondRates, rateCol: 'og_rate' }) ?? [])
    }

    if (!spOverridden && spParams) {
      const computed = calcPrice(fields, spParams, { diamondRates, rateCol: 'sp_rate', diamondSpMultiplier })
      if (computed !== null) {
        setSpPrice(String(computed))
        setMrp(String(Math.round(computed * 2.5)))
      }
    }

    // Small delay so state updates complete before resetting the flag
    setTimeout(() => { autoFillingRef.current = false }, 50)
  }, [watchedMetalType, watchedMetalPurity, watchedGrossWeight, watchedDiamondWeight, customFields, paramsLoaded, ogParams, spParams, ogOverridden, spOverridden, diamondRates, diamondSpMultiplier]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recalculate helpers ───────────────────────────────────────────────────────
  function recalcOg() {
    setOgOverridden(false)
  }
  function recalcSp() {
    setSpOverridden(false)
    // MRP follows SP automatically so no separate reset needed
  }

  // ── SKU generation ────────────────────────────────────────────────────────────
  function subCatCode(subCat: string): string {
    return subCat.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).join('')
  }

  function stoneCode(diamondWt: number, cvdWt: number, cf: Record<string, unknown>): string {
    const hasPolki = Object.keys(cf).some(
      (k) => k.startsWith('polki_') && parseFloat(String(cf[k] ?? '0')) > 0
    )
    const hasMoissanite = parseFloat(String(cf.moissanite_weight ?? cf.mosannite_weight ?? '0')) > 0
    const hasBD         = parseFloat(String(cf.black_diamond_weight_ct ?? cf.black_diamond ?? '0')) > 0
    const parts: string[] = []
    if (diamondWt > 0)  parts.push('D')
    if (cvdWt > 0)      parts.push('CVD')
    if (hasPolki)       parts.push('P')
    if (hasMoissanite)  parts.push('M')
    if (hasBD)          parts.push('BD')
    return parts.join('')
  }

  async function suggestSku() {
    setSkuGenError('')
    const subCat  = String(customFields.stone_category ?? '').trim()
    const catName = categories.find((c) => c.id === watchedCategoryId)?.name ?? ''

    if (!catName)  { setSkuGenError('Set Category first'); return }
    if (!subCat)   { setSkuGenError('Set Stone Category first'); return }

    const catCode = subCatCode(catName)
    const jscCode = subCatCode(subCat)
    const diamondWt = parseFloat(String(watchedDiamondWeight ?? '0')) || 0
    const cvdWt     = parseFloat(String(customFields.cvd_weight_ct ?? '0')) || 0
    const stone     = stoneCode(diamondWt, cvdWt, customFields)

    // Format: {CAT}_{JSC}_{STONE}-{NUMBER}  or  {CAT}_{JSC}-{NUMBER} if no stones
    const prefix = stone
      ? `${catCode}_${jscCode}_${stone}`
      : `${catCode}_${jscCode}`

    setSkuGenerating(true)
    const { data } = await supabase
      .from('products')
      .select('sku')
      .ilike('sku', `${prefix}-%`)

    const nums = (data ?? [])
      .map((r: { sku: string }) => { const m = r.sku.match(/-(\d+)$/); return m ? parseInt(m[1]) : 0 })
      .filter((n) => n >= 1001)

    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001
    setValue('sku', `${prefix}-${next}`)
    setSkuGenerating(false)
  }

  // ── Whether auto-calc is possible for the current metal type ─────────────────
  const metalTypeLower = (watchedMetalType ?? '').toLowerCase()
  const autoSupported  = metalTypeLower === 'gold' || metalTypeLower === 'silver' || metalTypeLower === 'rose gold'

  // ── Image upload ─────────────────────────────────────────────────────────────
  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const res  = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url as string
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map(uploadImage))
      setImages((prev) => [...prev, ...urls])
    } finally {
      setUploading(false)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setSaving(true)
    setError('')
    const payload = {
      ...values,
      category_id:              values.category_id || null,
      tags:                     values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      images,
      custom_fields:            customFields,
      og_price_inr:             ogPrice  ? Number(ogPrice)  : null,
      price_inr:                spPrice  ? Number(spPrice)  : null,
      mrp_inr:                  mrp      ? Number(mrp)      : null,
      price_overridden:         ogOverridden,
      selling_price_overridden: spOverridden,
    }
    const { error: err } = productId
      ? await supabase.from('products').update(payload).eq('id', productId)
      : await supabase.from('products').insert(payload)

    if (err) { setError(err.message); setSaving(false) }
    else { router.push('/admin/products'); router.refresh() }
  }

  // ── Custom field rendering helper ────────────────────────────────────────────
  // Renders a single custom field input by its machine name
  function renderCustomFieldInput(p: ProductParam) {
    if (p.field_type === 'text') {
      return (
        <input
          type="text"
          value={String(customFields[p.name] ?? '')}
          onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
          className={inputCls}
        />
      )
    }
    if (p.field_type === 'number') {
      return (
        <input
          type="number"
          step="any"
          value={String(customFields[p.name] ?? '')}
          onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value === '' ? '' : Number(e.target.value) }))}
          className={inputCls}
        />
      )
    }
    if (p.field_type === 'textarea') {
      return (
        <textarea
          rows={3}
          value={String(customFields[p.name] ?? '')}
          onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
          className={inputCls}
        />
      )
    }
    if (p.field_type === 'select') {
      return (
        <select
          value={String(customFields[p.name] ?? '')}
          onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
          className={inputCls}
        >
          <option value="">— Select —</option>
          {(p.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }
    if (p.field_type === 'toggle') {
      return (
        <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
          <div
            onClick={() => setCustomFields((prev) => ({ ...prev, [p.name]: !prev[p.name] }))}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${customFields[p.name] ? 'bg-[#B8973A]' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${customFields[p.name] ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-600">{customFields[p.name] ? 'Yes' : 'No'}</span>
        </label>
      )
    }
    if (p.field_type === 'date') {
      return (
        <input
          type="date"
          value={String(customFields[p.name] ?? '')}
          onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
          className={inputCls}
        />
      )
    }
    return null
  }

  // Fields pinned at the top (rendered inline, excluded from the main custom fields loop)
  const PINNED_TOP = [
    'stone_category', 'net_weight_gm', 'stone_weight_g', 'polki_weight_g',
    'cvd_weight_ct', 'cvd_color', 'cvd_clarity', 'cvd_rate_override',
    'diamond_color', 'diamond_clarity', 'diamond_rate_override',
    'stone_details',
  ]
  const pinnedMap  = Object.fromEntries(
    params.filter((p) => PINNED_TOP.includes(p.name)).map((p) => [p.name, p])
  )
  const remainingParams = params.filter((p) => !PINNED_TOP.includes(p.name))

  // Helper to render a pinned field as a grid cell (returns null if param not defined yet)
  function PinnedField({ name }: { name: string }) {
    const p = pinnedMap[name]
    if (!p) return null
    return (
      <div className={p.field_type === 'textarea' ? 'col-span-2' : ''}>
        <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">
          {p.label}{p.is_required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {renderCustomFieldInput(p)}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-8">
      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded border border-red-100">{error}</p>}

      {/* ── AI Scan Panel ── */}
      <div className="rounded-xl border border-[#B8973A]/25 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-[#FAF7F0] to-[#FDF9F3] border-b border-[#B8973A]/15">
          <Sparkles size={13} className="text-[#B8973A]" />
          <span className="text-[11px] tracking-[0.2em] uppercase font-semibold text-[#B8973A]">AI Auto-fill</span>
          <span className="text-[10px] text-[#B8973A]/50 font-normal normal-case tracking-normal">via Gemini</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400">Scan tag → fills form</span>
          </div>
        </div>

        <div className="p-5 bg-white">
          {/* Upload zone — full width, horizontal */}
          <label className={`group relative flex items-center gap-4 w-full px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
            tagFile
              ? 'border-[#B8973A]/50 bg-[#FAF7F0]'
              : 'border-gray-200 hover:border-[#B8973A]/40 hover:bg-[#FAF7F0]/50'
          }`}>
            {/* Preview or placeholder */}
            <div className="flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-[#F5F0E8] flex items-center justify-center">
              {tagPreview
                ? <img src={tagPreview} alt="tag" className="w-full h-full object-cover" />
                : <ScanLine size={20} className="text-[#B8973A]/40" />
              }
            </div>

            <div className="flex-1 min-w-0">
              {tagFile
                ? <>
                    <p className="text-sm font-medium text-gray-700 truncate">{tagFile.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{(tagFile.size / 1024).toFixed(0)} KB · click to replace</p>
                  </>
                : <>
                    <p className="text-sm text-gray-600">Upload jewellery tag photo</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">JPG, PNG, HEIC · click to browse</p>
                  </>
              }
            </div>

            {tagFile && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setTagFile(null); setTagPreview(null) }}
                className="flex-shrink-0 p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            )}

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setTagFile(f); setTagPreview(URL.createObjectURL(f)) } }}
            />
          </label>

          {/* Action row */}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              disabled={!tagFile || scanning}
              onClick={handleAIScan}
              className="flex items-center gap-2 bg-[#B8973A] text-white text-[11px] tracking-[0.15em] uppercase font-medium px-5 py-2.5 rounded-lg hover:bg-[#A07C2A] transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
            >
              {scanning
                ? <><Loader2 size={12} className="animate-spin" /> Scanning…</>
                : <><Sparkles size={12} /> Scan & Auto-fill</>
              }
            </button>

            {scanMsg && (
              <span className={`text-xs ${scanMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
                {scanMsg.ok ? '✓ ' : ''}{scanMsg.text}
              </span>
            )}
            {!tagFile && !scanMsg && (
              <span className="text-[11px] text-gray-400">Upload a tag photo first</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Images ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs tracking-widest uppercase text-gray-500">Images</label>
          {imgSaveState === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400"><Loader2 size={10} className="animate-spin" /> Saving order…</span>
          )}
          {imgSaveState === 'saved' && (
            <span className="text-[10px] text-green-600">Order saved</span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {images.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className={`relative w-24 h-24 group cursor-grab active:cursor-grabbing transition-opacity ${dragIndex === i ? 'opacity-40' : 'opacity-100'}`}
            >
              <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover rounded border border-gray-200" sizes="96px" />

              {/* Cover badge */}
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-[#B8973A]/80 text-white text-[9px] tracking-widest uppercase text-center py-0.5 rounded-b pointer-events-none">
                  Cover
                </span>
              )}

              {/* Delete */}
              <button
                type="button"
                onClick={() => {
                  const next = images.filter((_, idx) => idx !== i)
                  setImages(next)
                  saveImageOrder(next)
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X size={12} />
              </button>

              {/* Arrow buttons */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5 pb-0.5 opacity-0 group-hover:opacity-100 sm:flex transition-opacity z-10" style={i === 0 ? { bottom: '16px' } : {}}>
                <button
                  type="button"
                  onClick={() => moveImage(i, -1)}
                  disabled={i === 0}
                  className="bg-black/50 text-white rounded w-5 h-5 flex items-center justify-center disabled:opacity-0 hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(i, 1)}
                  disabled={i === images.length - 1}
                  className="bg-black/50 text-white rounded w-5 h-5 flex items-center justify-center disabled:opacity-0 hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
          <label className="w-24 h-24 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#B8973A] transition-colors rounded">
            {uploading
              ? <Loader2 size={20} className="animate-spin text-gray-400" />
              : <Upload size={20} className="text-gray-400" />}
            <span className="text-xs text-gray-400 mt-1">Upload</span>
            <input type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" disabled={uploading} />
          </label>
        </div>
        {images.length > 1 && (
          <p className="text-[10px] text-gray-400 mt-2">Drag to reorder · First image is the storefront cover</p>
        )}
      </div>

      {/* ── TOP: SKU, Category, pinned custom fields, metal fields, weights ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SKU */}
        <div>
          <Field label="SKU *" error={errors.sku?.message}>
            <input {...register('sku')} className={inputCls} />
          </Field>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={suggestSku}
              disabled={skuGenerating}
              className="flex items-center gap-1.5 text-[11px] tracking-widest uppercase text-[#B8973A] border border-[#B8973A]/40 px-2.5 py-1 rounded hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {skuGenerating ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
              Generate SKU
            </button>
            {skuGenError && <span className="text-[11px] text-red-500">{skuGenError}</span>}
          </div>
        </div>

        {/* Category */}
        <div>
          <Field label="Category">
            <select {...register('category_id')} className={inputCls}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {categoryHint && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              AI detected &ldquo;<strong>{categoryHint}</strong>&rdquo; — category not found in the list.
              Go to <span className="underline font-medium">Admin → Categories</span> to add it, then re-scan.
            </p>
          )}
        </div>

        {/* Stone Category (pinned custom field) */}
        <PinnedField name="stone_category" />

        {/* Metal Type */}
        <Field label="Metal Type">
          <select {...register('metal_type')} className={inputCls}>
            <option value="">— Select —</option>
            {['Gold', 'Silver', 'Platinum', 'Rose Gold'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>

        {/* Metal Purity */}
        <Field label="Metal Purity (K)">
          <select {...register('metal_purity')} className={inputCls}>
            <option value="">— Select —</option>
            {['9', '14', '18', '22', '24'].map((k) => (
              <option key={k} value={k}>{k}K</option>
            ))}
          </select>
        </Field>

        {/* Gross Weight */}
        <Field label="Gross Weight (g)">
          <input {...register('gross_weight_g')} type="number" step="any" min="0" className={inputCls} />
        </Field>

        {/* Net Weight (pinned custom field) */}
        <PinnedField name="net_weight_gm" />

        {/* Diamond Weight — built-in */}
        <Field label="Diamond Weight (ct)">
          <input {...register('diamond_weight_ct')} type="number" step="any" min="0" className={inputCls} />
        </Field>

        {/* Diamond color / clarity / override — pinned custom fields */}
        <PinnedField name="diamond_color" />
        <PinnedField name="diamond_clarity" />
        <PinnedField name="diamond_rate_override" />

        {/* Stone Weight in grams — custom field (stone labour only) */}
        <PinnedField name="stone_weight_g" />

        {/* Polki Weight (pinned custom field) */}
        <PinnedField name="polki_weight_g" />

        {/* CVD Weight + color / clarity / override */}
        <PinnedField name="cvd_weight_ct" />
        <PinnedField name="cvd_color" />
        <PinnedField name="cvd_clarity" />
        <PinnedField name="cvd_rate_override" />

        {/* Stone Details (pinned custom field) */}
        <PinnedField name="stone_details" />
      </div>

      {/* Remaining custom fields (not pinned at top) */}
      {remainingParams.length > 0 && (
        <div>
          <p className="text-xs tracking-widest uppercase text-gray-500 mb-4 pb-2 border-b border-gray-100">
            Custom Fields
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {remainingParams.map((p) => (
              <div key={p.id} className={p.field_type === 'textarea' ? 'col-span-2' : ''}>
                <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">
                  {p.label}{p.is_required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {renderCustomFieldInput(p)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Stock Qty">
          <input {...register('stock_qty')} type="number" min="0" className={inputCls} />
        </Field>
        <Field label="Tags (comma separated)">
          <input {...register('tags')} placeholder="bridal, gift, trending" className={inputCls} />
        </Field>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" {...register('is_active')} className="accent-[#B8973A] w-4 h-4" />
          Active (visible on store)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" {...register('is_featured')} className="accent-[#B8973A] w-4 h-4" />
          Featured on homepage
        </label>
      </div>

      {/* ── Pricing Section ────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#FAF8F5] border-b border-gray-100">
          <p className="text-xs tracking-widest uppercase text-[#B8973A] font-medium">Pricing</p>
          {autoSupported && paramsLoaded && (
            <span className="text-[11px] text-gray-400">
              Formula active for <span className="text-gray-600 font-medium">{watchedMetalType}</span>
              {watchedMetalPurity && <> · {watchedMetalPurity}</>}
            </span>
          )}
          {watchedMetalType && !autoSupported && (
            <span className="text-[11px] text-amber-600">
              No formula for {watchedMetalType} — enter prices manually
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
          <PriceField
            label="OG Price (₹)"
            value={ogPrice}
            overridden={ogOverridden}
            autoSupported={autoSupported}
            onChange={(v) => {
              if (!autoFillingRef.current) setOgOverridden(true)
              setOgPrice(v)
            }}
            onRecalc={recalcOg}
          />
          <PriceField
            label="Selling Price (₹)"
            value={spPrice}
            overridden={spOverridden}
            autoSupported={autoSupported}
            onChange={(v) => {
              if (!autoFillingRef.current) setSpOverridden(true)
              setSpPrice(v)
              // MRP follows SP unless also overridden
              if (!autoFillingRef.current) {
                const sp = parseFloat(v)
                if (!isNaN(sp)) setMrp(String(Math.round(sp * 2.5)))
              }
            }}
            onRecalc={recalcSp}
          />
          <div>
            <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">MRP (₹)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Auto = Selling Price × 2.5</p>
          </div>
        </div>

        {/* OG Price Breakdown */}
        {ogBreakdown.length > 0 && (
          <div className="mx-4 mb-4 border border-gray-100 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium">OG Price Breakdown</p>
            </div>
            <table className="w-full">
              <tbody>
                {ogBreakdown.map((line, i) => (
                  <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-3 py-1.5 text-xs text-[#1A1714]">{line.label}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-400 text-right">{line.detail}</td>
                    <td className="px-3 py-1.5 text-xs font-medium text-[#1A1714] text-right tabular-nums">
                      ₹{line.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="px-3 py-2 text-xs font-semibold text-[#B8973A]" colSpan={2}>Total OG</td>
                  <td className="px-3 py-2 text-xs font-semibold text-[#B8973A] text-right tabular-nums">
                    ₹{ogBreakdown.reduce((s, l) => s + l.amount, 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {(ogOverridden || spOverridden) && (
          <div className="mx-4 mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-700">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              {[ogOverridden && 'OG Price', spOverridden && 'Selling Price'].filter(Boolean).join(' and ')} manually overridden.
              {' '}Click <RefreshCw size={10} className="inline" /> to restore auto-calculated value.
            </span>
          </div>
        )}
      </div>

      {/* ── BOTTOM: Name, Description, buttons ── */}
      <Field label="Name *" error={errors.name?.message}>
        <input {...register('name')} className={inputCls} />
      </Field>

      <Field label="Description">
        <textarea {...register('description')} rows={4} className={inputCls} />
      </Field>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving || uploading}
          className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-8 py-3 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {productId ? 'Update Product' : 'Create Product'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-gray-200 text-gray-500 text-xs tracking-widest uppercase px-8 py-3 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
