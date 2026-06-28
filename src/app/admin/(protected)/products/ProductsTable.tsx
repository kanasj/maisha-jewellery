'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import { Pencil, Trash2, Download, Loader2, X, ExternalLink } from 'lucide-react'

interface AdminProduct {
  id: string
  name: string
  sku: string
  images: string[]
  price_inr: number | null
  is_active: boolean
  stock_qty: number | null
  metal_type?: string | null
  metal_purity?: string | null
  custom_fields?: Record<string, unknown> | null
  categories?: { name: string } | null
}

const FILTER_FIELDS = [
  { label: 'Name',                    key: 'name',                    options: null },
  { label: 'SKU',                     key: 'sku',                     options: null },
  { label: 'Category',                key: 'category',                options: 'dynamic_category' as const },
  { label: 'Jewellery Sub Category',  key: 'jewellery_sub_category',  options: 'dynamic_jsc' as const },
  { label: 'Metal Type',              key: 'metal_type',              options: ['Gold', 'Silver', 'Platinum', 'Rose Gold'] },
  { label: 'Metal Purity',            key: 'metal_purity',            options: ['9K', '14K', '18K', '22K', '24K'] },
]

function isInStock(p: AdminProduct) {
  return p.stock_qty === null || p.stock_qty > 0
}

function ProductThumb({ product }: { product: AdminProduct }) {
  return product.images?.[0] ? (
    <div className="w-10 h-10 relative flex-shrink-0 overflow-hidden rounded">
      <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="40px" />
    </div>
  ) : (
    <div className="w-10 h-10 bg-[#F0EBE3] rounded flex items-center justify-center flex-shrink-0">
      <span className="font-cormorant text-[#B8973A]">K</span>
    </div>
  )
}

const FILTERS_KEY = 'admin_product_filters'

function readFilters() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? 'null') } catch { return null }
}

