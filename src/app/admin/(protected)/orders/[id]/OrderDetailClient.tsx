'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Order, OrderEvent, OrderEventItem, Karigar, OrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, MATERIAL_LABELS, MaterialType,
} from '@/lib/types'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  order: Order
  events: OrderEvent[]
  allKarigars: Pick<Karigar, 'id' | 'name'>[]
}

// ─── Material balance computation ─────────────────────────────────────────────
interface MaterialBalance {
  material: MaterialType
  label: string
  otherLabel?: string
  sentCount: number
  sentG: number
  sentCt: number
  receivedCount: number
  receivedG: number
  receivedCt: number
}

function computeBalance(events: OrderEvent[]): MaterialBalance[] {
  const map = new Map<string, MaterialBalance>()

  for (const ev of events) {
    if (ev.event_type !== 'material_movement' || !ev.direction) continue
    for (const item of ev.order_event_items ?? []) {
      const key = item.material === 'other' ? `other:${item.other_label}` : item.material
      if (!map.has(key)) {
        map.set(key, {
          material: item.material,
          label: MATERIAL_LABELS[item.material],
          otherLabel: item.other_label ?? undefined,
          sentCount: 0, sentG: 0, sentCt: 0,
          receivedCount: 0, receivedG: 0, receivedCt: 0,
        })
      }
      const b = map.get(key)!
      if (ev.direction === 'send') {
        b.sentCount += item.quantity_count ?? 0
        b.sentG += item.weight_g ?? 0
        b.sentCt += item.weight_ct ?? 0
      } else {
        b.receivedCount += item.quantity_count ?? 0
        b.receivedG += item.weight_g ?? 0
        b.receivedCt += item.weight_ct ?? 0
      }
    }
  }

  return Array.from(map.values())
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', ORDER_STATUS_COLORS[status])}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Event timeline item ───────────────────────────────────────────────────────
function EventRow({
  event,
  onDelete,
  onEdit,
}: {
  event: OrderEvent
  onDelete: (id: string) => void
  onEdit: (event: OrderEvent) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isMaterial = event.event_type === 'material_movement'
  const items: OrderEventItem[] = event.order_event_items ?? []

  const meta = event.meta as Record<string, unknown> | null

  function eventLabel() {
    switch (event.event_type) {
      case 'order_created':   return 'Order Created'
      case 'karigar_added':   return `Karigar Assigned: ${(meta?.karigar_name as string) ?? ''}`
      case 'status_changed':  return `Status → ${ORDER_STATUS_LABELS[(meta?.to as OrderStatus) ?? 'started']}`
      case 'order_completed': return 'Order Marked Complete'
      case 'note_added':      return 'Note Added'
      case 'material_movement':
        return event.direction === 'send' ? 'Materials Sent to Karigar' : 'Materials Received from Karigar'
      default: return event.event_type
    }
  }

  const dotColor: Record<string, string> = {
    order_created:    'bg-blue-400',
    karigar_added:    'bg-purple-400',
    status_changed:   'bg-amber-400',
    order_completed:  'bg-green-500',
    material_movement: event.direction === 'send' ? 'bg-orange-400' : 'bg-teal-400',
    note_added:       'bg-gray-400',
  }

  return (
    <div className="flex gap-3">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className={cn('w-3 h-3 rounded-full flex-shrink-0', dotColor[event.event_type] ?? 'bg-gray-300')} />
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isMaterial && (
              event.direction === 'send'
                ? <ArrowUpRight size={14} className="text-orange-500 flex-shrink-0" />
                : <ArrowDownLeft size={14} className="text-teal-500 flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-gray-800">{eventLabel()}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {new Date(event.created_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {!event.is_system && (
              <>
                <button onClick={() => onEdit(event)} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5">
                  <Pencil size={13} />
                </button>
                <button onClick={() => onDelete(event.id)} className="text-gray-300 hover:text-red-500 transition-colors p-0.5">
                  <Trash2 size={13} />
                </button>
              </>
            )}
            {isMaterial && items.length > 0 && (
              <button onClick={() => setExpanded(x => !x)} className="text-gray-400 hover:text-gray-600 p-0.5">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>

        {event.notes && <p className="text-xs text-gray-500 mt-1">{event.notes}</p>}

        {isMaterial && expanded && items.length > 0 && (
          <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Material</th>
                  <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Count</th>
                  <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Wt (g)</th>
                  <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Wt (ct)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-3 py-1.5 text-gray-700">
                      {item.material === 'other' ? (item.other_label ?? 'Other') : MATERIAL_LABELS[item.material]}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600 text-right">{item.quantity_count ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 text-right">{item.weight_g ?? '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 text-right">{item.weight_ct ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function OrderDetailClient({ order, events: initialEvents, allKarigars }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const balance = computeBalance(events)
  const assignedKarigarIds = (order.order_karigars ?? []).map(ok => ok.karigar_id)

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    setDeletingId(id)
    await supabase.from('order_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  function editEvent(event: OrderEvent) {
    router.push(`/admin/orders/${order.id}/events/${event.id}/edit`)
  }

  async function changeStatus(newStatus: OrderStatus) {
    if (newStatus === order.status) { setShowStatusMenu(false); return }
    setUpdatingStatus(true); setShowStatusMenu(false)

    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)

    const eventType = newStatus === 'completed' ? 'order_completed' : 'status_changed'
    const { data: ev } = await supabase
      .from('order_events')
      .insert({
        order_id: order.id,
        event_type: eventType,
        is_system: true,
        meta: { from: order.status, to: newStatus },
      })
      .select('*, order_event_items(*)')
      .single()

    if (ev) setEvents(prev => [...prev, ev])
    setUpdatingStatus(false)
    router.refresh()
  }

  const statuses: OrderStatus[] = ['started', 'in_progress', 'completed', 'cancelled']

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-cormorant font-semibold text-gray-900">{order.order_ref}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusBadge status={order.status} />
            <span className="text-xs text-gray-400">
              Created {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Change status */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(x => !x)}
              disabled={updatingStatus}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {updatingStatus ? 'Updating…' : 'Change Status'}
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-36">
                {statuses.map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                      s === order.status ? 'text-[#B8973A] font-medium' : 'text-gray-700'
                    )}
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link
            href={`/admin/orders/${order.id}/edit`}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={13} /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Reference photo */}
        {order.reference_photo_url && (
          <div className="md:col-span-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.reference_photo_url}
              alt="Reference"
              className="w-full aspect-square object-cover rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Info card */}
        <div className={cn('bg-white border border-gray-200 rounded-lg p-4', order.reference_photo_url ? 'md:col-span-2' : 'md:col-span-3')}>
          {/* Karigars */}
          <div className="mb-3">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Karigars</p>
            {(order.order_karigars ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">None assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(order.order_karigars ?? []).map(ok => (
                  <span key={ok.id} className="text-sm bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                    {ok.karigars?.name ?? '—'}
                  </span>
                ))}
              </div>
            )}
          </div>
          {order.notes && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Material Balance Summary */}
      {balance.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Material Balance</p>
            <p className="text-xs text-gray-400">Net outstanding with karigar</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Material</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Sent (count)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Rcvd (count)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Sent (g)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Rcvd (g)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Sent (ct)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Rcvd (ct)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Balance (g)</th>
                  <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Balance (ct)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {balance.map((b, i) => {
                  const netG = parseFloat((b.sentG - b.receivedG).toFixed(3))
                  const netCt = parseFloat((b.sentCt - b.receivedCt).toFixed(3))
                  return (
                    <tr key={i} className="bg-white hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {b.material === 'other' ? (b.otherLabel ?? 'Other') : b.label}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-right">{b.sentCount || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-right">{b.receivedCount || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-right">{b.sentG || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-right">{b.receivedG || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-right">{b.sentCt || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-right">{b.receivedCt || '—'}</td>
                      <td className={cn('px-4 py-2.5 text-right font-medium', netG > 0 ? 'text-orange-600' : netG < 0 ? 'text-green-600' : 'text-gray-400')}>
                        {netG !== 0 ? (netG > 0 ? `+${netG}` : netG) : '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-medium', netCt > 0 ? 'text-orange-600' : netCt < 0 ? 'text-green-600' : 'text-gray-400')}>
                        {netCt !== 0 ? (netCt > 0 ? `+${netCt}` : netCt) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              <span className="text-orange-500 font-medium">+</span> = still with karigar &nbsp;·&nbsp;
              <span className="text-green-500 font-medium">−</span> = more received than sent (overage)
            </p>
          </div>
        </div>
      )}

      {/* Event History */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Event History</h2>
        <Link
          href={`/admin/orders/${order.id}/events/new`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8973A] text-white rounded text-sm hover:bg-[#a07e2e] transition-colors"
        >
          <Plus size={14} /> Log Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-10 text-center">
          <AlertCircle size={20} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No events yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {events.map((ev, i) => (
            <div key={ev.id} className={i === events.length - 1 ? '[&_.flex-1.bg-gray-100.mt-1]:hidden' : ''}>
              <EventRow
                event={ev}
                onDelete={deleteEvent}
                onEdit={editEvent}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
