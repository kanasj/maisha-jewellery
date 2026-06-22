'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, X } from 'lucide-react'

// ─── Parameter definitions ────────────────────────────────────────────────────
const PARAM_GROUPS = [
  {
    group: 'Rates',
    hint: 'Per gram / per carat rates. Gold rate is for 24K — lower carats are computed automatically.',
    params: [
      { label: 'Gold Rate (24K)',    key: 'gold_rate',          unit: '₹/gm' },
      { label: 'Silver Rate',        key: 'silver_rate',        unit: '₹/gm' },
      { label: 'Diamond Rate',       key: 'diamond_rate',       unit: '₹/ct' },
      { label: 'Mosannite Rate',     key: 'mosannite_rate',     unit: '₹/ct' },
      { label: 'Black Diamond Rate', key: 'black_diamond_rate', unit: '₹/ct' },
    ],
  },
  {
    group: 'Labour',
    hint: 'Making / labour charges',
    params: [
      { label: 'Labour (per gm)', key: 'labour_per_gm', unit: '₹/gm' },
      { label: 'Stone Labour',    key: 'stone_labour',  unit: '₹' },
      { label: 'Silver Labour',   key: 'silver_labour', unit: '₹' },
    ],
  },
  {
    group: 'Polki Weights',
    hint: 'Rate per unit for each polki weight range',
    params: [
      { label: 'Polki Solitaire',      key: 'polki_solitaire_weight', unit: '₹/ct' },
      { label: 'Polki Weight (10–14)', key: 'polki_weight_10_14',     unit: '₹/ct' },
      { label: 'Polki Weight (14–18)', key: 'polki_weight_14_18',     unit: '₹/ct' },
      { label: 'Polki Weight (18–24)', key: 'polki_weight_18_24',     unit: '₹/ct' },
      { label: 'Polki Weight (24–28)', key: 'polki_weight_24_28',     unit: '₹/ct' },
      { label: 'Polki Weight (28–32)', key: 'polki_weight_28_32',     unit: '₹/ct' },
      { label: 'Polki Weight (32–42)', key: 'polki_weight_32_42',     unit: '₹/ct' },
      { label: 'Polki Weight (42–50)', key: 'polki_weight_42_50',     unit: '₹/ct' },
    ],
  },
]

// Default OG values provided by user
const DEFAULTS: Record<string, string> = {
  gold_rate:             '15500',
  silver_rate:           '260',
  diamond_rate:          '15000',
  mosannite_rate:        '500',
  black_diamond_rate:    '5000',
  labour_per_gm:         '850',
  stone_labour:          '350',
  silver_labour:         '150',
  polki_solitaire_weight:'50000',
  polki_weight_10_14:    '3000',
  polki_weight_14_18:    '6000',
  polki_weight_18_24:    '7500',
  polki_weight_24_28:    '10000',
  polki_weight_28_32:    '11500',
  polki_weight_32_42:    '20000',
  polki_weight_42_50:    '20000',
}

const ALL_KEYS = PARAM_GROUPS.flatMap((g) => g.params.map((p) => p.key))

type ValMap = Record<string, string>

function computeSp(ogVal: string, multVal: string): string {
  const o = parseFloat(ogVal)
  const m = parseFloat(multVal)
  if (!ogVal || !multVal || isNaN(o) || isNaN(m)) return ''
  return String(Math.round(o * m))
}

