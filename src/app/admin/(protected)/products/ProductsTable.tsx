'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import { Pencil, Trash2, Download, Loader2 } from 'lucide-react'

interface AdminProduct {
  id: string
  name: string
  sku: string
  images: string[]
  price_inr: number | null
  is_active: boolean
  categories?: { name: string } | null
}

function ProductThumb({ product }: { product: AdminProduct }) {
  return product.images?.[0] ? (
    <div className="w-10 h-10 relative flex-shrink-0 overflow-hidden rounded">
      <Image src={product.images[0]} alt={product.name} fill className="object-cover" sizes="40px" />
    </div>
  ) : (
    <div className="w-10 h-10 bg-[#F0EBE3] rounded flex items-center justify-center flex-shrink-0">
      <span className="font-cormorant text-[#B8973A]">K</span>
    </div>
  )
}

export default function ProductsTable({ initialProducts }: { initialProducts: AdminProduct[] }) {
  const [products, setProducts]   = useState(initialProducts)
  const [search, setSearch]       = useState('')
  const [downloading, setDownloading] = useState(false)
  const supabase = createClient()

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  async function downloadExcel() {
    setDownloading(true)
    try {
      // Fetch all products with full data (not just the subset loaded for the table)
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false })

      const allProducts = data ?? []

      // Collect all custom field keys across all products so every row has the same columns
      const customKeys = Array.from(
        new Set(allProducts.flatMap((p) => Object.keys((p.custom_fields as Record<string, unknown>) ?? {})))
      ).sort()

      const rows = allProducts.map((p) => {
        const base: Record<string, unknown> = {
          'SKU':               p.sku,
          'Product Name':      p.name,
          'Description':       p.description ?? '',
          'Category':          (p.categories as { name?: string } | null)?.name ?? '',
          'Metal Type':        p.metal_type   ?? '',
          'Metal Purity':      p.metal_purity ?? '',
          'Stone Type':        p.stone_type   ?? '',
          'Stone Weight (ct)': p.stone_weight_ct ?? '',
          'Gross Weight (g)':  p.gross_weight_g  ?? '',
          'Price (INR)':       p.price_inr    ?? '',
          'MRP (INR)':         p.mrp_inr      ?? '',
          'Stock Qty':         p.stock_qty    ?? '',
          'Tags':              Array.isArray(p.tags) ? (p.tags as string[]).join(', ') : '',
          'Is Active':         p.is_active   ? 'TRUE' : 'FALSE',
          'Is Featured':       p.is_featured ? 'TRUE' : 'FALSE',
          'Product Image':     Array.isArray(p.images) ? (p.images as string[]).join(', ') : '',
        }

        // Append custom fields as individual columns
        const cf = (p.custom_fields as Record<string, unknown>) ?? {}
        for (const key of customKeys) {
          base[key] = cf[key] ?? ''
        }

        return base
      })

      const ws = XLSX.utils.json_to_sheet(rows)

      // Auto-width columns
      const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length), 10),
      }))
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')

      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `maisha-products-${date}.xlsx`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      {/* ── Search + Download ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="search"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 max-w-sm border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-[#B8973A]"
        />
        <button
          onClick={downloadExcel}
          disabled={downloading}
          className="flex items-center gap-2 border border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase px-5 py-2.5 hover:bg-[#B8973A] hover:text-white transition-colors disabled:opacity-50"
        >
          {downloading
            ? <Loader2 size={13} className="animate-spin" />
            : <Download size={13} />}
          {downloading ? 'Exporting…' : 'Download Excel'}
        </button>
      </div>

      {/* ── Mobile card list ── */}
      <div className="sm:hidden space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
            <ProductThumb product={p} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-[#1A1714] truncate">{p.name}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{p.sku}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
                {p.price_inr && <span className="text-xs text-gray-500">{formatPrice(p.price_inr)}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link href={`/admin/products/${p.id}`} className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors">
                <Pencil size={15} />
              </Link>
              <button onClick={() => deleteProduct(p.id)} className="p-2 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No products found</div>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Product</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">SKU</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Category</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Price</th>
              <th className="text-left px-4 py-3 text-xs tracking-widest uppercase text-gray-500 font-normal">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProductThumb product={p} />
                    <span className="font-medium text-[#1A1714]">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3 text-gray-500">{p.categories?.name ?? '—'}</td>
                <td className="px-4 py-3">{p.price_inr ? formatPrice(p.price_inr) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/admin/products/${p.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-[#B8973A] transition-colors">
                      <Pencil size={14} />
                    </Link>
                    <button onClick={() => deleteProduct(p.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No products found</div>
        )}
      </div>
    </div>
  )
}
