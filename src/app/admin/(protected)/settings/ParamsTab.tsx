'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProductParam, FieldType } from '@/lib/types'
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, CheckCircle, X, Pencil } from 'lucide-react'

const FIELD_TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: 'text',     label: 'Short Text',  hint: 'Single line, e.g. "Rose Gold Plated"' },
  { value: 'number',   label: 'Number',      hint: 'Numeric value, e.g. 4.5 (size)' },
  { value: 'textarea', label: 'Long Text',   hint: 'Multi-line notes or care instructions' },
  { value: 'select',   label: 'Dropdown',    hint: 'Predefined options the admin picks from' },
  { value: 'toggle',   label: 'Yes / No',    hint: 'Boolean flag, e.g. "Hallmarked"' },
  { value: 'date',     label: 'Date',        hint: 'Calendar date, e.g. "Availability from"' },
]

const inputCls = 'w-full border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] rounded transition-colors'

interface FormState {
  label: string
  field_type: FieldType
  is_required: boolean
  options_raw: string // comma-separated for select
}

const EMPTY_FORM: FormState = { label: '', field_type: 'text', is_required: false, options_raw: '' }

function toMachineName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export default function ParamsTab() {
  const supabase = createClient()
  const [params, setParams] = useState<ProductParam[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  // Add / Edit form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('product_params')
      .select('*')
      .order('sort_order', { ascending: true })
    setParams((data as ProductParam[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowForm(true)
  }

  function startEdit(p: ProductParam) {
    setEditingId(p.id)
    setForm({
      label: p.label,
      field_type: p.field_type,
      is_required: p.is_required,
      options_raw: (p.options ?? []).join(', '),
    })
    setFormError('')
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  async function submitForm() {
    if (!form.label.trim()) { setFormError('Label is required'); return }
    const name = toMachineName(form.label)
    if (!name) { setFormError('Label must contain at least one letter or number'); return }

    // Check uniqueness (when adding)
    if (!editingId) {
      const conflict = params.find((p) => p.name === name)
      if (conflict) { setFormError(`A field named "${name}" already exists`); return }
    }

    setSubmitting(true)
    setFormError('')
    const options =
      form.field_type === 'select'
        ? form.options_raw.split(',').map((s) => s.trim()).filter(Boolean)
        : null

    if (editingId) {
      const { error } = await supabase.from('product_params').update({
        label: form.label.trim(),
        field_type: form.field_type,
        is_required: form.is_required,
        options,
      }).eq('id', editingId)
      if (error) { setFormError(error.message); setSubmitting(false); return }
    } else {
      const sort_order = params.length > 0 ? Math.max(...params.map((p) => p.sort_order)) + 1 : 0
      const { error } = await supabase.from('product_params').insert({
        name,
        label: form.label.trim(),
        field_type: form.field_type,
        is_required: form.is_required,
        options,
        sort_order,
      })
      if (error) { setFormError(error.message); setSubmitting(false); return }
    }

    await load()
    setSubmitting(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    flashSaved()
  }

  async function deleteParam(id: string) {
    await supabase.from('product_params').delete().eq('id', id)
    setDeletingId(null)
    await load()
    flashSaved()
  }

  async function move(index: number, direction: 'up' | 'down') {
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= params.length) return
    const updated = [...params]
    const a = updated[index]
    const b = updated[swapIdx]
    // swap sort_order values
    await Promise.all([
      supabase.from('product_params').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('product_params').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    await load()
  }

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const selectedTypeInfo = FIELD_TYPES.find((t) => t.value === form.field_type)

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
        Custom fields you define here will appear in the <strong>Add / Edit Product</strong> form and on the <strong>product detail page</strong> in the storefront.
      </div>

      {/* Existing params list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : params.length === 0 && !showForm ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-12 text-center">
          <p className="text-sm text-gray-400">No custom fields yet.</p>
          <p className="text-xs text-gray-300 mt-1">Add fields like &quot;Occasion&quot;, &quot;Ring Size&quot;, &quot;Hallmark&quot;, etc.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {params.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(i, 'up')} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => move(i, 'down')} disabled={i === params.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors">
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#1A1714]">{p.label}</span>
                  {p.is_required && (
                    <span className="text-[10px] tracking-widest uppercase bg-red-50 text-red-400 border border-red-100 px-1.5 py-0.5 rounded">Required</span>
                  )}
                  <span className="text-[10px] tracking-widest uppercase bg-gray-50 text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded">
                    {FIELD_TYPES.find((t) => t.value === p.field_type)?.label ?? p.field_type}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.name}</p>
                {p.field_type === 'select' && p.options?.length ? (
                  <p className="text-xs text-gray-400 mt-0.5">Options: {p.options.join(' · ')}</p>
                ) : null}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(p)}
                  className="p-1.5 text-gray-400 hover:text-[#B8973A] transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                {deletingId === p.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => deleteParam(p.id)} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                      Confirm
                    </button>
                    <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(p.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white border border-[#B8973A]/40 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-widest uppercase text-gray-500">{editingId ? 'Edit Field' : 'New Custom Field'}</p>
            <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
          </div>

          {formError && (
            <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded border border-red-100">{formError}</p>
          )}

          {/* Label */}
          <div>
            <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">Field Label *</label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Occasion, Ring Size, Hallmark"
              className={inputCls}
            />
            {form.label && (
              <p className="text-xs text-gray-400 mt-1">Stored as: <code className="font-mono bg-gray-100 px-1 rounded">{toMachineName(form.label)}</code></p>
            )}
          </div>

          {/* Field type */}
          <div>
            <label className="text-xs tracking-widest uppercase text-gray-500 block mb-2">Field Type</label>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, field_type: t.value }))}
                  className={`text-left border rounded-lg px-3 py-2.5 transition-all ${form.field_type === t.value ? 'border-[#B8973A] bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="text-sm font-medium text-[#1A1714]">{t.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Dropdown options */}
          {form.field_type === 'select' && (
            <div>
              <label className="text-xs tracking-widest uppercase text-gray-500 block mb-1">Options</label>
              <input
                value={form.options_raw}
                onChange={(e) => setForm((f) => ({ ...f, options_raw: e.target.value }))}
                placeholder="Wedding, Festival, Daily Wear, Gifting"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Separate each option with a comma</p>
            </div>
          )}

          {/* Required toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm((f) => ({ ...f, is_required: !f.is_required }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.is_required ? 'bg-[#B8973A]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_required ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm text-[#1A1714]">Required field</p>
              <p className="text-xs text-gray-400">Admin must fill this when adding a new product</p>
            </div>
          </label>

          {/* Type hint */}
          {selectedTypeInfo && (
            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-2 rounded">
              <strong>{selectedTypeInfo.label}</strong> — {selectedTypeInfo.hint}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={submitForm}
              disabled={submitting}
              className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-6 py-2.5 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {editingId ? 'Update Field' : 'Add Field'}
            </button>
            <button
              onClick={cancelForm}
              className="border border-gray-200 text-gray-500 text-xs tracking-widest uppercase px-6 py-2.5 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 border border-dashed border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase px-5 py-2.5 hover:bg-amber-50 transition-colors"
        >
          <Plus size={14} />
          Add Custom Field
        </button>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle size={16} /> Saved successfully.
        </div>
      )}
    </div>
  )
}