export default function PricingTab() {
  const [og, setOg]     = useState<ValMap>({})
  const [mult, setMult] = useState<ValMap>({})  // per-row multiplier
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const supabase = createClient()

  // Load existing values
  useEffect(() => {
    const keys = [
      ...ALL_KEYS.map((k) => `og_${k}`),
      ...ALL_KEYS.map((k) => `mult_${k}`),
    ]
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', keys)
      .then(({ data }) => {
        const ogMap: ValMap   = {}
        const multMap: ValMap = {}
        for (const row of data ?? []) {
          if (row.key.startsWith('og_'))   ogMap[row.key.slice(3)]   = row.value
          if (row.key.startsWith('mult_')) multMap[row.key.slice(5)] = row.value
        }
        // Seed defaults for any og key that has no saved value
        for (const k of ALL_KEYS) {
          if (!ogMap[k] && DEFAULTS[k]) ogMap[k] = DEFAULTS[k]
        }
        setOg(ogMap)
        setMult(multMap)
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateOg = useCallback((key: string, val: string) => {
    setOg((prev) => ({ ...prev, [key]: val }))
  }, [])

  const updateMult = useCallback((key: string, val: string) => {
    setMult((prev) => ({ ...prev, [key]: val }))
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    const rows = [
      ...ALL_KEYS.map((k) => ({ key: `og_${k}`,   value: og[k]   ?? '' })),
      ...ALL_KEYS.map((k) => ({ key: `mult_${k}`,  value: mult[k] ?? '' })),
      // also persist computed sp so other parts of the app can read it directly
      ...ALL_KEYS.map((k) => ({ key: `sp_${k}`, value: computeSp(og[k] ?? '', mult[k] ?? '') })),
    ]
    await supabase.from('site_settings').upsert(rows, { onConflict: 'key' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading rates…
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
        <span><span className="font-medium text-gray-700">OG Price</span> — your actual cost / wholesale rate</span>
        <span className="text-gray-300">|</span>
        <span><span className="font-medium text-gray-700">× Multiplier</span> — markup factor (e.g. 1.3 = 30% markup)</span>
        <span className="text-gray-300">|</span>
        <span><span className="font-medium text-[#B8973A]">Selling Price</span> — auto-computed (OG × multiplier)</span>
      </div>

      {PARAM_GROUPS.map((group) => (
        <div key={group.group} className="bg-white border border-gray-200 rounded-lg overflow-hidden">

          {/* Group header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-[#FAF8F5]">
            <p className="text-xs tracking-widest uppercase text-[#B8973A] font-medium">{group.group}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{group.hint}</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_140px_110px_140px] gap-x-2 px-4 py-2 border-b border-gray-100">
            <div />
            <p className="text-[10px] tracking-widest uppercase text-gray-400 text-center">OG Price</p>
            <p className="text-[10px] tracking-widest uppercase text-gray-500 text-center">× Multiplier</p>
            <p className="text-[10px] tracking-widest uppercase text-[#B8973A] text-center">Selling Price</p>
          </div>

          {/* Rows */}
          {group.params.map((p, i) => {
            const spVal = computeSp(og[p.key] ?? '', mult[p.key] ?? '')
            return (
              <div
                key={p.key}
                className={`grid grid-cols-[1fr_140px_110px_140px] gap-x-2 items-center px-4 py-2.5 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
              >
                {/* Label */}
                <p className="text-sm text-gray-700">{p.label}</p>

                {/* OG Price input */}
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={og[p.key] ?? ''}
                    onChange={(e) => updateOg(p.key, e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right pr-10 focus:outline-none focus:border-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 pointer-events-none">{p.unit}</span>
                </div>

                {/* Multiplier input */}
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">×</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={mult[p.key] ?? ''}
                    onChange={(e) => updateMult(p.key, e.target.value)}
                    placeholder="1.00"
                    className="w-full border border-[#B8973A]/40 rounded px-2 py-1.5 text-sm text-center pl-6 focus:outline-none focus:border-[#B8973A] bg-amber-50/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {mult[p.key] && (
                    <button
                      type="button"
                      onClick={() => updateMult(p.key, '')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Selling Price — read-only computed */}
                <div className={`relative rounded px-2 py-1.5 text-sm text-right pr-10 border ${spVal ? 'border-[#B8973A]/30 bg-amber-50/40 text-[#1A1714] font-medium' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>
                  {spVal
                    ? <>₹{Number(spVal).toLocaleString('en-IN')}</>
                    : <span className="text-xs">—</span>
                  }
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 pointer-events-none">{p.unit}</span>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Save */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-[#B8973A] text-white text-xs tracking-widest uppercase px-8 py-3 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save Rates
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
