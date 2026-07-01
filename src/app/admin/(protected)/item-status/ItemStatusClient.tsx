'use client'
import { useState, useMemo, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2, History, X, CheckSquare, Square, User } from 'lucide-react'

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
  custom_fields?: Record<string, unknown> | null
  categories?: { name: string } | null
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
  { label: 'Name',                   key: 'name',                   options: null },
  { label: 'SKU',                    key: 'sku',                    options: null },
  { label: 'Category',               key: 'category',               options: 'dynamic_category' as const },
  { label: 'Stone Category', key: 'stone_category', options: 'dynamic_jsc' as const },
  { label: 'Metal Type',             key: 'metal_type',             options: ['Gold', 'Silver', 'Platinum', 'Rose Gold'] },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function ItemStatusClient({
  initialProducts,
  initialCustomers,
}: {
  initialProducts: ItemProduct[]
  initialCustomers: Customer[]
}) {
  const supabase = createClient()

  // ── Products state ──
  const [products, setProducts]  = useState(initialProducts)
  const [customers, setCustomers] = useState(initialCustomers)

  // ── Filters (mirroring ProductsTable) ──
  const [statusTab,    setStatusTab]    = useState<'all' | StockStatus>('all')
  const [filterField,  setFilterField]  = useState('')
  const [filterValue,  setFilterValue]  = useState('')
  const [filterField2, setFilterField2] = useState('')
  const [filterValue2, setFilterValue2] = useState('')

  // ── Selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ── Pending action ──
  type Action = 'out_of_stock' | 'on_approval' | 'in_stock' | null
  const [pendingAction, setPendingAction] = useState<Action>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const customerInputRef = useRef<HTMLInputElement>(null)

  // ── History ──
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
    if (field === 'name'                   && !p.name.toLowerCase().includes(q)) return false
    if (field === 'sku'                    && !p.sku.toLowerCase().includes(q))  return false
    if (field === 'category'               && (p.categories?.name ?? '').toLowerCase() !== q) return false
    if (field === 'metal_type'             && !(p.metal_type ?? '').toLowerCase().includes(q)) return false
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
    in_stock:     products.filter((p) => getStatus(p) === 'in_stock'    && matchesFilter(p, filterField, filterValue) && matchesFilter(p, filterField2, filterValue2)).length,
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
      // Resolve or create customer
      let customerId: string | null = null
      if (pendingAction === 'on_approval' || pendingAction === 'out_of_stock') {
        if (selectedCustomer && selectedCustomer.name.toLowerCase() === customerQuery.toLowerCase()) {
          customerId = selectedCustomer.id
        } else {
          // Create new customer
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

      // Determine new stock_qty
      const newQty = pendingAction === 'in_stock' ? 1 : pendingAction === 'on_approval' ? -1 : 0

      const ids = Array.from(selected)

      // Update stock_qty on all selected products
      const { error: updateErr } = await supabase
        .from('products')
        .update({ stock_qty: newQty })
        .in('id', ids)
      if (updateErr) throw updateErr

      // Write history rows
      const historyRows = ids.map((pid) => ({
        product_id:  pid,
        customer_id: customerId,
        status:      pendingAction,
        notes:       actionNotes.trim() || null,
      }))
      const { error: histErr } = await supabase.from('item_history').insert(historyRows)
      if (histErr) throw histErr

      // Update local state
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
        {/* Filter 1 */}
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

        {/* Filter 2 */}
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
                  {/* Checkbox */}
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleOne(p.id)}>
                      {isSelected
                        ? <CheckSquare size={18} className="text-[#B8973A]" />
                        : <Square size={18} className="text-gray-300" />}
                    </button>
                  </div>

                  {/* Thumb */}
                  {p.images?.[0] ? (
                    <div className="w-10 h-10 relative flex-shrink-0 rounded overflow-hidden">
                      <Image src={p.images[0]} alt={p.name} fill className="object-cover" sizes="40px" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-[#F0EBE3] rounded flex items-center justify-center flex-shrink-0">
                      <span className="font-cormorant text-[#B8973A] text-sm">M</span>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1714] truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.sku} · {p.categories?.name ?? '—'}</p>
                  </div>

                  {/* Status badge */}
                  <span className={`text-[10px] tracking-widest uppercase px-2 py-1 rounded flex-shrink-0 ${STATUS_STYLES[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>

                  {/* History button */}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setPendingAction('out_of_stock')}
              className="py-2.5 text-xs tracking-widest uppercase border border-gray-300 rounded hover:border-gray-500 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Mark Out of Stock
            </button>
            <button
              onClick={() => setPendingAction('on_approval')}
              className="py-2.5 text-xs tracking-widest uppercase bg-amber-50 border border-amber-300 rounded hover:bg-amber-100 text-amber-700 transition-colors"
            >
              Send on Approval
            </button>
            <button
              onClick={() => setPendingAction('in_stock')}
              className="py-2.5 text-xs tracking-widest uppercase bg-green-50 border border-green-300 rounded hover:bg-green-100 text-green-700 transition-colors"
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
                {/* Customer autocomplete */}
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
