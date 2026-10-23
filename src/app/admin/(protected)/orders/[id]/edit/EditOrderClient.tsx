'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, Karigar, OrderStatus, ORDER_STATUS_LABELS } from '@/lib/types'
import { ImagePlus, X, Loader2 } from 'lucide-react'

interface Props {
  order: Order
  allKarigars: Pick<Karigar, 'id' | 'name'>[]
}

const STATUSES: OrderStatus[] = ['started', 'in_progress', 'completed', 'cancelled']

export default function EditOrderClient({ order, allKarigars }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const existingKarigarIds = (order.order_karigars ?? []).map(ok => ok.karigar_id)

  const [orderRef, setOrderRef] = useState(order.order_ref)
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [notes, setNotes] = useState(order.notes ?? '')
  const [selectedKarigars, setSelectedKarigars] = useState<string[]>(existingKarigarIds)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(order.reference_photo_url)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoRemoved(false)
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoRemoved(true)
  }

  function toggleKarigar(id: string) {
    setSelectedKarigars(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderRef.trim()) { setError('Order reference is required'); return }
    setSaving(true); setError('')

    try {
      // 1. Upload new photo if provided
      let photoUrl: string | null = order.reference_photo_url
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('Photo upload failed')
        photoUrl = (await res.json()).url
      } else if (photoRemoved) {
        photoUrl = null
      }

      // 2. Update order — capture old status for comparison
      const oldStatus = order.status
      await supabase
        .from('orders')
        .update({
          order_ref: orderRef.trim(),
          status,
          notes: notes.trim() || null,
          reference_photo_url: photoUrl,
        })
        .eq('id', order.id)

      // 3. Log status change event if status changed
      if (status !== oldStatus) {
        const eventType = status === 'completed' ? 'order_completed' : 'status_changed'
        await supabase.from('order_events').insert({
          order_id: order.id,
          event_type: eventType,
          is_system: true,
          meta: { from: oldStatus, to: status },
        })
      }

      // 4. Diff karigar assignments — add new ones, remove dropped ones
      const added = selectedKarigars.filter(id => !existingKarigarIds.includes(id))
      const removed = existingKarigarIds.filter(id => !selectedKarigars.includes(id))

      if (added.length > 0) {
        await supabase
          .from('order_karigars')
          .insert(added.map(kid => ({ order_id: order.id, karigar_id: kid })))

        // Log karigar_added events for newly assigned karigars
        await supabase.from('order_events').insert(
          added.map(kid => ({
            order_id: order.id,
            event_type: 'karigar_added',
            is_system: true,
            meta: {
              karigar_id: kid,
              karigar_name: allKarigars.find(k => k.id === kid)?.name,
            },
          }))
        )
      }

      if (removed.length > 0) {
        await supabase
          .from('order_karigars')
          .delete()
          .eq('order_id', order.id)
          .in('karigar_id', removed)
      }

      router.push(`/admin/orders/${order.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{order.order_ref}</p>
        <h1 className="text-2xl font-cormorant font-semibold text-gray-900">Edit Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Order Ref */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Order Reference *</label>
          <input
            value={orderRef}
            onChange={e => setOrderRef(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  status === s
                    ? 'bg-[#B8973A] text-white border-[#B8973A]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#B8973A]'
                }`}
              >
                {ORDER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {status !== order.status && (
            <p className="text-xs text-amber-600 mt-1.5">Status change will be logged as an event.</p>
          )}
        </div>

        {/* Reference photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Photo</label>
          {photoPreview ? (
            <div className="relative w-32 h-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            >
              <ImagePlus size={22} />
              <span className="text-xs">Upload photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Karigars */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Karigars</label>
          {allKarigars.length === 0 ? (
            <p className="text-sm text-gray-400">No active karigars.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allKarigars.map(k => {
                const isNew = !existingKarigarIds.includes(k.id) && selectedKarigars.includes(k.id)
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleKarigar(k.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors relative ${
                      selectedKarigars.includes(k.id)
                        ? 'bg-[#B8973A] text-white border-[#B8973A]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#B8973A]'
                    }`}
                  >
                    {k.name}
                    {isNew && (
                      <span className="ml-1 text-xs opacity-80">(new)</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {selectedKarigars.some(id => !existingKarigarIds.includes(id)) && (
            <p className="text-xs text-amber-600 mt-1.5">New karigar assignments will be logged as events.</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
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
            {saving ? 'Saving…' : 'Save Changes'}
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
