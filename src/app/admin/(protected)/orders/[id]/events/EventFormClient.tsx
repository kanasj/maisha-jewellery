'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OrderEvent, OrderEventItem, MaterialType, MATERIAL_LABELS } from '@/lib/types'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface LineItem {
  material: MaterialType
  other_label: string
  quantity_count: string
  weight_g: string
  weight_ct: string
}

const MATERIALS: MaterialType[] = ['diamond', 'stone', 'cvd', 'gold', 'silver', 'other']

const defaultLine = (): LineItem => ({
  material: 'gold',
  other_label: '',
  quantity_count: '',
  weight_g: '',
  weight_ct: '',
})

function lineFromItem(item: OrderEventItem): LineItem {
  return {
    material: item.material,
    other_label: item.other_label ?? '',
    quantity_count: item.quantity_count?.toString() ?? '',
    weight_g: item.weight_g?.toString() ?? '',
    weight_ct: item.weight_ct?.toString() ?? '',
  }
}

interface Props {
  orderId: string
  orderRef: string
  existingEvent: (OrderEvent & { order_event_items?: OrderEventItem[] }) | null
}

export default function EventFormClient({ orderId, orderRef, existingEvent }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const isEdit = !!existingEvent

  const [eventType, setEventType] = useState<'material_movement' | 'note_added'>(
    existingEvent?.event_type === 'note_added' ? 'note_added' : 'material_movement'
  )
  const [direction, setDirection] = useState<'send' | 'receive'>(
    (existingEvent?.direction as 'send' | 'receive') ?? 'send'
  )
  const [lines, setLines] = useState<LineItem[]>(
    existingEvent?.order_event_items?.length
      ? existingEvent.order_event_items.map(lineFromItem)
      : [defaultLine()]
  )
  const [notes, setNotes] = useState(existingEvent?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function addLine() { setLines(prev => [...prev, defaultLine()]) }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (eventType === 'material_movement' && lines.length === 0) {
      setError('Add at least one material line'); return
    }
    setSaving(true); setError('')

    try {
      if (isEdit) {
        // Update event notes/direction
        await supabase
          .from('order_events')
          .update({ notes: notes.trim() || null, direction: eventType === 'material_movement' ? direction : null })
          .eq('id', existingEvent.id)

        if (eventType === 'material_movement') {
          // Delete old items and re-insert
          await supabase.from('order_event_items').delete().eq('event_id', existingEvent.id)
          const items = lines.map(l => ({
            event_id: existingEvent.id,
            material: l.material,
            other_label: l.material === 'other' ? l.other_label.trim() || null : null,
            quantity_count: l.quantity_count ? parseInt(l.quantity_count) : null,
            weight_g: l.weight_g ? parseFloat(l.weight_g) : null,
            weight_ct: l.weight_ct ? parseFloat(l.weight_ct) : null,
          }))
          await supabase.from('order_event_items').insert(items)
        }
      } else {
        // Create new event
        const { data: ev, error: evErr } = await supabase
          .from('order_events')
          .insert({
            order_id: orderId,
            event_type: eventType,
            direction: eventType === 'material_movement' ? direction : null,
            notes: notes.trim() || null,
            is_system: false,
          })
          .select()
          .single()
        if (evErr) throw new Error(evErr.message)

        if (eventType === 'material_movement') {
          const items = lines.map(l => ({
            event_id: ev.id,
            material: l.material,
            other_label: l.material === 'other' ? l.other_label.trim() || null : null,
            quantity_count: l.quantity_count ? parseInt(l.quantity_count) : null,
            weight_g: l.weight_g ? parseFloat(l.weight_g) : null,
            weight_ct: l.weight_ct ? parseFloat(l.weight_ct) : null,
          }))
          const { error: itemErr } = await supabase.from('order_event_items').insert(items)
          if (itemErr) throw new Error(itemErr.message)
        }
      }

      router.push(`/admin/orders/${orderId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-1">
        <p className="text-xs text-gray-400 uppercase tracking-widest">{orderRef}</p>
        <h1 className="text-2xl font-cormorant font-semibold text-gray-900">
          {isEdit ? 'Edit Event' : 'Log Event'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Event type selector — only on new events */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Type</label>
            <div className="flex gap-2">
              {(['material_movement', 'note_added'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEventType(t)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    eventType === t
                      ? 'bg-[#B8973A] text-white border-[#B8973A]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#B8973A]'
                  }`}
                >
                  {t === 'material_movement' ? 'Material Movement' : 'Note Only'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Direction — only for material movement */}
        {(eventType === 'material_movement') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Direction</label>
            <div className="flex gap-2">
              {(['send', 'receive'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                    direction === d
                      ? d === 'send'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-teal-500 text-white border-teal-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {d === 'send' ? '↑ Send to Karigar' : '↓ Receive from Karigar'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Material lines */}
        {eventType === 'material_movement' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Materials</label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-xs text-[#B8973A] hover:underline"
              >
                <Plus size={12} /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={line.material}
                      onChange={e => updateLine(i, 'material', e.target.value)}
                      className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                    >
                      {MATERIALS.map(m => (
                        <option key={m} value={m}>{MATERIAL_LABELS[m]}</option>
                      ))}
                    </select>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {line.material === 'other' && (
                    <input
                      value={line.other_label}
                      onChange={e => updateLine(i, 'other_label', e.target.value)}
                      placeholder="Describe material…"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                    />
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Count</label>
                      <input
                        type="number"
                        min="0"
                        value={line.quantity_count}
                        onChange={e => updateLine(i, 'quantity_count', e.target.value)}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Weight (g)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.weight_g}
                        onChange={e => updateLine(i, 'weight_g', e.target.value)}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Weight (ct)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={line.weight_ct}
                        onChange={e => updateLine(i, 'weight_ct', e.target.value)}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes…"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40 resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-[#B8973A] text-white rounded text-sm hover:bg-[#a07e2e] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Event'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2 border border-gray-200 text-gray-600 rounded text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
