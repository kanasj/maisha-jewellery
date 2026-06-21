'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'
import { Pencil, Trash2, Check, X } from 'lucide-react'

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const supabase = createClient()

  async function addCategory() {
    if (!newName.trim()) return
    const slug = newSlug.trim() || slugify(newName)
    const { data, error } = await supabase.from('categories').insert({ name: newName.trim(), slug }).select().single()
    if (!error && data) {
      setCategories((prev) => [...prev, data])
      setNewName('')
      setNewSlug('')
    }
  }

  async function saveEdit(id: string) {
    const { data, error } = await supabase
      .from('categories')
      .update({ name: editName, slug: editSlug })
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setCategories((prev) => prev.map((c) => c.id === id ? data : c))
      setEditId(null)
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Products in it will be uncategorized.')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  const inputCls = 'flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#B8973A] rounded'

  return (
    <div className="max-w-lg">
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs tracking-widest uppercase text-gray-500 mb-4">Add Category</p>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setNewSlug(slugify(e.target.value)) }}
            placeholder="Name (e.g. Rings)"
            className={inputCls}
          />
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="Slug (e.g. rings)"
            className={inputCls}
          />
        </div>
        <button
          onClick={addCategory}
          disabled={!newName.trim()}
          className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-6 py-2.5 hover:bg-[#A07C2A] transition-colors disabled:opacity-50"
        >
          Add Category
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
            {editId === cat.id ? (
              <>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className={inputCls} />
                <button onClick={() => saveEdit(cat.id)} className="p-1.5 hover:bg-green-50 rounded text-green-600 transition-colors"><Check size={14} /></button>
                <button onClick={() => setEditId(null)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 transition-colors"><X size={14} /></button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{cat.slug}</p>
                </div>
                <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditSlug(cat.slug) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors"><Pencil size={14} /></button>
                <button onClick={() => deleteCategory(cat.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No categories yet</div>
        )}
      </div>
    </div>
  )
}
