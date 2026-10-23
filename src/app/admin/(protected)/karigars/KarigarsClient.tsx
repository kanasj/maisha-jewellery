'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Karigar } from '@/lib/types'
import { Plus, Pencil, Check, X, Phone } from 'lucide-react'

interface Props { initialKarigars: Karigar[] }

const empty = { name: '', phone: '', notes: '' }

export default function KarigarsClient({ initialKarigars }: Props) {
  const supabase = createClient()
  const [karigars, setKarigars] = useState<Karigar[]>(initialKarigars)
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const { data, error: err } = await supabase
      .from('karigars')
      .insert({ name: form.name.trim(), phone: form.phone.trim() || null, notes: form.notes.trim() || null })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setKarigars(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(empty)
  }

  function startEdit(k: Karigar) {
    setEditingId(k.id)
    setEditForm({ name: k.name, phone: k.phone ?? '', notes: k.notes ?? '' })
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return
    setSaving(true)
    const { data, error: err } = await supabase
      .from('karigars')
      .update({ name: editForm.name.trim(), phone: editForm.phone.trim() || null, notes: editForm.notes.trim() || null })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setKarigars(prev => prev.map(k => k.id === id ? data : k).sort((a, b) => a.name.localeCompare(b.name)))
    setEditingId(null)
  }

  async function toggleActive(k: Karigar) {
    const { data } = await supabase
      .from('karigars')
      .update({ is_active: !k.is_active })
      .eq('id', k.id)
      .select()
      .single()
    if (data) setKarigars(prev => prev.map(x => x.id === k.id ? data : x))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-cormorant font-semibold text-gray-900">Karigars</h1>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Add New Karigar</p>
        <div className="flex gap-3 flex-wrap">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Name *"
            className="flex-1 min-w-36 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone"
            className="w-40 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
          />
          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            className="flex-1 min-w-48 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#B8973A] text-white rounded text-sm hover:bg-[#a07e2e] transition-colors disabled:opacity-50"
          >
            <Plus size={15} /> Add
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {karigars.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">No karigars yet. Add one above.</p>
        )}
        {karigars.map(k => (
          <div key={k.id} className="px-4 py-3">
            {editingId === k.id ? (
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 min-w-32 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                />
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-36 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                />
                <input
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes"
                  className="flex-1 min-w-40 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B8973A]/40"
                />
                <button onClick={() => saveEdit(k.id)} disabled={saving} className="text-green-600 hover:text-green-700 p-1"><Check size={16} /></button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${k.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${k.is_active ? 'text-gray-900' : 'text-gray-400'}`}>{k.name}</span>
                    {k.phone && (
                      <span className="ml-2 text-xs text-gray-400 inline-flex items-center gap-0.5">
                        <Phone size={11} />{k.phone}
                      </span>
                    )}
                    {k.notes && <p className="text-xs text-gray-400 truncate">{k.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(k)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => toggleActive(k)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      k.is_active
                        ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {k.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
