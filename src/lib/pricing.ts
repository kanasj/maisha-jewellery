// ─── Pricing parameter keys (match site_settings keys with og_/sp_ prefix) ───
export const PRICING_PARAM_KEYS = [
  'gold_rate',
  'silver_rate',
  'diamond_rate',
  'cvd_rate',
  'mosannite_rate',
  'black_diamond_rate',
  'labour_per_gm',
  'stone_labour',
  'silver_labour',
  'polki_solitaire_weight',
  'polki_weight_10_14',
  'polki_weight_14_18',
  'polki_weight_18_24',
  'polki_weight_24_28',
  'polki_weight_28_32',
  'polki_weight_32_42',
  'polki_weight_42_50',
] as const

export type PricingParamKey = typeof PRICING_PARAM_KEYS[number]

export type PricingParams = Record<PricingParamKey, number>

export interface DiamondRateRow {
  type: string
  color: string
  clarity: string
  og_rate: number
  sp_rate: number
}

export interface CalcPriceOptions {
  diamondRates?: DiamondRateRow[]
  rateCol?: 'og_rate' | 'sp_rate'   // which column to use from diamond_rates
  diamondSpMultiplier?: number       // multiplies override rate when computing SP
}

// Build a PricingParams object from raw site_settings rows
export function buildPricingParams(
  rows: { key: string; value: string }[],
  prefix: 'og' | 'sp'
): PricingParams {
  const map: Record<string, number> = {}
  for (const row of rows) {
    const pfx = `${prefix}_`
    if (row.key.startsWith(pfx)) {
      map[row.key.slice(pfx.length)] = parseFloat(row.value) || 0
    }
  }
  return Object.fromEntries(
    PRICING_PARAM_KEYS.map((k) => [k, map[k] ?? 0])
  ) as PricingParams
}

// ─── Product fields needed for calculation ────────────────────────────────────
export interface PricingFields {
  metal_type?: string
  metal_purity?: string
  gross_weight_g?: number | string
  diamond_weight_ct?: number | string
  custom_fields: Record<string, unknown>
}

function parseKarat(purity: string | undefined): number {
  if (!purity) return 0
  const m = purity.match(/[\d.]+/)
  if (!m) return 0
  const v = parseFloat(m[0])
  if (v > 0 && v <= 1) return Math.round(v * 24)
  return v
}

