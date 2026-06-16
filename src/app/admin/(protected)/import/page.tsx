'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react'

interface Row {
  sku: string
  name: string
  description?: string
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
  _valid: boolean
  _error?: string
}

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const supabase = createClient()

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
        const str = (v: unknown): string | undefined => (v != null ? String(v) : undefined)
        const row: Row = {
          // Accept both template headers and raw field names
          sku:            String(r.sku ?? r.SKU ?? '').trim(),
          name:           String(r.name ?? r.Name ?? r['Product Name'] ?? '').trim(),
          description:    str(r.description ?? r.Description),
          metal_type:     str(r.metal_type ?? r['Metal Type']),
          metal_purity:   str(r.metal_purity ?? r['Metal Purity']),
          stone_type:     str(r.stone_type ?? r['Stone Type'] ?? r['Primary Stone']),
          stone_weight_ct: Number(r.stone_weight_ct ?? r['Stone Weight (ct)'] ?? 0) || undefined,
          gross_weight_g:  Number(r.gross_weight_g  ?? r['Gross Weight (g)']  ?? 0) || undefined,
          price_inr:       Number(r.price_inr ?? r['Price (INR)'] ?? r['Selling Price (INR)'] ?? 0) || undefined,
          mrp_inr:         Number(r.mrp_inr   ?? r['MRP (INR)']  ?? 0) || undefined,
          stock_qty:       Number(r.stock_qty  ?? r['Stock Qty']  ?? 1),
          tags:            str(r.tags ?? r.Tags),
          is_active:       r.is_active !== undefined ? Boolean(r.is_active) : true,
          is_featured:     Boolean(r.is_featured ?? r['Is Featured']),
          _valid: true,
        }
        if (!row.sku) { row._valid = false; row._error = 'Missing SKU' }
        else if (!row.name) { row._valid = false; row._error = 'Missing Name' }
        return row
      })
      setRows(parsed)
      setResult(null)
    }
    reader.readAsArrayBuffer(file)
  }, [])

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
      .map(({ _valid, _error, tags, ...rest }) => ({
        ...rest,
        tags: tags ? String(tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
        images: [],
      }))
    await supabase.from('products').upsert(valid, { onConflict: 'sku' })
    setResult({ imported: valid.length, errors: rows.filter((r) => !r._valid).length })
    setImporting(false)
  }

  const validCount = rows.filter((r) => r._valid).length
  const invalidCount = rows.filter((r) => !r._valid).length

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
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
        Use the template above to prepare your data. Required columns: <strong>SKU</strong>, <strong>Product Name</strong>. Upload the filled file below.
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
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Metal</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-normal">Price</th>
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
                    <td className="px-3 py-2 text-gray-700">{r.name || <span className="text-gray-300 italic">empty</span>}</td>
                    <td className="px-3 py-2 text-gray-400">{r.metal_type ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{r.price_inr ? `₹${r.price_inr.toLocaleString('en-IN')}` : '—'}</td>
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
