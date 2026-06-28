'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle } from 'lucide-react'

const COLORS    = ['D','E','F','G','H','I','J','K','L','M'] as const
const CLARITIES = ['VVS','VS','VS2','VVS2','SI','SI2'] as const

type StoneType = 'Diamond' | 'CVD'
type CellMap   = Record<string, { og: string; sp: string }>

function cellKey(type: StoneType, color: string, clarity: string) {
  return `${type}|${color}|${clarity}`
}

export default function DiamondParamsTab() {
  const [stoneType,   setStoneType]   = useState<StoneType>('Diamond')
  const [cells,       setCells]       = useState<CellMap>({})
  const [multiplier,  setMultiplier]  = useState('2')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: rates }, { data: settings }] = await Promise.all([
        supabase.from('diamond_rates').select('*'),
        supabase.from('site_settings').select('key, value').eq('key', 'diamond_sp_multiplier'),
      ])
      const map: CellMap = {}
      for (const r of rates ?? []) {
        map[cellKey(r.type as StoneType, r.color, r.clarity)] = {
          og: r.og_rate != null ? String(r.og_rate) : '',
          sp: r.sp_rate != null ? String(r.sp_rate) : '',
        }
      }
      setCells(map)
      const m = settings?.find((r: { key: string; value: string }) => r.key === 'diamond_sp_multiplier')?.value
      if (m) setMultiplier(m)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateCell(type: StoneType, color: string, clarity: string, field: 'og' | 'sp', val: string) {
    const k = cellKey(type, color, clarity)
    setCells((prev) => ({ ...prev, [k]: { ...(prev[k] ?? { og: '', sp: '' }), [field]: val } }))
  }

  function applyMultiplierToAll() {
    const m = parseFloat(multiplier)
    if (isNaN(m) || m <= 0) return
    setCells((prev) => {
      const next = { ...prev }
      for (const type of ['Diamond', 'CVD'] as StoneType[]) {
        for (const color of COLORS) {
          for (const clarity of CLARITIES) {
            const k = cellKey(type, color, clarity)
            const og = parseFloat(next[k]?.og ?? '')
            if (!isNaN(og) && og > 0) {
              next[k] = { og: next[k]?.og ?? '', sp: String(Math.round(og * m)) }
            }
          }
        }
      }
      return next
    })
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const rows = []
    for (const type of ['Diamond', 'CVD'] as StoneType[]) {
      for (const color of COLORS) {
        for (const clarity of CLARITIES) {
          const k = cellKey(type, color, clarity)
          rows.push({
            type,
            color,
            clarity,
            og_rate: parseFloat(cells[k]?.og ?? '0') || 0,
            sp_rate: parseFloat(cells[k]?.sp ?? '0') || 0,
          })
        }
      }
    }
    await Promise.all([
      supabase.from('diamond_rates').upsert(rows, { onConflict: 'type,color,clarity' }),
      supabase.from('site_settings').upsert(
        [{ key: 'diamond_sp_multiplier', value: multiplier }],
        { onConflict: 'key' }
      ),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading diamond rates…
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Controls row */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-center gap-4">
        {/* Diamond / CVD toggle */}
        <div className="flex rounded border border-gray-200 overflow-hidden">
          {(['Diamond', 'CVD'] as StoneType[]).map((t) => (
            <button
              key={t}
              onClick={() => setStoneType(t)}
              className={`px-5 py-2 text-xs tracking-widest uppercase transition-colors ${
                stoneType === t ? 'bg-[#B8973A] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* SP Multiplier */}
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-wide text-gray-500 uppercase">SP Multiplier</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className="w-20 border border-gray-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#B8973A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={applyMultiplierToAll}
            className="border border-[#B8973A] text-[#B8973A] text-xs tracking-widest uppercase px-3 py-1.5 rounded hover:bg-amber-50 transition-colors"
          >
            Apply to All
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
        <span><span className="font-medium text-gray-700">Top cell (OG)</span> — cost/wholesale rate per carat</span>
        <span className="text-gray-300">|</span>
        <span><span className="font-medium text-[#B8973A]">Bottom cell (SP)</span> — selling rate per carat</span>
        <span className="text-gray-300">|</span>
        <span>All values in ₹/ct · Currently viewing: <strong>{stoneType}</strong></span>
      </div>

      {/* Matrix */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#FAF8F5]">
              <th className="text-left px-4 py-3 text-[10px] tracking-widest uppercase text-gray-400 font-medium border-b border-r border-gray-100 w-16">Color</th>
              {CLARITIES.map((cl) => (
                <th key={cl} className="px-2 py-3 text-[10px] tracking-widest uppercase text-gray-600 font-medium border-b border-r border-gray-100 last:border-r-0 text-center min-w-[90px]">
                  {cl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COLORS.map((color, ci) => (
              <tr key={color} className={ci % 2 === 1 ? 'bg-gray-50/40' : ''}>
                <td className="px-4 py-2 border-r border-b border-gray-100 font-medium text-[#1A1714]">{color}</td>
                {CLARITIES.map((clarity) => {
                  const k    = cellKey(stoneType, color, clarity)
                  const cell = cells[k] ?? { og: '', sp: '' }
                  return (
                    <td key={clarity} className="border-r border-b border-gray-100 last:border-r-0 p-1.5">
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cell.og}
                          onChange={(e) => updateCell(stoneType, color, clarity, 'og', e.target.value)}
                          placeholder="OG"
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right focus:outline-none focus:border-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={cell.sp}
                          onChange={(e) => updateCell(stoneType, color, clarity, 'sp', e.target.value)}
                          placeholder="SP"
                          className="w-full border border-[#B8973A]/40 rounded px-1.5 py-1 text-xs text-right bg-amber-50/30 focus:outline-none focus:border-[#B8973A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-8 py-3 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save Diamond Rates
        </button>
        {saved && (
          <span className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle size={16} /> Saved!
          </span>
        )}
      </div>
    </div>
  )
}
