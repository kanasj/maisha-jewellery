'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Karigar, OrderStatus, ORDER_STATUS_LABELS } from '@/lib/types'
import { compressImage } from '@/lib/compressImage'
import { ImagePlus, Camera, X, Loader2, Plus, Check } from 'lucide-react'

interface Props {
  karigars: Pick<Karigar, 'id' | 'name'>[]
}

const STATUSES: OrderStatus[] = ['started', 'in_progress']

export default function NewOrderClient({ karigars: initialKarigars }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [karigarList, setKarigarList] = useState(initialKarigars)

  const [orderRef, setOrderRef] = useState('')
  const [status, setStatus] = useState<OrderStatus>('started')
  const [notes, setNotes] = useState('')
  const [selectedKarigars, setSelectedKarigars] = useState<string[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Inline add-karigar
  const [showAddKarigar, setShowAddKarigar] = useState(false)
  const [newKarigarName, setNewKarigarName] = useState('')
  const [newKarigarPhone, setNewKarigarPhone] = useState('')
  const [addingKarigar, setAddingKarigar] = useState(false)
  const [addKarigarError, setAddKarigarError] = useState('')

  async function handleAddKarigar() {
    if (!newKarigarName.trim()) { setAddKarigarError('Name is required'); return }
    setAddingKarigar(true); setAddKarigarError('')
    const { data, error: err } = await supabase
      .from('karigars')
      .insert({ name: newKarigarName.trim(), phone: newKarigarPhone.trim() || null })
      .select('id, name')
      .single()
    setAddingKarigar(false)
    if (err) { setAddKarigarError(err.message); return }
    setKarigarList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedKarigars(prev => [...prev, data.id])
    setNewKarigarName('')
    setNewKarigarPhone('')
    setShowAddKarigar(false)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
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
      // 1. Upload photo if provided
      let photoUrl: string | null = null
      if (photoFile) {
        const compressed = await compressImage(photoFile)
        const fd = new FormData()
        fd.append('file', compressed)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error ?? 'Photo upload failed')
        }
        const json = await res.json()
        photoUrl = json.url
      }

      // 2. Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({ order_ref: orderRef.trim(), status, notes: notes.trim() || null, reference_photo_url: photoUrl })
        .select()
        .single()
      if (orderErr) throw new Error(orderErr.message)

      // 3. Assign karigars
      if (selectedKarigars.length > 0) {
        const { error: okErr } = await supabase
          .from('order_karigars')
          .insert(selectedKarigars.map(kid => ({ order_id: order.id, karigar_id: kid })))
        if (okErr) throw new Error(okErr.message)
      }

      // 4. Log order_created system event
      const karigarNames = karigarList
        .filter(k => selectedKarigars.includes(k.id))
        .map(k => k.name)
      await supabase.from('order_events').insert({
        order_id: order.id,
        event_type: 'order_created',
        is_system: true,
        meta: {
          status,
          karigars: karigarNames,
          order_ref: order.order_ref,
        },
        notes: null,
      })

      // 5. Log karigar_added events for each assigned karigar
      if (selectedKarigars.length > 0) {
        await supabase.from('order_events').insert(
          selectedKarigars.map(kid => ({
            order_id: order.id,
            event_type: 'karigar_added',
            is_system: true,
            meta: { karigar_id: kid, karigar_name: karigarList.find(k => k.id === kid)?.name },
            notes: null,
          }))
        )
      }

      router.push(`/admin/orders/${order.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-cormorant font-semibold text-gray-900 mb-6">New Order</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Order Ref */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Order Reference *</label>
          <input
            value={orderRef}
            onChange={e => setOrderRef(e.target.value)}
            placeholder="e.g. ORD-001"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
          <div className="flex gap-2">
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
                onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
              >
                <ImagePlus size={22} />
                <span className="text-xs">Upload photo</span>
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="w-32 h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
              >
                <Camera size={22} />
                <span className="text-xs">Take photo</span>
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Karigars */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Karigars</label>
          <div className="flex flex-wrap gap-2">
            {karigarList.map(k => (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleKarigar(k.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedKarigars.includes(k.id)
                    ? 'bg-[#B8973A] text-white border-[#B8973A]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#B8973A]'
                }`}
              >
                {k.name}
              </button>
            ))}

            {/* Inline add-karigar toggle */}
            {!showAddKarigar && (
              <button
                type="button"
                onClick={() => setShowAddKarigar(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-400 hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
              >
                <Plus size={13} /> New karigar
              </button>
            )}
          </div>

          {/* Inline add form */}
          {showAddKarigar && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <input
                value={newKarigarName}
                onChange={e => setNewKarigarName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddKarigar()}
                placeholder="Name *"
                autoFocus
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40 w-40"
              />
              <input
                value={newKarigarPhone}
                onChange={e => setNewKarigarPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddKarigar()}
                placeholder="Phone (optional)"
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40 w-40"
              />
              <button
                type="button"
                onClick={handleAddKarigar}
                disabled={addingKarigar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8973A] text-white rounded text-sm hover:bg-[#a07e2e] disabled:opacity-50 transition-colors"
              >
                {addingKarigar ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {addingKarigar ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddKarigar(false); setNewKarigarName(''); setNewKarigarPhone(''); setAddKarigarError('') }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={15} />
              </button>
              {addKarigarError && <p className="w-full text-red-500 text-xs mt-0.5">{addKarigarError}</p>}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any notes about this order…"
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
            {saving ? 'Creating…' : 'Create Order'}
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