export default function ProductsTable({ initialProducts }: { initialProducts: AdminProduct[] }) {
  const [products, setProducts]       = useState(initialProducts)
  const [stockTab, setStockTab]         = useState<'in' | 'out'>(() => readFilters()?.stockTab ?? 'in')
  const [filterField, setFilterField]   = useState<string>(() => readFilters()?.filterField ?? '')
  const [filterValue, setFilterValue]   = useState<string>(() => readFilters()?.filterValue ?? '')
  const [filterField2, setFilterField2] = useState<string>(() => readFilters()?.filterField2 ?? '')
  const [filterValue2, setFilterValue2] = useState<string>(() => readFilters()?.filterValue2 ?? '')
  const [downloading, setDownloading]   = useState(false)
  const supabase = createClient()

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ stockTab, filterField, filterValue, filterField2, filterValue2 }))
    } catch {}
  }, [stockTab, filterField, filterValue, filterField2, filterValue2])

  // Unique category names derived from loaded products
  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.categories?.name).filter(Boolean) as string[])).sort(),
    [products]
  )

  // Unique jewellery sub category values from custom_fields
  const jscOptions = useMemo(
    () => Array.from(new Set(
      products.map((p) => String((p.custom_fields ?? {})['jewellery_sub_category'] ?? '')).filter(Boolean)
    )).sort(),
    [products]
  )

  // Options for the currently selected filter fields
  const activeFieldDef = FILTER_FIELDS.find((f) => f.key === filterField)
  const activeOptions: string[] | null =
    activeFieldDef?.options === 'dynamic_category' ? categoryOptions :
    activeFieldDef?.options === 'dynamic_jsc'      ? jscOptions :
    (activeFieldDef?.options as string[] | null) ?? null

  const activeFieldDef2 = FILTER_FIELDS.find((f) => f.key === filterField2)
  const activeOptions2: string[] | null =
    activeFieldDef2?.options === 'dynamic_category' ? categoryOptions :
    activeFieldDef2?.options === 'dynamic_jsc'      ? jscOptions :
    (activeFieldDef2?.options as string[] | null) ?? null

  function matchesFilter(p: AdminProduct, field: string, value: string): boolean {
    if (!field || !value) return true
    const q = value.toLowerCase()
    if (field === 'name'                   && !p.name.toLowerCase().includes(q))                                                       return false
    if (field === 'sku'                    && !p.sku.toLowerCase().includes(q))                                                        return false
    if (field === 'category'               && !(p.categories?.name ?? '').toLowerCase().includes(q))                                   return false
    if (field === 'metal_type'             && !(p.metal_type   ?? '').toLowerCase().includes(q))                                       return false
    if (field === 'metal_purity'           && !(p.metal_purity ?? '').toLowerCase().includes(q))                                       return false
    if (field === 'jewellery_sub_category' && String((p.custom_fields ?? {})['jewellery_sub_category'] ?? '').toLowerCase() !== q)     return false
    return true
  }

  // Matches both filters (AND logic) — used for tab counts and final filter
  function matchesFieldFilter(p: AdminProduct): boolean {
    return matchesFilter(p, filterField, filterValue) && matchesFilter(p, filterField2, filterValue2)
  }

  const inStockCount  = products.filter((p) =>  isInStock(p) && matchesFieldFilter(p)).length
  const outStockCount = products.filter((p) => !isInStock(p) && matchesFieldFilter(p)).length

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (stockTab === 'in'  && !isInStock(p)) return false
      if (stockTab === 'out' &&  isInStock(p)) return false
      if (!matchesFieldFilter(p)) return false
      return true
    })
  }, [products, stockTab, filterField, filterValue, filterField2, filterValue2]) // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  async function downloadExcel() {
    setDownloading(true)
    try {
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false })

      const allProducts = data ?? []
      const customKeys = Array.from(
        new Set(allProducts.flatMap((p) => Object.keys((p.custom_fields as Record<string, unknown>) ?? {})))
      ).sort()

      const rows = allProducts.map((p) => {
        const base: Record<string, unknown> = {
          'SKU':               p.sku,
          'Product Name':      p.name,
          'Description':       p.description ?? '',
          'Category':          (p.categories as { name?: string } | null)?.name ?? '',
          'Metal Type':        p.metal_type   ?? '',
          'Metal Purity':      p.metal_purity ?? '',
          'Diamond Weight (ct)': p.diamond_weight_ct ?? '',
          'Gross Weight (g)':  p.gross_weight_g  ?? '',
          'Price (INR)':       p.price_inr    ?? '',
          'MRP (INR)':         p.mrp_inr      ?? '',
          'Stock Qty':         p.stock_qty    ?? '',
          'Tags':              Array.isArray(p.tags) ? (p.tags as string[]).join(', ') : '',
          'Is Active':         p.is_active   ? 'TRUE' : 'FALSE',
          'Is Featured':       p.is_featured ? 'TRUE' : 'FALSE',
          'Product Image':     Array.isArray(p.images) ? (p.images as string[]).join(', ') : '',
        }
        const cf = (p.custom_fields as Record<string, unknown>) ?? {}
        for (const key of customKeys) base[key] = cf[key] ?? ''
        return base
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length), 10),
      }))
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `maisha-products-${date}.xlsx`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      {/* ── Stock tabs ── */}
      <div className="flex gap-1 mb-5 border border-gray-200 rounded-lg p-1 w-fit">
        <button
          onClick={() => setStockTab('in')}
          className={`px-4 py-1.5 text-xs tracking-widest uppercase rounded transition-colors ${stockTab === 'in' ? 'bg-[#B8973A] text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          In Stock <span className="ml-1 opacity-70">({inStockCount})</span>
        </button>
        <button
          onClick={() => setStockTab('out')}
          className={`px-4 py-1.5 text-xs tracking-widest uppercase rounded transition-colors ${stockTab === 'out' ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Out of Stock <span className="ml-1 opacity-70">({outStockCount})</span>
        </button>
      </div>

      {/* ── Filter + Download ── */}
      <div className="flex flex-col gap-2 mb-6">
        {/* Row 1: Filter 1 + Download */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterField}
            onChange={(e) => { setFilterField(e.target.value); setFilterValue('') }}
            className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] bg-white"
          >
            <option value="">Filter by…</option>
            {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {filterField && (
            activeOptions ? (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] bg-white"
              >
                <option value="">— All —</option>
                {activeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder={`${activeFieldDef?.label ?? ''}…`}
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="border border-gray-200 px-3 py-2 pr-7 text-sm focus:outline-none focus:border-[#B8973A] w-40"
                />
                {filterValue && (
                  <button
                    type="button"
                    onClick={() => setFilterValue('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          )}
          <button
            onClick={downloadExcel}
            disabled={downloading}
            className="flex items-center gap-2 border border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase px-5 py-2.5 hover:bg-[#B8973A] hover:text-white transition-colors disabled:opacity-50 ml-auto"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {downloading ? 'Exporting…' : 'Download Excel'}
          </button>
        </div>

        {/* Row 2: Filter 2 (always visible) */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterField2}
            onChange={(e) => { setFilterField2(e.target.value); setFilterValue2('') }}
            className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] bg-white"
          >
            <option value="">And filter by…</option>
            {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {filterField2 && (
            activeOptions2 ? (
              <select
                value={filterValue2}
                onChange={(e) => setFilterValue2(e.target.value)}
                className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] bg-white"
              >
                <option value="">— All —</option>
                {activeOptions2.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder={`${activeFieldDef2?.label ?? ''}…`}
                  value={filterValue2}
                  onChange={(e) => setFilterValue2(e.target.value)}
                  className="border border-gray-200 px-3 py-2 pr-7 text-sm focus:outline-none focus:border-[#B8973A] w-40"
                />
                {filterValue2 && (
                  <button
                    type="button"
                    onClick={() => setFilterValue2('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Mobile card list ── */}
      <div className="sm:hidden space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
            <Link href={`/product/${p.id}`} target="_blank" className="flex-shrink-0">
              <ProductThumb product={p} />
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/product/${p.id}`} target="_blank" className="font-medium text-sm text-[#1A1714] truncate hover:text-[#B8973A] transition-colors block">{p.name}</Link>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{p.sku}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${isInStock(p) ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
                  {isInStock(p) ? `${p.stock_qty ?? '∞'} in stock` : 'Out of stock'}
                </span>
                {p.price_inr && <span className="text-xs text-gray-500">{formatPrice(p.price_inr)}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link href={`/product/${p.id}`} target="_blank" className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors" title="View on storefront">
                <ExternalLink size={15} />
              </Link>
              <Link href={`/admin/products/${p.id}`} className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors">
                <Pencil size={15} />
              </Link>
              <button onClick={() => deleteProduct(p.id)} className="p-2 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No products found</div>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Product</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">SKU</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Category</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Price</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Stock</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/product/${p.id}`} target="_blank" className="flex items-center gap-3 group">
                    <ProductThumb product={p} />
                    <span className="font-medium text-[#1A1714] group-hover:text-[#B8973A] transition-colors">{p.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3 text-gray-500">{p.categories?.name ?? '—'}</td>
                <td className="px-4 py-3">{p.price_inr ? formatPrice(p.price_inr) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${isInStock(p) ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
                    {isInStock(p) ? (p.stock_qty !== null ? p.stock_qty : '∞') : 'Out of stock'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/product/${p.id}`} target="_blank" className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors" title="View on storefront">
                      <ExternalLink size={14} />
                    </Link>
                    <Link href={`/admin/products/${p.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors">
                      <Pencil size={14} />
                    </Link>
                    <button onClick={() => deleteProduct(p.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No products found</div>
        )}
      </div>
    </div>
  )
}