function n(v: unknown): number {
  const parsed = parseFloat(String(v ?? ''))
  return isNaN(parsed) ? 0 : parsed
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function lookupDiamondRate(
  rates: DiamondRateRow[] | undefined,
  type: 'Diamond' | 'CVD',
  color: string,
  clarity: string,
  col: 'og_rate' | 'sp_rate',
  fallback: number
): number {
  if (!rates || rates.length === 0) return fallback
  const row = rates.find((r) => r.type === type && r.color === color && r.clarity === clarity)
  return row ? (row[col] ?? fallback) : fallback
}

// ─── Gold / Rose Gold formula ─────────────────────────────────────────────────
function calcGold(
  cf: Record<string, unknown>,
  purity: number,
  p: PricingParams,
  diamondWeightCt: number | string | undefined,
  opts: CalcPriceOptions
): number {
  const netWt = n(cf.net_weight_gm)
  const rateCol = opts.rateCol ?? 'og_rate'
  const isSp   = rateCol === 'sp_rate'

  // ── Diamond ──
  const diamondColor   = str(cf.diamond_color)   || 'J'
  const diamondClarity = str(cf.diamond_clarity)  || 'VS'
  const diamondOverride = n(cf.diamond_rate_override)
  const diamondRate = diamondOverride > 0
    ? (isSp ? diamondOverride * (opts.diamondSpMultiplier ?? 1) : diamondOverride)
    : lookupDiamondRate(opts.diamondRates, 'Diamond', diamondColor, diamondClarity, rateCol, p.diamond_rate)
  const diamond = n(diamondWeightCt) * diamondRate

  // ── CVD ──
  const cvdColor   = str(cf.cvd_color)   || 'J'
  const cvdClarity = str(cf.cvd_clarity) || 'VS'
  const cvdOverride = n(cf.cvd_rate_override)
  const cvdRate = cvdOverride > 0
    ? (isSp ? cvdOverride * (opts.diamondSpMultiplier ?? 1) : cvdOverride)
    : lookupDiamondRate(opts.diamondRates, 'CVD', cvdColor, cvdClarity, rateCol, p.cvd_rate)
  const cvd = n(cf.cvd_weight_ct) * cvdRate

  const metal  = netWt * (purity / 24) * p.gold_rate
  const labour = netWt * p.labour_per_gm

  const polki =
    n(cf.polki_weight_10_14) * p.polki_weight_10_14 +
    n(cf.polki_weight_14_18) * p.polki_weight_14_18 +
    n(cf.polki_weight_18_24) * p.polki_weight_18_24 +
    n(cf.polki_weight_24_28) * p.polki_weight_24_28 +
    n(cf.polki_weight_28_32) * p.polki_weight_28_32 +
    n(cf.polki_weight_32_42) * p.polki_weight_32_42 +
    n(cf.polki_weight_42_50) * p.polki_weight_42_50 +
    n(cf.polki_solitaire_weight) * p.polki_solitaire_weight

  const moissaniteWt = n(cf.moissanite_weight) || n(cf.mosannite_weight)
  const moissanite   = moissaniteWt * p.mosannite_rate

  const blackDiamond = (n(cf.black_diamond_weight_ct) || n(cf.black_diamond)) * p.black_diamond_rate
  const stonelabour  = n(cf.stone_weight_g) * p.stone_labour

  const piraiKarat  = n(cf.gold_pirai_purity_k)
  const piraiWt     = n(cf.gold_pirai_weight_g)
  const pirai       = piraiWt * (piraiKarat / 24) * p.gold_rate
  const piraiAmount = n(cf.pirai_amount)

  return Math.round(metal + labour + diamond + cvd + polki + moissanite + blackDiamond + stonelabour + pirai + piraiAmount)
}

// ─── Silver formula ───────────────────────────────────────────────────────────
function calcSilver(fields: PricingFields, p: PricingParams): number {
  const gw = n(fields.gross_weight_g)
  return Math.round(gw * p.silver_rate + gw * p.silver_labour)
}

// ─── Price breakdown ──────────────────────────────────────────────────────────
export interface PriceBreakdownLine {
  label: string
  detail: string
  amount: number
}

export function calcPriceBreakdown(
  fields: PricingFields,
  params: PricingParams,
  opts: CalcPriceOptions = {}
): PriceBreakdownLine[] | null {
  const type = (fields.metal_type ?? '').toLowerCase().trim()
  if (type !== 'gold' && type !== 'rose gold') return null
  const karat = parseKarat(fields.metal_purity)
  if (karat === 0) return null

  const cf      = fields.custom_fields
  const rateCol = opts.rateCol ?? 'og_rate'
  const isSp    = rateCol === 'sp_rate'
  const spMult  = opts.diamondSpMultiplier ?? 1
  const p       = params
  const lines: PriceBreakdownLine[] = []

  const fmt = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`

  // Metal
  const netWt = n(cf.net_weight_gm)
  const effectiveGoldRate = (karat / 24) * p.gold_rate
  const metal = netWt * effectiveGoldRate
  if (metal > 0) lines.push({ label: `Metal (${karat}K Gold)`, detail: `${netWt}g × ${fmt(effectiveGoldRate)}/g`, amount: Math.round(metal) })

  // Labour
  const labour = netWt * p.labour_per_gm
  if (labour > 0) lines.push({ label: 'Making Labour', detail: `${netWt}g × ${fmt(p.labour_per_gm)}/g`, amount: Math.round(labour) })

  // Diamond
  const diamondWt      = n(fields.diamond_weight_ct)
  const diamondColor   = str(cf.diamond_color)   || 'J'
  const diamondClarity = str(cf.diamond_clarity)  || 'VS'
  const diamondOverride = n(cf.diamond_rate_override)
  if (diamondWt > 0) {
    const diamondRate = diamondOverride > 0
      ? (isSp ? diamondOverride * spMult : diamondOverride)
      : lookupDiamondRate(opts.diamondRates, 'Diamond', diamondColor, diamondClarity, rateCol, p.diamond_rate)
    const diamondAmt = diamondWt * diamondRate
    const src = diamondOverride > 0 ? 'override' : `${diamondColor} · ${diamondClarity}`
    lines.push({ label: `Diamond (${src})`, detail: `${diamondWt}ct × ${fmt(diamondRate)}/ct`, amount: Math.round(diamondAmt) })
  }

  // CVD
  const cvdWt      = n(cf.cvd_weight_ct)
  const cvdColor   = str(cf.cvd_color)   || 'J'
  const cvdClarity = str(cf.cvd_clarity) || 'VS'
  const cvdOverride = n(cf.cvd_rate_override)
  if (cvdWt > 0) {
    const cvdRate = cvdOverride > 0
      ? (isSp ? cvdOverride * spMult : cvdOverride)
      : lookupDiamondRate(opts.diamondRates, 'CVD', cvdColor, cvdClarity, rateCol, p.cvd_rate)
    const cvdAmt = cvdWt * cvdRate
    const src = cvdOverride > 0 ? 'override' : `${cvdColor} · ${cvdClarity}`
    lines.push({ label: `CVD (${src})`, detail: `${cvdWt}ct × ${fmt(cvdRate)}/ct`, amount: Math.round(cvdAmt) })
  }

  // Polki ranges
  const polkiRanges: [string, string, number][] = [
    ['Polki Solitaire', 'polki_solitaire_weight', p.polki_solitaire_weight],
    ['Polki (10–14)',   'polki_weight_10_14',     p.polki_weight_10_14],
    ['Polki (14–18)',   'polki_weight_14_18',     p.polki_weight_14_18],
    ['Polki (18–24)',   'polki_weight_18_24',     p.polki_weight_18_24],
    ['Polki (24–28)',   'polki_weight_24_28',     p.polki_weight_24_28],
    ['Polki (28–32)',   'polki_weight_28_32',     p.polki_weight_28_32],
    ['Polki (32–42)',   'polki_weight_32_42',     p.polki_weight_32_42],
    ['Polki (42–50)',   'polki_weight_42_50',     p.polki_weight_42_50],
  ]
  for (const [label, cfKey, rate] of polkiRanges) {
    const wt = n(cf[cfKey])
    const amt = wt * rate
    if (amt > 0) lines.push({ label, detail: `${wt}ct × ${fmt(rate)}/ct`, amount: Math.round(amt) })
  }

  // Moissanite
  const moissaniteWt = n(cf.moissanite_weight) || n(cf.mosannite_weight)
  const moissanite   = moissaniteWt * p.mosannite_rate
  if (moissanite > 0) lines.push({ label: 'Moissanite', detail: `${moissaniteWt}ct × ${fmt(p.mosannite_rate)}/ct`, amount: Math.round(moissanite) })

  // Black Diamond
  const bdWt = n(cf.black_diamond_weight_ct) || n(cf.black_diamond)
  const bd   = bdWt * p.black_diamond_rate
  if (bd > 0) lines.push({ label: 'Black Diamond', detail: `${bdWt}ct × ${fmt(p.black_diamond_rate)}/ct`, amount: Math.round(bd) })

  // Stone Labour
  const stoneLabourAmt = n(cf.stone_weight_g) * p.stone_labour
  if (stoneLabourAmt > 0) lines.push({ label: 'Stone Labour', detail: `${n(cf.stone_weight_g)}g × ${fmt(p.stone_labour)}`, amount: Math.round(stoneLabourAmt) })

  // Gold Pirai
  const piraiKarat = n(cf.gold_pirai_purity_k)
  const piraiWt    = n(cf.gold_pirai_weight_g)
  const piraiAmt   = piraiWt * (piraiKarat / 24) * p.gold_rate
  if (piraiAmt > 0) lines.push({ label: `Gold Pirai (${piraiKarat}K)`, detail: `${piraiWt}g × ${fmt((piraiKarat / 24) * p.gold_rate)}/g`, amount: Math.round(piraiAmt) })

  // Pirai Amount
  const piraiFlat = n(cf.pirai_amount)
  if (piraiFlat > 0) lines.push({ label: 'Pirai Amount', detail: 'flat', amount: Math.round(piraiFlat) })

  return lines
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function calcPrice(
  fields: PricingFields,
  params: PricingParams,
  opts: CalcPriceOptions = {}
): number | null {
  const type = (fields.metal_type ?? '').toLowerCase().trim()
  const cf   = fields.custom_fields

  if (type === 'gold' || type === 'rose gold') {
    const karat = parseKarat(fields.metal_purity)
    if (karat === 0) return null
    return calcGold(cf, karat, params, fields.diamond_weight_ct, opts)
  }

  if (type === 'silver') {
    return calcSilver(fields, params)
  }

  return null
}
