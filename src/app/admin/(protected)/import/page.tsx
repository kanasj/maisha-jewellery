'use client'
import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react'

// Columns the parser handles natively — everything else → custom_fields
const STANDARD_COLS = new Set([
  'sku', 'SKU',
  'name', 'Name', 'Product Name',
  'description', 'Description',
  'category_id', 'Category',
  'metal_type', 'Metal Type',
  'metal_purity', 'Metal Purity',
  'stone_type', 'Stone Type', 'Primary Stone',
  'stone_weight_ct', 'Stone Weight (ct)',
  'gross_weight_g', 'Gross Weight (g)',
  'price_inr', 'Price (INR)', 'Selling Price (INR)',
  'mrp_inr', 'MRP (INR)',
  'stock_qty', 'Stock Qty',
  'tags', 'Tags',
  'is_active', 'Is Active',
  'is_featured', 'Is Featured',
  'Product Image',
])

function toMachineName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function toDriveDirectUrl(url: string): string {
  if (!url) return url
  const match = url.match(/[?&]id=([\w-]+)/)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
  return url
}

interface Row {
  sku: string
  name: string
  description?: string
  category_id?: string
  metal_type?: string
  metal_purity?: string
  stone_type?: string
  stone_weight_ct?: number
  gross_weight_g?: number
  price_inr?: number
  mrp_inr?: number
  stock_qty: number
  tags?: string
  is_active: boolean
  is_featured: boolean
  images: string[]
  custom_fields: Record<string, unknown>
  _valid: boolean
  _error?: string
  _customCount: number
}

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [catMap, setCatMap] = useState<Record<string, string>>({}) // name → id
  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('id, name').then(({ data }) => {
      if (data) {
        const m: Record<string, string> = {}
        data.forEach((c: { id: string; name: string }) => { m[c.name.toLowerCase()] = c.id })
        setCatMap(m)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

      const parsed: Row[] = json.map((r: Record<string, unknown>) => {
        const str  = (v: unknown): string | undefined => (v != null ? String(v) : undefined)
        const num  = (v: unknown): number | undefined => { const n = Number(v); return (!v && v !== 0) || isNaN(n) ? undefined : n }

        // Images from Product Image column
        const imgRaw = str(r['Product Image'] ?? r['product_image'])
        const images = imgRaw
          ? imgRaw.split(',').map((u) => toDriveDirectUrl(u.trim())).filter(Boolean)
          : []

        // Category → id lookup
        const catName = str(r.category_id ?? r.Category ?? r.category)
        const category_id = catName ? catMap[catName.toLowerCase()] : undefined

        // Custom fields: any column not in STANDARD_COLS
        const custom_fields: Record<string, unknown> = {}
        for (const key of Object.keys(r)) {
          if (!STANDARD_COLS.has(key)) {
            const val = r[key]
            if (val !== null && val !== undefined && val !== '') {
              custom_fields[toMachineName(key)] = val
            }
          }
        }

        const row: Row = {
          sku:             String(r.sku ?? r.SKU ?? '').trim(),
          name:            String(r.name ?? r.Name ?? r['Product Name'] ?? '').trim(),
          description:     str(r.description ?? r.Description),
          category_id,
          metal_type:      str(r.metal_type ?? r['Metal Type']),
          metal_purity:    str(r.metal_purity ?? r['Metal Purity']),
          stone_type:      str(r.stone_type ?? r['Stone Type'] ?? r['Primary Stone']),
          stone_weight_ct: num(r.stone_weight_ct ?? r['Stone Weight (ct)']),
          gross_weight_g:  num(r.gross_weight_g  ?? r['Gross Weight (g)']),
          price_inr:       num(r.price_inr ?? r['Price (INR)'] ?? r['Selling Price (INR)']),
          mrp_inr:         num(r.mrp_inr   ?? r['MRP (INR)']),
          stock_qty:       Number(r.stock_qty ?? r['Stock Qty'] ?? 1),
          tags:            str(r.tags ?? r.Tags),
          is_active:       r.is_active !== undefined ? Boolean(r.is_active) : true,
          is_featured:     Boolean(r.is_featured ?? r['Is Featured']),
          images,
          custom_fields,
          _valid: true,
          _customCount: Object.keys(custom_fields).length,
        }

        if (!row.sku)  { row._valid = false; row._error = 'Missing SKU' }
        else if (!row.name) { row._valid = false; row._error = 'Missing Name' }
        return row
      })
      setRows(parsed)
      setResult(null)
    }
    reader.readAsArrayBuffer(file)
  }, [catMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
  })

  async function importRows() {
    setImporting(true)
    const valid = rows
      .filter((r) => r._valid)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _valid, _error, _customCount, tags, ...rest }) => ({
        ...rest,
        tags: tags ? String(tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
      }))
    await supabase.from('products').upsert(valid, { onConflict: 'sku' })
    setResult({ imported: valid.length, errors: rows.filter((r) => !r._valid).length })
    setImporting(false)
  }

  const validCount   = rows.filter((r) => r._valid).length
  const invalidCount = rows.filter((r) => !r._valid).length

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <h1 className="font-cormorant text-3xl">Bulk Import</h1>
        <a
          href="/kanas-inventory-template.xlsx"
          download
          className="flex items-center gap-2 border border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase px-5 py-2.5 hover:bg-[#B8973A] hover:text-white transition-colors"
        >
          <Download size={13} />
          Download Template
        </a>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Required columns: <strong>SKU</strong>, <strong>Product Name</strong>. Extra columns are saved as custom fields automatically.
      </p>

      {!rows.length && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-[#B8973A] bg-amber-50' : 'border-gray-200 hover:border-[#B8973A]'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-4 text-gray-300" size={40} />
          <p className="text-sm text-gray-500">Drop your Excel file here, or <span className="text-[#B8973A] underline">browse</span></p>
          <p className="text-xs text-gray-300 mt-2">.xlsx or .xls files only</p>
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{rows.length}</span> rows detected
              {' · '}
              <span className="text-green-600 font-medium">{validCount} valid</span>
              {invalidCount > 0 && <><span> · </span><span className="text-red-500 font-medium">{invalidCount} invalid</span></>}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setRows([]); setResult(null) }}
                className="border border-gray-200 text-gray-500 text-xs tracking-widest uppercase px-4 py-2 hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={importRows}
                disabled={importing || validCount === 0}
                className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-6 py-2 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {importing && <Loader2 size={12} className="animate-spin" />}
                Import {validCount} Products
              </button>
            </div>
          </div>

          {result && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-4 text-sm ${result.errors === 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              {result.errors === 0 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              Successfully imported {result.imported} products.
              {result.errors > 0 && ` ${result.errors} row${result.errors > 1 ? 's' : ''} were skipped due to validation errors.`}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal w-8"></th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">SKU</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Name</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Category</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Price</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Image</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Custom</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal text-red-400">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i} className={r._valid ? '' : 'bg-red-50'}>
                    <td className="px-3 py-2">
                      {r._valid
                        ? <CheckCircle size={12} className="text-green-500" />
                        : <AlertCircle size={12} className="text-red-400" />
                      }
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">{r.sku || <span className="text-gray-300 italic">empty</span>}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{r.name || <span className="text-gray-300 italic">empty</span>}</td>
                    <td className="px-3 py-2 text-gray-400">{r.category_id ? <span className="text-green-600">✓ matched</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-400">{r.price_inr ? `₹${r.price_inr.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{r.images.length > 0 ? <span className="text-blue-500">{r.images.length} img</span> : '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{r._customCount > 0 ? <span className="text-purple-500">{r._customCount} fields</span> : '—'}</td>
                    <td className="px-3 py-2 text-red-400">{r._error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
