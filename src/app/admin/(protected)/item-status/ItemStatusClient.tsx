'use client'
import { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2, History, X, CheckSquare, Square, User, FileDown } from 'lucide-react'
import jsPDF from 'jspdf'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ItemProduct {
  id: string
  name: string
  sku: string
  images: string[]
  stock_qty: number | null
  is_active: boolean
  metal_type?: string | null
  metal_purity?: string | null
  price_inr?: number | null
  gross_weight_g?: number | null
  diamond_weight_ct?: number | null
  custom_fields?: Record<string, unknown> | null
  categories?: { name: string } | null
}

interface BuiltinVisibility {
  show_metal: boolean
  show_stone: boolean
  show_gross_weight: boolean
}

interface Customer {
  id: string
  name: string
  notes: string | null
}

interface HistoryRow {
  id: string
  status: 'in_stock' | 'out_of_stock' | 'on_approval'
  notes: string | null
  created_at: string
  customers: { name: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type StockStatus = 'in_stock' | 'out_of_stock' | 'on_approval'

function getStatus(p: ItemProduct): StockStatus {
  if (p.stock_qty === -1) return 'on_approval'
  if (p.stock_qty === 0)  return 'out_of_stock'
  return 'in_stock'
}

const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock:    'In Stock',
  out_of_stock:'Out of Stock',
  on_approval: 'On Approval',
}

const STATUS_STYLES: Record<StockStatus, string> = {
  in_stock:    'bg-green-50 text-green-700 border border-green-100',
  out_of_stock:'bg-gray-100 text-gray-500 border border-gray-200',
  on_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
}

const FILTER_FIELDS = [
  { label: 'Name',           key: 'name',           options: null },
  { label: 'SKU',            key: 'sku',            options: null },
  { label: 'Category',       key: 'category',       options: 'dynamic_category' as const },
  { label: 'Stone Category', key: 'stone_category', options: 'dynamic_jsc' as const },
  { label: 'Metal Type',     key: 'metal_type',     options: ['Gold', 'Silver', 'Platinum', 'Rose Gold'] },
]



// ─── PDF generation ───────────────────────────────────────────────────────────

interface ImageInfo {
  dataUrl: string
  width: number
  height: number
}

async function fetchImageInfo(url: string): Promise<ImageInfo | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = dataUrl
    })
    return { dataUrl, width, height }
  } catch {
    return null
  }
}

// Fixed display order for the PDF
const PDF_FIELD_ORDER: Array<
  | { kind: 'builtin'; key: 'category' | 'metal' | 'gross_weight' | 'diamond_weight' | 'price' }
  | { kind: 'custom';  name: string; label: string }
> = [
  { kind: 'builtin', key: 'category' },
  { kind: 'custom',  name: 'stone_category', label: 'Stone Category' },
  { kind: 'builtin', key: 'metal' },
  { kind: 'builtin', key: 'gross_weight' },
  { kind: 'custom',  name: 'net_weight_gm',  label: 'Net Weight (g)' },
  { kind: 'builtin', key: 'diamond_weight' },
  { kind: 'custom',  name: 'diamond_clarity', label: 'Diamond Clarity' },
  { kind: 'custom',  name: 'diamond_color',   label: 'Diamond Color' },
  { kind: 'custom',  name: 'cvd_weight_ct',   label: 'CVD Wt. (ct)' },
  { kind: 'custom',  name: 'cvd_clarity',     label: 'CVD Clarity' },
  { kind: 'custom',  name: 'cvd_color',       label: 'CVD Color' },
  { kind: 'custom',  name: 'stone_weight_g',  label: 'Stone Weight (g)' },
  { kind: 'custom',  name: 'polki_weight_g',  label: 'Polki Weight (g)' },
  { kind: 'builtin', key: 'price' },
]

