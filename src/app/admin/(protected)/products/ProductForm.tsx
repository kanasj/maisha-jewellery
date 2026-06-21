'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { Category, ProductParam } from '@/lib/types'
import { Upload, X, Loader2 } from 'lucide-react'
import Image from 'next/image'

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  metal_type: z.string().optional(),
  metal_purity: z.string().optional(),
  stone_type: z.string().optional(),
  stone_weight_ct: z.coerce.number().optional(),
  gross_weight_g: z.coerce.number().optional(),
  price_inr: z.coerce.number().optional(),
  mrp_inr: z.coerce.number().optional(),
  stock_qty: z.coerce.number().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.string().optional(),
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

export default function ProductForm({ categories, initialData, productId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [images, setImages] = useState<string[]>(initialData?.images ?? ([] as string[]))
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [params, setParams] = useState<ProductParam[]>([])
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    (initialData?.custom_fields as Record<string, unknown>) ?? {}
  )

  useEffect(() => {
    supabase
      .from('product_params')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setParams((data as ProductParam[]) ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: initialData
      ? ({ ...initialData, tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '' } as Partial<FormValues>)
      : { stock_qty: 1, is_active: true, is_featured: false },
  })

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
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

  async function onSubmit(values: FormValues) {
    setSaving(true)
    setError('')
    const payload = {
      ...values,
      category_id: values.category_id || null,
      tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      images,
      custom_fields: customFields,
    }
    const { error: err } = productId
      ? await supabase.from('products').update(payload).eq('id', productId)
      : await supabase.from('products').insert(payload)

    if (err) {
      setError(err.message)
      setSaving(false)
    } else {
      router.push('/admin/products')
      router.refresh()
    }
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
              : <Upload size={20} className="text-gray-400" />
            }
            <span className="text-xs text-gray-400 mt-1">Upload</span>
            <input type="file" multiple accept="image/*" onChange={handleFiles} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Metal Type">
          <select {...register('metal_type')} className={inputCls}>
            <option value="">— Select —</option>
            {['Gold', 'Silver', 'Platinum', 'Rose Gold'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Metal Purity">
          <input {...register('metal_purity')} placeholder="e.g. 22K, 92.5%" className={inputCls} />
        </Field>
        <Field label="Stone Type">
          <input {...register('stone_type')} placeholder="e.g. Diamond, Ruby" className={inputCls} />
        </Field>
        <Field label="Stone Weight (ct)">
          <input {...register('stone_weight_ct')} type="number" step="0.01" min="0" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Gross Weight (g)">
          <input {...register('gross_weight_g')} type="number" step="0.01" min="0" className={inputCls} />
        </Field>
        <Field label="Price (₹)">
          <input {...register('price_inr')} type="number" min="0" className={inputCls} />
        </Field>
        <Field label="MRP (₹)">
          <input {...register('mrp_inr')} type="number" min="0" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
