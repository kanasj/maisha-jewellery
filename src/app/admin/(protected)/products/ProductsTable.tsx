'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import { Pencil, Trash2, Download, Loader2, X, ExternalLink, BookOpen } from 'lucide-react'

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
  gross_weight_g?: number | null
  diamond_weight_ct?: number | null
  custom_fields?: Record<string, unknown> | null
  categories?: { name: string } | null
}

const FILTER_FIELDS = [
  { label: 'Name',             key: 'name',            options: null },
  { label: 'SKU',              key: 'sku',             options: null },
  { label: 'Category',         key: 'category',        options: 'dynamic_category' as const },
  { label: 'Stone Category',   key: 'stone_category',  options: 'dynamic_jsc' as const },
  { label: 'Metal Type',       key: 'metal_type',      options: ['Gold', 'Silver', 'Platinum', 'Rose Gold'] },
  { label: 'Metal Purity',     key: 'metal_purity',    options: ['9K', '14K', '18K', '22K', '24K'] },
  { label: 'Net Weight (g)',   key: 'net_weight_gm',   options: 'range' as const },
  { label: 'Gross Weight (g)', key: 'gross_weight_g',  options: 'range' as const },
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

function RangeInputs({ min, max, onMin, onMax, onClear }: {
  min: string; max: string
  onMin: (v: string) => void; onMax: (v: string) => void; onClear: () => void
}) {
  const cls = 'border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] w-28'
  return (
    <div className="flex items-center gap-2">
      <input type="number" placeholder="Min (g)" value={min} onChange={(e) => onMin(e.target.value)} className={cls} min={0} step="0.01" />
      <span className="text-gray-400 text-xs">–</span>
      <input type="number" placeholder="Max (g)" value={max} onChange={(e) => onMax(e.target.value)} className={cls} min={0} step="0.01" />
      {(min || max) && (
        <button type="button" onClick={onClear} className="text-gray-300 hover:text-gray-500">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function readFilters() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? 'null') } catch { return null }
}

function getWeightValue(p: { custom_fields?: Record<string, unknown> | null; gross_weight_g?: number | null }, field: string): number | null {
  if (field === 'net_weight_gm') {
    const raw = parseFloat(String((p.custom_fields ?? {})['net_weight_gm'] ?? ''))
    return isNaN(raw) ? null : raw
  }
  if (field === 'gross_weight_g') {
    const raw = parseFloat(String(p.gross_weight_g ?? ''))
    return isNaN(raw) ? null : raw
  }
  return null
}

// ─── Catalog PDF ─────────────────────────────────────────────────────────────

interface CatalogImageInfo { dataUrl: string; width: number; height: number }

async function fetchCatalogImage(url: string): Promise<CatalogImageInfo | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image()
      img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = dataUrl
    })
    return { dataUrl, ...dims }
  } catch { return null }
}

// Field order for catalog PDF (same as invoice, no price)
const CATALOG_FIELD_ORDER: Array<
  | { kind: 'builtin'; key: 'metal' | 'gross_weight' | 'diamond_weight' }
  | { kind: 'custom';  name: string; label: string }
> = [
  { kind: 'custom',  name: 'stone_category', label: 'Stone Cat.' },
  { kind: 'builtin', key: 'metal' },
  { kind: 'builtin', key: 'gross_weight' },
  { kind: 'custom',  name: 'net_weight_gm',  label: 'Net Wt. (g)' },
  { kind: 'builtin', key: 'diamond_weight' },
  { kind: 'custom',  name: 'diamond_clarity', label: 'Dia. Clarity' },
  { kind: 'custom',  name: 'diamond_color',   label: 'Dia. Color' },
  { kind: 'custom',  name: 'cvd_weight_ct',   label: 'CVD Wt. (ct)' },
  { kind: 'custom',  name: 'cvd_clarity',     label: 'CVD Clarity' },
  { kind: 'custom',  name: 'cvd_color',       label: 'CVD Color' },
  { kind: 'custom',  name: 'stone_weight_g',  label: 'Stone Wt. (g)' },
  { kind: 'custom',  name: 'polki_weight_g',  label: 'Polki Wt. (g)' },
]