async function generateItemPDF(
  selectedProducts: ItemProduct[],
  action: 'out_of_stock' | 'on_approval',
  customerName: string,
  notes: string,
  visibleCustomParams: string[],
  builtinVisibility: BuiltinVisibility,
) {
  // Fetch all product images in parallel (with dimensions for aspect-ratio-correct rendering)
  const imageMap: Record<string, ImageInfo> = {}
  await Promise.all(
    selectedProducts.map(async (p) => {
      const url = p.images?.[0]
      if (!url) return
      const info = await fetchImageInfo(url)
      if (info) imageMap[p.id] = info
    })
  )

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210, PH = 297, M = 15
  const CW = PW - 2 * M        // 180 mm content width
  const GOLD: [number, number, number]  = [184, 151, 58]
  const DARK: [number, number, number]  = [26, 23, 20]
  const MGRAY: [number, number, number] = [100, 100, 100]
  const LGRAY: [number, number, number] = [210, 210, 210]

  // ── Header ──────────────────────────────────────────────────────────────────
  let y = M + 6

  // Brand name
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor(...GOLD)
  pdf.text('MAISHA JEWELLERY', M, y)

  // Action label (right-aligned)
  pdf.setFontSize(9)
  pdf.setTextColor(...DARK)
  const actionLabel = action === 'on_approval' ? 'ON APPROVAL RECEIPT' : 'ITEMS MARKED AS SOLD'
  pdf.text(actionLabel, PW - M, y, { align: 'right' })

  y += 8

  // Gold separator
  pdf.setDrawColor(...GOLD)
  pdf.setLineWidth(0.6)
  pdf.line(M, y, PW - M, y)
  y += 5

  // Meta line: date, customer, notes
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...MGRAY)
  pdf.text(`Date: ${dateStr}`, M, y)
  pdf.text(`Customer: ${customerName || '—'}`, M + 70, y)
  y += 5

  if (notes) {
    pdf.text(`Notes: ${notes}`, M, y)
    y += 5
  }

  // Item count
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...DARK)
  pdf.text(`${selectedProducts.length} item${selectedProducts.length !== 1 ? 's' : ''}`, M, y)
  y += 6

  // Second separator
  pdf.setDrawColor(...LGRAY)
  pdf.setLineWidth(0.3)
  pdf.line(M, y, PW - M, y)
  y += 6

  // ── Products ─────────────────────────────────────────────────────────────────
  // 45mm image → 4 products fit per page even on page 1 (after header)
  const IMG = 45             // image size mm
  const GAP = 6              // gap between image and details
  const DX  = M + IMG + GAP  // details column X
  const DW  = CW - IMG - GAP // details column width
  const LW  = 34             // label column width
  const VX  = DX + LW       // value column X
  const VW  = DW - LW       // value column width

  // Print a label+value row; returns the new ty position
  const drawField = (ty: number, label: string, value: string | null | undefined): number => {
    if (value === null || value === undefined) return ty
    const str = String(value).trim()
    if (!str || str === '0') return ty

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(...MGRAY)
    pdf.text(label, DX, ty)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...DARK)
    const lines = pdf.splitTextToSize(str, VW)
    pdf.text(lines, VX, ty)

    return ty + Math.max(lines.length * 4, 4.5)
  }

  for (let i = 0; i < selectedProducts.length; i++) {
    const p = selectedProducts[i]

    // Page break: ensure at least IMG height fits
    if (y + IMG + 8 > PH - M) {
      pdf.addPage()
      y = M + 6
    }

    const rowStartY = y

    // ── Image column (contain-fit: preserve aspect ratio, no stretch) ──
    const imgInfo = imageMap[p.id]
    if (imgInfo) {
      try {
        const aspect = imgInfo.width / imgInfo.height
        let drawW = IMG, drawH = IMG
        if (aspect > 1) {
          drawH = IMG / aspect
        } else {
          drawW = IMG * aspect
        }
        const offsetX = M + (IMG - drawW) / 2
        const offsetY = y + (IMG - drawH) / 2
        pdf.addImage(imgInfo.dataUrl, offsetX, offsetY, drawW, drawH)
      } catch {
        pdf.setDrawColor(...LGRAY)
        pdf.setLineWidth(0.3)
        pdf.rect(M, y, IMG, IMG)
      }
    } else {
      pdf.setDrawColor(...LGRAY)
      pdf.setLineWidth(0.3)
      pdf.rect(M, y, IMG, IMG)
    }

    // ── Details column ──
    let ty = y + 2.5

    // Product name
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...DARK)
    const nameLines = pdf.splitTextToSize(p.name, DW)
    pdf.text(nameLines, DX, ty)
    ty += nameLines.length * 4.5 + 1

    // SKU
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...MGRAY)
    pdf.text(`SKU: ${p.sku}`, DX, ty)
    ty += 4.5

    // Render fields in fixed order, respecting visibility settings
    const cf = p.custom_fields ?? {}
    for (const fieldDef of PDF_FIELD_ORDER) {
      if (fieldDef.kind === 'builtin') {
        if (fieldDef.key === 'category' && p.categories?.name) {
          ty = drawField(ty, 'Category', p.categories.name)
        } else if (fieldDef.key === 'metal' && builtinVisibility.show_metal) {
          const metalStr = [p.metal_type, p.metal_purity].filter(Boolean).join(' ')
          if (metalStr) ty = drawField(ty, 'Metal', metalStr)
        } else if (fieldDef.key === 'gross_weight' && builtinVisibility.show_gross_weight && p.gross_weight_g) {
          ty = drawField(ty, 'Gross Weight', `${p.gross_weight_g} g`)
        } else if (fieldDef.key === 'diamond_weight' && builtinVisibility.show_stone && p.diamond_weight_ct) {
          ty = drawField(ty, 'Diamond Wt.', `${p.diamond_weight_ct} ct`)
        } else if (fieldDef.key === 'price' && p.price_inr) {
          ty = drawField(ty, 'Price', `Rs. ${p.price_inr.toLocaleString('en-IN')}`)
        }
      } else {
        if (!visibleCustomParams.includes(fieldDef.name)) continue
        const val = cf[fieldDef.name]
        if (val === null || val === undefined || String(val).trim() === '' || String(val) === '0' || val === false) continue
        ty = drawField(ty, fieldDef.label, String(val))
      }
    }

    // Row separator — below whichever is taller (image or text)
    const rowH = Math.max(IMG + 3, ty - rowStartY + 3)
    y = rowStartY + rowH

    if (i < selectedProducts.length - 1) {
      pdf.setDrawColor(...LGRAY)
      pdf.setLineWidth(0.3)
      pdf.line(M, y, PW - M, y)
      y += 4
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = (pdf as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...LGRAY)
    pdf.text(`Maisha Jewellery  ·  ${dateStr}  ·  Page ${pg} of ${totalPages}`, PW / 2, PH - 8, { align: 'center' })
  }

  const slug = action === 'on_approval' ? 'on-approval' : 'out-of-stock'
  const dateSuffix = new Date().toISOString().slice(0, 10)
  pdf.save(`maisha-${slug}-${dateSuffix}.pdf`)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ItemStatusClient({
  initialProducts,
  initialCustomers,
  visibleCustomParams,
  builtinVisibility,
}: {
  initialProducts: ItemProduct[]
  initialCustomers: Customer[]
  visibleCustomParams: string[]
  builtinVisibility: BuiltinVisibility
}) {
  const supabase = createClient()

  const [products, setProducts]  = useState(initialProducts)
  const [customers, setCustomers] = useState(initialCustomers)

  // Filters
  const [statusTab,    setStatusTab]    = useState<'all' | StockStatus>('all')
  const [filterField,  setFilterField]  = useState('')
  const [filterValue,  setFilterValue]  = useState('')
  const [filterField2, setFilterField2] = useState('')
  const [filterValue2, setFilterValue2] = useState('')

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Pending action
  type Action = 'out_of_stock' | 'on_approval' | 'in_stock' | null
  const [pendingAction, setPendingAction] = useState<Action>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const customerInputRef = useRef<HTMLInputElement>(null)

  // History
  const [historyProductId, setHistoryProductId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ─── Filter options ──────────────────────────────────────────────────────
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

  function getOptions(key: string): string[] | null {
    const def = FILTER_FIELDS.find((f) => f.key === key)
    if (!def) return null
    if (def.options === 'dynamic_category') return categoryOptions
    if (def.options === 'dynamic_jsc')      return jscOptions
    return def.options as string[] | null
  }

  function matchesFilter(p: ItemProduct, field: string, value: string): boolean {
    if (!field || !value) return true
    const q = value.toLowerCase()
    if (field === 'name'           && !p.name.toLowerCase().includes(q)) return false
    if (field === 'sku'            && !p.sku.toLowerCase().includes(q))  return false
    if (field === 'category'       && (p.categories?.name ?? '').toLowerCase() !== q) return false
    if (field === 'metal_type'     && !(p.metal_type ?? '').toLowerCase().includes(q)) return false
    if (field === 'stone_category' && String((p.custom_fields ?? {})['stone_category'] ?? '').toLowerCase() !== q) return false
    return true
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const s = getStatus(p)
      if (statusTab !== 'all' && s !== statusTab) return false
      if (!matchesFilter(p, filterField, filterValue))   return false
      if (!matchesFilter(p, filterField2, filterValue2)) return false
      return true
    })
  }, [products, statusTab, filterField, filterValue, filterField2, filterValue2]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    all:          products.filter((p) => matchesFilter(p, filterField, filterValue) && matchesFilter(p, filterField2, filterValue2)).length,
    in_stock:     products.filter((p) => getStatus(p) === 'in_stock'     && matchesFilter(p, filterField, filterValue) && matchesFilter(p, filterField2, filterValue2)).length,
    out_of_stock: products.filter((p) => getStatus(p) === 'out_of_stock' && matchesFilter(p, filterField, filterValue) && matchesFilter(p, filterField2, filterValue2)).length,
    on_approval:  products.filter((p) => getStatus(p) === 'on_approval'  && matchesFilter(p, filterField, filterValue) && matchesFilter(p, filterField2, filterValue2)).length,
  }), [products, filterField, filterValue, filterField2, filterValue2]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Selection helpers ────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((p) => p.id)))
    }
  }

  // ─── Customer autocomplete ────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!customerQuery.trim()) return []
    const q = customerQuery.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6)
  }, [customers, customerQuery])

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setCustomerQuery(c.name)
    setShowSuggestions(false)
  }

  function resetActionForm() {
    setPendingAction(null)
    setCustomerQuery('')
    setSelectedCustomer(null)
    setActionNotes('')
    setApplyError('')
  }

  // ─── Download PDF ─────────────────────────────────────────────────────────
  async function handleDownloadPDF() {
    if (!pendingAction || pendingAction === 'in_stock') return
    const selectedProducts = products.filter((p) => selected.has(p.id))
    setPdfGenerating(true)
    try {
      await generateItemPDF(selectedProducts, pendingAction, customerQuery.trim(), actionNotes.trim(), visibleCustomParams, builtinVisibility)
    } finally {
      setPdfGenerating(false)
    }
  }

  // ─── Apply action ─────────────────────────────────────────────────────────
  async function applyAction() {
    if (!pendingAction || selected.size === 0) return
    if ((pendingAction === 'on_approval' || pendingAction === 'out_of_stock') && !customerQuery.trim()) {
      setApplyError('Please enter a customer name')
      return
    }
    setApplying(true)
    setApplyError('')

    try {
      let customerId: string | null = null
      if (pendingAction === 'on_approval' || pendingAction === 'out_of_stock') {
        if (selectedCustomer && selectedCustomer.name.toLowerCase() === customerQuery.toLowerCase()) {
          customerId = selectedCustomer.id
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert({ name: customerQuery.trim(), notes: actionNotes.trim() || null })
            .select('id, name, notes')
            .single()
          if (custErr) throw custErr
          customerId = newCust.id
          setCustomers((prev) => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)))
        }
      }

      const newQty = pendingAction === 'in_stock' ? 1 : pendingAction === 'on_approval' ? -1 : 0
      const ids = Array.from(selected)

      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock_qty: newQty })
        .in('id', ids)
      if (updateErr) throw updateErr

      const historyRows = ids.map((pid) => ({
        product_id:  pid,
        customer_id: customerId,
        status:      pendingAction,
        notes:       actionNotes.trim() || null,
      }))
      const { error: histErr } = await supabase.from('item_history').insert(historyRows)
      if (histErr) throw histErr

      setProducts((prev) =>
        prev.map((p) => selected.has(p.id) ? { ...p, stock_qty: newQty } : p)
      )
      setSelected(new Set())
      resetActionForm()
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setApplying(false)
    }
  }

  // ─── History drawer ───────────────────────────────────────────────────────
  async function openHistory(productId: string) {
    setHistoryProductId(productId)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('item_history')
      .select('id, status, notes, created_at, customers(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data as unknown as HistoryRow[]) ?? [])
    setHistoryLoading(false)
  }

  const historyProduct = products.find((p) => p.id === historyProductId)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="pb-32">

      {/* ── Status tabs ── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ['all',          'All'],
          ['in_stock',     'In Stock'],
          ['out_of_stock', 'Out of Stock'],
          ['on_approval',  'On Approval'],
        ] as [typeof statusTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusTab(key)}
            className={`px-4 py-2 rounded text-xs tracking-widest uppercase transition-colors border ${
              statusTab === key
                ? 'bg-[#1A1714] text-white border-[#1A1714]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {label} ({counts[key as keyof typeof counts]})
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterField}
          onChange={(e) => { setFilterField(e.target.value); setFilterValue('') }}
          className="border border-gray-200 bg-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#B8973A] min-w-[160px]"
        >
          <option value="">Filter by…</option>
          {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {filterField && (
          getOptions(filterField)
            ? (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="border border-gray-200 bg-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#B8973A] min-w-[160px]"
              >
                <option value="">All</option>
                {getOptions(filterField)!.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder={`Search ${FILTER_FIELDS.find((f) => f.key === filterField)?.label}…`}
                className="border border-gray-200 bg-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#B8973A] min-w-[200px]"
              />
            )
        )}
        {filterValue && (
          <button onClick={() => { setFilterField(''); setFilterValue('') }} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}

        <select
          value={filterField2}
          onChange={(e) => { setFilterField2(e.target.value); setFilterValue2('') }}
          className="border border-gray-200 bg-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#B8973A] min-w-[160px]"
        >
          <option value="">And filter by…</option>
          {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {filterField2 && (
          getOptions(filterField2)
            ? (
              <select
                value={filterValue2}
                onChange={(e) => setFilterValue2(e.target.value)}
                className="border border-gray-200 bg-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#B8973A] min-w-[160px]"
              >
                <option value="">All</option>
                {getOptions(filterField2)!.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                value={filterValue2}
                onChange={(e) => setFilterValue2(e.target.value)}
                placeholder={`Search ${FILTER_FIELDS.find((f) => f.key === filterField2)?.label}…`}
                className="border border-gray-200 bg-white text-sm px-3 py-2 rounded focus:outline-none focus:border-[#B8973A] min-w-[200px]"
              />
            )
        )}
        {filterValue2 && (
          <button onClick={() => { setFilterField2(''); setFilterValue2('') }} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Select all row ── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <button onClick={toggleAll} className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#1A1714] transition-colors">
            {selected.size === filtered.length && filtered.length > 0
              ? <CheckSquare size={16} className="text-[#B8973A]" />
              : <Square size={16} />}
            {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : `Select all ${filtered.length}`}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-[#B8973A] font-medium">{selected.size} selected</span>
          )}
        </div>
      )}

      {/* ── Product list ── */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">No products match the current filters.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((p) => {
              const status = getStatus(p)
              const isSelected = selected.has(p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => toggleOne(p.id)}
                  className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleOne(p.id)}>
                      {isSelected
                        ? <CheckSquare size={18} className="text-[#B8973A]" />
                        : <Square size={18} className="text-gray-300" />}
                    </button>
                  </div>

                  {p.images?.[0] ? (
                    <div className="w-10 h-10 relative flex-shrink-0 rounded overflow-hidden">
                      <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="40px" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-[#F0EBE3] rounded flex items-center justify-center flex-shrink-0">
                      <span className="font-cormorant text-[#B8973A] text-sm">M</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1714] truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.sku} · {p.categories?.name ?? '—'}</p>
                  </div>

                  <span className={`text-[10px] tracking-widest uppercase px-2 py-1 rounded flex-shrink-0 ${STATUS_STYLES[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>

                  <button
                    onClick={(e) => { e.stopPropagation(); openHistory(p.id) }}
                    className="flex-shrink-0 text-gray-300 hover:text-[#B8973A] transition-colors p-1"
                    title="View history"
                  >
                    <History size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Action bar (fixed bottom) ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 md:left-56 right-0 bg-white border-t border-gray-200 shadow-lg z-20 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#1A1714]">
              {selected.size} item{selected.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => { setSelected(new Set()); resetActionForm() }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPendingAction('out_of_stock')}
                className="py-2 text-xs tracking-widest uppercase border border-gray-300 rounded hover:border-gray-500 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Out of Stock
              </button>
              <button
                onClick={() => setPendingAction('on_approval')}
                className="py-2 text-xs tracking-widest uppercase bg-amber-50 border border-amber-300 rounded hover:bg-amber-100 text-amber-700 transition-colors"
              >
                On Approval
              </button>
            </div>
            <button
              onClick={() => setPendingAction('in_stock')}
              className="w-full py-2 text-xs tracking-widest uppercase bg-green-50 border border-green-300 rounded hover:bg-green-100 text-green-700 transition-colors"
            >
              Return to Stock
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={resetActionForm} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-[#1A1714] mb-1">
              {pendingAction === 'out_of_stock' ? 'Mark as Sold' : pendingAction === 'on_approval' ? 'Send on Approval' : 'Return to Stock'}
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              {selected.size} item{selected.size !== 1 ? 's' : ''} will be updated
            </p>

            {(pendingAction === 'out_of_stock' || pendingAction === 'on_approval') && (
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs tracking-widest uppercase text-gray-400 block mb-1">Customer Name *</label>
                  <div className="relative">
                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-white px-3 py-2.5">
                      <User size={13} className="text-gray-400 flex-shrink-0" />
                      <input
                        ref={customerInputRef}
                        value={customerQuery}
                        onChange={(e) => { setCustomerQuery(e.target.value); setSelectedCustomer(null); setShowSuggestions(true) }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        placeholder="Type customer name…"
                        className="text-sm focus:outline-none w-full bg-transparent"
                        autoFocus
                      />
                    </div>
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                        {suggestions.map((c) => (
                          <button
                            key={c.id}
                            onMouseDown={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors"
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.notes && <span className="text-gray-400 text-xs ml-2">{c.notes}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs tracking-widest uppercase text-gray-400 block mb-1">Notes / Address (optional)</label>
                  <input
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="e.g. delivery address, occasion…"
                    className="w-full border border-gray-200 rounded-lg bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#B8973A]"
                  />
                </div>

                {/* PDF download button */}
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={pdfGenerating}
                  className="w-full flex items-center justify-center gap-2 border border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase py-2.5 rounded hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  {pdfGenerating
                    ? <Loader2 size={13} className="animate-spin" />
                    : <FileDown size={13} />}
                  {pdfGenerating ? 'Generating PDF…' : 'Download PDF'}
                </button>
              </div>
            )}

            {pendingAction === 'in_stock' && (
              <p className="text-sm text-gray-500 mb-5">
                These items will be marked as available in stock again.
              </p>
            )}

            {applyError && <p className="text-red-500 text-xs mb-4">{applyError}</p>}

            <div className="flex gap-3">
              <button
                onClick={resetActionForm}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyAction}
                disabled={applying}
                className={`flex-1 py-2.5 text-sm rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  pendingAction === 'in_stock'
                    ? 'bg-green-600 hover:bg-green-700'
                    : pendingAction === 'on_approval'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-[#1A1714] hover:bg-[#2A2720]'
                }`}
              >
                {applying && <Loader2 size={14} className="animate-spin" />}
                {applying ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History drawer ── */}
      {historyProductId && (
        <div className="fixed inset-0 z-30 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setHistoryProductId(null)} />
          <aside className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs tracking-widest uppercase text-gray-400">History</p>
                <p className="text-sm font-medium text-[#1A1714] mt-0.5 truncate">{historyProduct?.name}</p>
              </div>
              <button onClick={() => setHistoryProductId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-gray-300" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No history yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((row) => (
                    <div key={row.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: row.status === 'in_stock' ? '#16a34a' : row.status === 'on_approval' ? '#d97706' : '#9ca3af' }}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded ${STATUS_STYLES[row.status]}`}>
                            {STATUS_LABELS[row.status]}
                          </span>
                          {row.customers?.name && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User size={10} /> {row.customers.name}
                            </span>
                          )}
                        </div>
                        {row.notes && <p className="text-xs text-gray-400 mt-0.5">{row.notes}</p>}
                        <p className="text-[10px] text-gray-300 mt-1">
                          {new Date(row.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
