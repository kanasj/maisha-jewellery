'use client'
import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'
import { Pencil, Trash2, Check, X, ImageIcon, Loader2, Upload } from 'lucide-react'

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const data = await res.json()
  return data.url as string
}

function CategoryImageUpload({
  value,
  onChange,
  uploading,
  onUpload,
}: {
  value: string | null
  onChange: (url: string | null) => void
  uploading: boolean
  onUpload: (file: File) => void
}) {
  return (
    <div className="mt-4">
      <p className="text-xs tracking-widest uppercase text-gray-500 mb-2">Category Image</p>
      <p className="text-xs text-gray-400 mb-3">
        Portrait format works best (3:4 ratio). This image shows on the homepage collection grid.
      </p>

      {value ? (
        <div className="relative w-36 aspect-[3/4] rounded overflow-hidden border border-gray-200 group">
          <Image src={value} alt="Category" fill className="object-cover" sizes="144px" />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-[#1A1714]/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <label className="cursor-pointer flex items-center gap-1.5 bg-white/90 text-[10px] tracking-widest uppercase px-3 py-1.5 rounded hover:bg-white transition-colors">
              {uploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
              Replace
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1 text-[10px] tracking-widest uppercase text-red-300 hover:text-red-200 transition-colors"
            >
              <X size={10} /> Remove
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-[#1A1714]/60 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-[#B8973A]" />
            </div>
          )}
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center w-36 aspect-[3/4] border-2 border-dashed rounded cursor-pointer transition-colors ${uploading ? 'border-[#B8973A] bg-amber-50' : 'border-gray-200 hover:border-[#B8973A] hover:bg-amber-50/30'}`}>
          {uploading
            ? <Loader2 size={22} className="animate-spin text-[#B8973A] mb-2" />
            : <ImageIcon size={22} className="text-gray-300 mb-2" />
          }
          <p className="text-[11px] text-gray-400 text-center px-2">
            {uploading ? 'Uploading…' : 'Click to upload'}
          </p>
          <p className="text-[10px] text-gray-300 mt-1">JPG, PNG, WEBP</p>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </label>
      )}
    </div>
  )
}

export default function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)

  // Add form
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newImage, setNewImage] = useState<string | null>(null)
  const [addUploading, setAddUploading] = useState(false)

  // Edit form
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editImage, setEditImage] = useState<string | null>(null)
  const [editUploading, setEditUploading] = useState(false)

  const supabase = createClient()

  async function handleAddUpload(file: File) {
    setAddUploading(true)
    const url = await uploadImage(file)
    setNewImage(url)
    setAddUploading(false)
  }

  async function handleEditUpload(file: File) {
    setEditUploading(true)
    const url = await uploadImage(file)
    setEditImage(url)
    setEditUploading(false)
  }

  async function addCategory() {
    if (!newName.trim()) return
    const slug = newSlug.trim() || slugify(newName)
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: newName.trim(), slug, image_url: newImage })
      .select()
      .single()
    if (!error && data) {
      setCategories((prev) => [...prev, data])
      setNewName('')
      setNewSlug('')
      setNewImage(null)
    }
  }

  async function saveEdit(id: string) {
    const { data, error } = await supabase
      .from('categories')
      .update({ name: editName, slug: editSlug, image_url: editImage })
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
      {/* Add Category */}
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

        <CategoryImageUpload
          value={newImage}
          onChange={setNewImage}
          uploading={addUploading}
          onUpload={handleAddUpload}
        />

        <button
          onClick={addCategory}
          disabled={!newName.trim() || addUploading}
          className="mt-5 bg-[#B8973A] text-white text-xs tracking-widest uppercase px-6 py-2.5 hover:bg-[#A07C2A] transition-colors disabled:opacity-50"
        >
          Add Category
        </button>
      </div>

      {/* Category List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
            {editId === cat.id ? (
              <div className="flex-1">
                <div className="flex gap-2 mb-3">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
                  <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className={inputCls} />
                  <button onClick={() => saveEdit(cat.id)} className="p-1.5 hover:bg-green-50 rounded text-green-600 transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 transition-colors"><X size={14} /></button>
                </div>
                <CategoryImageUpload
                  value={editImage}
                  onChange={setEditImage}
                  uploading={editUploading}
                  onUpload={handleEditUpload}
                />
              </div>
            ) : (
              <>
                {/* Thumbnail */}
                <div className="w-10 h-[54px] rounded overflow-hidden bg-[#F0EBE3] flex-shrink-0 relative">
                  {cat.image_url
                    ? <Image src={cat.image_url} alt={cat.name} fill className="object-cover" sizes="40px" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-[#B8973A]/40" /></div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{cat.slug}</p>
                </div>
                <button
                  onClick={() => {
                    setEditId(cat.id)
                    setEditName(cat.name)
                    setEditSlug(cat.slug)
                    setEditImage(cat.image_url ?? null)
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
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
