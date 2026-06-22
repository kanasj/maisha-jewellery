'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { Category, ProductParam } from '@/lib/types'
import { calcPrice, buildPricingParams, PRICING_PARAM_KEYS, type PricingParams } from '@/lib/pricing'
import { Upload, X, Loader2, RefreshCw, AlertTriangle, Zap } from 'lucide-react'
import Image from 'next/image'

const schema = z.object({
  sku:            z.string().min(1, 'SKU is required'),
  name:           z.string().min(1, 'Name is required'),
  description:    z.string().optional(),
  category_id:    z.string().optional(),
  metal_type:     z.string().optional(),
  metal_purity:   z.string().optional(),
  stone_weight_ct:z.coerce.number().optional(),
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

  // ── Images ──────────────────────────────────────────────────────────────────
  const [images, setImages]     = useState<string[]>(initialData?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

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

  // ── RHF ─────────────────────────────────────────────────────────────────────
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: initialData
      ? ({ ...initialData, tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '' } as Partial<FormValues>)
      : { stock_qty: 1, is_active: true, is_featured: false },
  })

  const watchedMetalType    = watch('metal_type')
  const watchedMetalPurity  = watch('metal_purity')
  const watchedGrossWeight  = watch('gross_weight_g')
  const watchedStoneWeight  = watch('stone_weight_ct')

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

  // ── Load pricing params from site_settings ───────────────────────────────────
  useEffect(() => {
    const keys = [
      ...PRICING_PARAM_KEYS.map((k) => `og_${k}`),
      ...PRICING_PARAM_KEYS.map((k) => `sp_${k}`),
    ]
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', keys)
      .then(({ data }) => {
        const rows = (data ?? []) as { key: string; value: string }[]
        setOgParams(buildPricingParams(rows, 'og'))
        setSpParams(buildPricingParams(rows, 'sp'))
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
      stone_weight_ct: watchedStoneWeight ? Number(watchedStoneWeight) : undefined,
      custom_fields:  customFields,
    }

    autoFillingRef.current = true

    if (!ogOverridden && ogParams) {
      const computed = calcPrice(fields, ogParams)
      if (computed !== null) setOgPrice(String(computed))
    }

    if (!spOverridden && spParams) {
      const computed = calcPrice(fields, spParams)
      if (computed !== null) {
        setSpPrice(String(computed))
        setMrp(String(Math.round(computed * 2.5)))
      }
    }

    // Small delay so state updates complete before resetting the flag
    setTimeout(() => { autoFillingRef.current = false }, 50)
  }, [watchedMetalType, watchedMetalPurity, watchedGrossWeight, watchedStoneWeight, customFields, paramsLoaded, ogParams, spParams, ogOverridden, spOverridden]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recalculate helpers ───────────────────────────────────────────────────────
  function recalcOg() {
    setOgOverridden(false)
  }
  function recalcSp() {
    setSpOverridden(false)
    // MRP follows SP automatically so no separate reset needed
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-8">
      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded border border-red-100">{error}</p>}

      {/* Images */}
      <div>
        <label className="text-xs tracking-widest uppercase text-gray-500 block mb-3">Images</label>
        <div className="flex flex-wrap gap-3">
          {images.map((url, i) => (
            <div key={i} className="relative w-24 h-24 group">
              <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover rounded border border-gray-200" sizes="96px" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="SKU *" error={errors.sku?.message}>
          <input {...register('sku')} className={inputCls} />
        </Field>
        <Field label="Name *" error={errors.name?.message}>
          <input {...register('name')} className={inputCls} />
        </Field>
      </div>

      <Field label="Description">
        <textarea {...register('description')} rows={4} className={inputCls} />
      </Field>

      <Field label="Category">
        <select {...register('category_id')} className={inputCls}>
          <option value="">— None —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Metal Type">
          <select {...register('metal_type')} className={inputCls}>
            <option value="">— Select —</option>
            {['Gold', 'Silver', 'Platinum', 'Rose Gold'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Metal Purity (K)">
          <select {...register('metal_purity')} className={inputCls}>
            <option value="">— Select —</option>
            {['9', '14', '18', '22', '24'].map((k) => (
              <option key={k} value={k}>{k}K</option>
            ))}
          </select>
        </Field>
        <Field label="Diamond Weight (ct)">
          <input {...register('stone_weight_ct')} type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label="Gross Weight (g)">
          <input {...register('gross_weight_g')} type="number" step="0.01" min="0" className={inputCls} />
        </Field>
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

      {/* Custom Fields */}
      {params.length > 0 && (
        <div>
          <p className="text-xs tracking-widest uppercase text-gray-500 mb-4 pb-2 border-b border-gray-100">
            Custom Fields
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {params.map((p) => (
              <div key={p.id} className={p.field_type === 'textarea' ? 'col-span-2' : ''}>
                <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">
                  {p.label}{p.is_required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {p.field_type === 'text' && (
                  <input
                    type="text"
                    value={String(customFields[p.name] ?? '')}
                    onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    className={inputCls}
                  />
                )}
                {p.field_type === 'number' && (
                  <input
                    type="number"
                    step="any"
                    value={String(customFields[p.name] ?? '')}
                    onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className={inputCls}
                  />
                )}
                {p.field_type === 'textarea' && (
                  <textarea
                    rows={3}
                    value={String(customFields[p.name] ?? '')}
                    onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    className={inputCls}
                  />
                )}
                {p.field_type === 'select' && (
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
                )}
                {p.field_type === 'toggle' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                    <div
                      onClick={() => setCustomFields((prev) => ({ ...prev, [p.name]: !prev[p.name] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${customFields[p.name] ? 'bg-[#B8973A]' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${customFields[p.name] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-gray-600">{customFields[p.name] ? 'Yes' : 'No'}</span>
                  </label>
                )}
                {p.field_type === 'date' && (
                  <input
                    type="date"
                    value={String(customFields[p.name] ?? '')}
                    onChange={(e) => setCustomFields((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    className={inputCls}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