async function generateCatalogPDF(products: AdminProduct[]) {
  // Fetch built-in field visibility settings (custom fields shown regardless — this is an admin doc)
  const supabase = createClient()
  const { data: settings } = await supabase
    .from('site_settings').select('key, value').in('key', ['show_metal', 'show_stone', 'show_gross_weight'])
  const settingsMap = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]))
  const builtinVis = {
    show_metal:        settingsMap['show_metal']        !== 'false',
    show_stone:        settingsMap['show_stone']        !== 'false',
    show_gross_weight: settingsMap['show_gross_weight'] !== 'false',
  }

  // Sort: category → stone_category → name
  const sorted = [...products].sort((a, b) => {
    const catA = (a.categories?.name ?? '').toLowerCase()
    const catB = (b.categories?.name ?? '').toLowerCase()
    if (catA !== catB) return catA.localeCompare(catB)
    const scA = String((a.custom_fields ?? {})['stone_category'] ?? '').toLowerCase()
    const scB = String((b.custom_fields ?? {})['stone_category'] ?? '').toLowerCase()
    if (scA !== scB) return scA.localeCompare(scB)
    return a.name.localeCompare(b.name)
  })

  // Fetch all images in parallel
  const imageMap: Record<string, CatalogImageInfo> = {}
  await Promise.all(sorted.map(async (p) => {
    const url = p.images?.[0]
    if (!url) return
    const info = await fetchCatalogImage(url)
    if (info) imageMap[p.id] = info
  }))

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210, PH = 297
  const ML = 12, MR = 12, MT = 12, MB = 10
  const GOLD:  [number,number,number] = [184, 151, 58]
  const DARK:  [number,number,number] = [26, 23, 20]
  const MGRAY: [number,number,number] = [100, 100, 100]
  const LGRAY: [number,number,number] = [210, 210, 210]

  const HEADER_H = 32
  const FOOTER_H = 8
  const COL_GAP  = 6
  const COL_W    = (PW - ML - MR - COL_GAP) / 2   // 90mm
  const ROWS     = 4
  const ROW_H    = (PH - MT - MB - HEADER_H - FOOTER_H) / ROWS  // ~58mm
  const PHOTO    = 44   // smaller photo → more text space
  const DX_OFF   = PHOTO + 5
  const DW       = COL_W - DX_OFF   // ~41mm

  const COL_X = [ML, ML + COL_W + COL_GAP]

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  function drawHeader(pageNum: number, totalPages: number) {
    // Extra top padding before brand name
    let hy = MT + 10
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(...GOLD)
    pdf.text('MAISHA JEWELLERY', ML, hy)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...DARK)
    pdf.text('STOCK INVENTORY', PW - MR, hy, { align: 'right' })

    hy += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...MGRAY)
    pdf.text(dateStr, ML, hy)
    pdf.text(`Page ${pageNum} of ${totalPages}`, PW - MR, hy, { align: 'right' })

    hy += 6
    pdf.setDrawColor(...GOLD)
    pdf.setLineWidth(0.5)
    pdf.line(ML, hy, PW - MR, hy)
  }

  let page = 1
  drawHeader(1, 1)

  const contentStartY = MT + HEADER_H

  for (let i = 0; i < sorted.length; i++) {
    const col       = i % 2
    const rowInPage = Math.floor((i % (ROWS * 2)) / 2)

    if (i > 0 && i % (ROWS * 2) === 0) {
      page++
      pdf.addPage()
      drawHeader(page, 1)
    }

    const cellX   = COL_X[col]
    const cellY   = contentStartY + rowInPage * ROW_H
    const maxTy   = cellY + ROW_H - 2   // clamp text to cell

    // Photo (contain-fit, centred in PHOTO×PHOTO cell)
    const imgInfo = imageMap[sorted[i].id]
    if (imgInfo) {
      try {
        const aspect = imgInfo.width / imgInfo.height
        let dw = PHOTO, dh = PHOTO
        if (aspect > 1) { dh = PHOTO / aspect } else { dw = PHOTO * aspect }
        pdf.addImage(imgInfo.dataUrl, cellX + (PHOTO - dw) / 2, cellY + (PHOTO - dh) / 2, dw, dh)
      } catch {
        pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.2); pdf.rect(cellX, cellY, PHOTO, PHOTO)
      }
    } else {
      pdf.setDrawColor(...LGRAY); pdf.setLineWidth(0.2); pdf.rect(cellX, cellY, PHOTO, PHOTO)
    }

    // Details — helper that takes/returns ty and respects the cell clamp
    const p  = sorted[i]
    const tx = cellX + DX_OFF
    let   ty = cellY + 5   // top padding inside cell

    // label (gray) + value (dark) on ONE line
    const drawField = (curTy: number, label: string, value: string | null | undefined): number => {
      const str = String(value ?? '').trim()
      if (!str || str === '0' || str === 'false') return curTy
      if (curTy + 4 > maxTy) return curTy
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...MGRAY)
      const labelStr = label + ' '
      pdf.text(labelStr, tx, curTy)
      const lw = pdf.getTextWidth(labelStr)
      pdf.setTextColor(...DARK)
      const valLines = pdf.splitTextToSize(str, DW - lw)
      pdf.text(valLines[0], tx + lw, curTy)  // first line only — keeps it on one line
      return curTy + 4
    }

    // Name (bold, wraps if long)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...DARK)
    const nameLines = pdf.splitTextToSize(p.name, DW)
    pdf.text(nameLines, tx, ty)
    ty += nameLines.length * 4 + 0.5

    // SKU
    if (ty < maxTy) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(6.5)
      pdf.setTextColor(...MGRAY)
      pdf.text(p.sku, tx, ty)
      ty += 4.5
    }

    // All fields in order — catalog is internal admin doc, no storefront visibility filter
    const cf = p.custom_fields ?? {}
    for (const fDef of CATALOG_FIELD_ORDER) {
      if (ty >= maxTy) break
      if (fDef.kind === 'custom') {
        ty = drawField(ty, fDef.label, String(cf[fDef.name] ?? ''))
      } else if (fDef.key === 'metal' && builtinVis.show_metal) {
        const metal = [p.metal_type, p.metal_purity].filter(Boolean).join(' ')
        ty = drawField(ty, 'Metal', metal || null)
      } else if (fDef.key === 'gross_weight' && builtinVis.show_gross_weight) {
        ty = drawField(ty, 'Gross Wt. (g)', p.gross_weight_g ? String(p.gross_weight_g) : null)
      } else if (fDef.key === 'diamond_weight' && builtinVis.show_stone) {
        ty = drawField(ty, 'Dia. Wt. (ct)', p.diamond_weight_ct ? String(p.diamond_weight_ct) : null)
      }
    }

    // Row separator line
    const rowBottom = cellY + ROW_H
    pdf.setDrawColor(...LGRAY)
    pdf.setLineWidth(0.2)
    pdf.line(ML, rowBottom, PW - MR, rowBottom)
  }

  // Re-draw headers with correct page count, add footers
  const totalPages = page
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, PW, MT + HEADER_H, 'F')
    drawHeader(pg, totalPages)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...LGRAY)
    pdf.text('Maisha Jewellery  ·  Confidential', PW / 2, PH - 4, { align: 'center' })
  }

  const date = new Date().toISOString().slice(0, 10)
  pdf.save(`maisha-inventory-${date}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductsTable({ initialProducts }: { initialProducts: AdminProduct[] }) {
  const [products, setProducts]       = useState(initialProducts)
  const [stockTab, setStockTab]         = useState<'in' | 'out'>(() => readFilters()?.stockTab ?? 'in')
  const [filterField, setFilterField]   = useState<string>(() => readFilters()?.filterField ?? '')
  const [filterValue, setFilterValue]   = useState<string>(() => readFilters()?.filterValue ?? '')
  const [filterMin,   setFilterMin]     = useState<string>(() => readFilters()?.filterMin  ?? '')
  const [filterMax,   setFilterMax]     = useState<string>(() => readFilters()?.filterMax  ?? '')
  const [filterField2, setFilterField2] = useState<string>(() => readFilters()?.filterField2 ?? '')
  const [filterValue2, setFilterValue2] = useState<string>(() => readFilters()?.filterValue2 ?? '')
  const [filterMin2,  setFilterMin2]    = useState<string>(() => readFilters()?.filterMin2 ?? '')
  const [filterMax2,  setFilterMax2]    = useState<string>(() => readFilters()?.filterMax2 ?? '')
  const [downloading, setDownloading]       = useState(false)
  const [catalogPdfing, setCatalogPdfing]   = useState(false)
  const supabase = createClient()

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify({
        stockTab, filterField, filterValue, filterMin, filterMax,
        filterField2, filterValue2, filterMin2, filterMax2,
      }))
    } catch {}
  }, [stockTab, filterField, filterValue, filterMin, filterMax, filterField2, filterValue2, filterMin2, filterMax2])

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.categories?.name).filter(Boolean) as string[])).sort(),
    [products]
  )

  const jscOptions = useMemo(
    () => Array.from(new Set(
      products.map((p) => String((p.custom_fields ?? {})['stone_category'] ?? '')).filter(Boolean)
    )).sort(),
    [products]
  )

  const activeFieldDef = FILTER_FIELDS.find((f) => f.key === filterField)
  const activeOptions: string[] | null =
    activeFieldDef?.options === 'dynamic_category' ? categoryOptions :
    activeFieldDef?.options === 'dynamic_jsc'      ? jscOptions :
    activeFieldDef?.options === 'range'            ? null :
    (activeFieldDef?.options as string[] | null) ?? null

  const activeFieldDef2 = FILTER_FIELDS.find((f) => f.key === filterField2)
  const activeOptions2: string[] | null =
    activeFieldDef2?.options === 'dynamic_category' ? categoryOptions :
    activeFieldDef2?.options === 'dynamic_jsc'      ? jscOptions :
    activeFieldDef2?.options === 'range'            ? null :
    (activeFieldDef2?.options as string[] | null) ?? null

  function matchesFilter(p: AdminProduct, field: string, value: string, min: string, max: string): boolean {
    if (!field) return true
    const fieldDef = FILTER_FIELDS.find((f) => f.key === field)

    if (fieldDef?.options === 'range') {
      const minN = min ? parseFloat(min) : NaN
      const maxN = max ? parseFloat(max) : NaN
      if (isNaN(minN) && isNaN(maxN)) return true
      const v = getWeightValue(p, field)
      if (v === null) return false
      if (!isNaN(minN) && v < minN) return false
      if (!isNaN(maxN) && v > maxN) return false
      return true
    }

    if (!value) return true
    const q = value.toLowerCase()
    if (field === 'name'           && !p.name.toLowerCase().includes(q))                                                      return false
    if (field === 'sku'            && !p.sku.toLowerCase().includes(q))                                                       return false
    if (field === 'category'       && (p.categories?.name ?? '').toLowerCase() !== q)                                         return false
    if (field === 'metal_type'     && !(p.metal_type   ?? '').toLowerCase().includes(q))                                      return false
    if (field === 'metal_purity'   && !(p.metal_purity ?? '').toLowerCase().includes(q))                                      return false
    if (field === 'stone_category' && String((p.custom_fields ?? {})['stone_category'] ?? '').toLowerCase() !== q)            return false
    return true
  }

  function matchesFieldFilter(p: AdminProduct): boolean {
    return matchesFilter(p, filterField, filterValue, filterMin, filterMax) &&
           matchesFilter(p, filterField2, filterValue2, filterMin2, filterMax2)
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
  }, [products, stockTab, filterField, filterValue, filterMin, filterMax, filterField2, filterValue2, filterMin2, filterMax2]) // eslint-disable-line react-hooks/exhaustive-deps

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

      // Apply the same filters as the current view (stock tab + both field filters)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const applyFilter = (p: any, field: string, value: string, min: string, max: string): boolean => {
        if (!field) return true
        const fieldDef = FILTER_FIELDS.find((f) => f.key === field)
        if (fieldDef?.options === 'range') {
          const minN = min ? parseFloat(min) : NaN
          const maxN = max ? parseFloat(max) : NaN
          if (isNaN(minN) && isNaN(maxN)) return true
          const v = getWeightValue(p, field)
          if (v === null) return false
          if (!isNaN(minN) && v < minN) return false
          if (!isNaN(maxN) && v > maxN) return false
          return true
        }
        if (!value) return true
        const q = value.toLowerCase()
        if (field === 'name'           && !p.name?.toLowerCase().includes(q))                                               return false
        if (field === 'sku'            && !p.sku?.toLowerCase().includes(q))                                                return false
        if (field === 'category'       && (p.categories?.name ?? '').toLowerCase() !== q)                                   return false
        if (field === 'metal_type'     && !(p.metal_type   ?? '').toLowerCase().includes(q))                                return false
        if (field === 'metal_purity'   && !(p.metal_purity ?? '').toLowerCase().includes(q))                                return false
        if (field === 'stone_category' && String((p.custom_fields ?? {})['stone_category'] ?? '').toLowerCase() !== q)     return false
        return true
      }

      const viewProducts = allProducts.filter((p) => {
        if (stockTab === 'in'  && !(p.stock_qty === null || p.stock_qty > 0)) return false
        if (stockTab === 'out' &&   (p.stock_qty === null || p.stock_qty > 0)) return false
        return applyFilter(p, filterField, filterValue, filterMin, filterMax) &&
               applyFilter(p, filterField2, filterValue2, filterMin2, filterMax2)
      })

      const customKeys = Array.from(
        new Set(viewProducts.flatMap((p) => Object.keys((p.custom_fields as Record<string, unknown>) ?? {})))
      ).sort()

      const rows = viewProducts.map((p) => {
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

      {/* ── Filters ── */}
      <div className="flex flex-col gap-2 mb-3">
        {/* Row 1 */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterField}
            onChange={(e) => { setFilterField(e.target.value); setFilterValue(''); setFilterMin(''); setFilterMax('') }}
            className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] bg-white"
          >
            <option value="">Filter by…</option>
            {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {filterField && (
            activeFieldDef?.options === 'range' ? (
              <RangeInputs
                min={filterMin} max={filterMax}
                onMin={setFilterMin} onMax={setFilterMax}
                onClear={() => { setFilterMin(''); setFilterMax('') }}
              />
            ) : activeOptions ? (
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
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterField2}
            onChange={(e) => { setFilterField2(e.target.value); setFilterValue2(''); setFilterMin2(''); setFilterMax2('') }}
            className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] bg-white"
          >
            <option value="">And filter by…</option>
            {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {filterField2 && (
            activeFieldDef2?.options === 'range' ? (
              <RangeInputs
                min={filterMin2} max={filterMax2}
                onMin={setFilterMin2} onMax={setFilterMax2}
                onClear={() => { setFilterMin2(''); setFilterMax2('') }}
              />
            ) : activeOptions2 ? (
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

      {/* ── Action buttons ── */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={downloadExcel}
          disabled={downloading}
          className="flex items-center gap-2 border border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase px-5 py-2.5 hover:bg-[#B8973A] hover:text-white transition-colors disabled:opacity-50"
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {downloading ? 'Exporting…' : 'Download Excel'}
        </button>
        <button
          onClick={async () => { setCatalogPdfing(true); try { await generateCatalogPDF(filtered) } finally { setCatalogPdfing(false) } }}
          disabled={catalogPdfing || filtered.length === 0}
          className="flex items-center gap-2 border border-gray-400 text-gray-600 text-xs tracking-widest uppercase px-5 py-2.5 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {catalogPdfing ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
          {catalogPdfing ? 'Generating…' : `Catalog PDF (${filtered.length})`}
        </button>
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
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {p.sku}
                {(() => {
                  const net = parseFloat(String((p.custom_fields ?? {})['net_weight_gm'] ?? ''))
                  const gross = p.gross_weight_g
                  const parts = []
                  if (!isNaN(net) && net)  parts.push(`N ${net}g`)
                  if (gross) parts.push(`G ${gross}g`)
                  return parts.length ? <span className="ml-2 text-gray-400">{parts.join(' · ')}</span> : null
                })()}
              </p>
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
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Weight</th>
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
                <td className="px-4 py-3">
                  {(() => {
                    const net = parseFloat(String((p.custom_fields ?? {})['net_weight_gm'] ?? ''))
                    const gross = p.gross_weight_g
                    if (!net && !gross) return <span className="text-gray-300">—</span>
                    return (
                      <div className="text-xs leading-relaxed text-gray-500">
                        {!isNaN(net)  && net  ? <div><span className="text-gray-400">N</span> {net}g</div>  : null}
                        {gross ? <div><span className="text-gray-400">G</span> {gross}g</div> : null}
                      </div>
                    )
                  })()}
                </td>
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
