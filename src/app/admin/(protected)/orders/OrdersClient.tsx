'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import { Order, Karigar, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  initialOrders: Order[]
  karigars: Pick<Karigar, 'id' | 'name' | 'is_active'>[]
}

const ALL = '__all__'

export default function OrdersClient({ initialOrders, karigars }: Props) {
  const [karigarFilter, setKarigarFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [search, setSearch] = useState('')

  // Count open orders per karigar for the bubble badges
  const karigarOrderCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of initialOrders) {
      if (o.status === 'completed' || o.status === 'cancelled') continue
      for (const ok of o.order_karigars ?? []) {
        const kid = ok.karigar_id
        counts[kid] = (counts[kid] ?? 0) + 1
      }
    }
    return counts
  }, [initialOrders])

  const filtered = useMemo(() => {
    return initialOrders.filter(o => {
      if (statusFilter !== ALL && o.status !== statusFilter) return false
      if (karigarFilter !== ALL) {
        const hasKarigar = (o.order_karigars ?? []).some(ok => ok.karigar_id === karigarFilter)
        if (!hasKarigar) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (!o.order_ref.toLowerCase().includes(q) && !(o.notes ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [initialOrders, karigarFilter, statusFilter, search])

  const statuses: OrderStatus[] = ['started', 'in_progress', 'completed', 'cancelled']

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-cormorant font-semibold text-gray-900">Orders</h1>
        <Link
          href="/admin/orders/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#B8973A] text-white rounded text-sm hover:bg-[#a07e2e] transition-colors"
        >
          <Plus size={15} /> Add Order
        </Link>
      </div>

      {/* Karigar bubble filters */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Filter by Karigar</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setKarigarFilter(ALL)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              karigarFilter === ALL
                ? 'bg-[#B8973A] text-white border-[#B8973A]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#B8973A] hover:text-[#B8973A]'
            )}
          >
            All Karigars
          </button>
          {karigars.map(k => {
            const count = karigarOrderCounts[k.id] ?? 0
            return (
              <button
                key={k.id}
                onClick={() => setKarigarFilter(k.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  karigarFilter === k.id
                    ? 'bg-[#B8973A] text-white border-[#B8973A]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#B8973A] hover:text-[#B8973A]'
                )}
              >
                {k.name}
                {count > 0 && (
                  <span className={cn(
                    'text-xs rounded-full px-1.5 py-0.5 font-semibold',
                    karigarFilter === k.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Secondary filters */}
      <div className="flex gap-3 flex-wrap mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search order ref or notes…"
          className="border border-gray-200 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
        >
          <option value={ALL}>All Statuses</option>
          {statuses.map(s => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">No orders match your filters.</p>
          {initialOrders.length === 0 && (
            <Link href="/admin/orders/new" className="mt-3 inline-flex items-center gap-1 text-[#B8973A] text-sm hover:underline">
              <Plus size={14} /> Create your first order
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {filtered.map(order => {
            const orderKarigars = order.order_karigars ?? []
            return (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {order.reference_photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={order.reference_photo_url}
                      alt=""
                      className="w-10 h-10 rounded object-cover flex-shrink-0 border border-gray-100"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{order.order_ref}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ORDER_STATUS_COLORS[order.status])}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    {orderKarigars.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {orderKarigars.map(ok => (
                          <span key={ok.id} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {ok.karigars?.name ?? '—'}
                          </span>
                        ))}
                      </div>
                    )}
                    {order.notes && (
                      <p className="text-xs text-gray-400 truncate mt-0.5 max-w-sm">{order.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
