// ─── Pricing parameter keys (match site_settings keys with og_/sp_ prefix) ───
export const PRICING_PARAM_KEYS = [
  'gold_rate',
  'silver_rate',
  'diamond_rate',
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
  metal_purity?: string     // "18K", "22K", "24K", "14K" etc.
  gross_weight_g?: number | string
  custom_fields: Record<string, unknown>
}

// Parse karat number from metal_purity string ("18K" → 18, "22K" → 22)
function parseKarat(purity: string | undefined): number {
  if (!purity) return 0
  const m = purity.match(/[\d.]+/)
  if (!m) return 0
  const v = parseFloat(m[0])
  // If expressed as decimal purity (e.g. 0.750 for 18K), convert to karat
  if (v > 0 && v <= 1) return Math.round(v * 24)
  return v
}

function n(v: unknown): number {
  const parsed = parseFloat(String(v ?? ''))
  return isNaN(parsed) ? 0 : parsed
}

// ─── Gold formula ─────────────────────────────────────────────────────────────
// OG Price =
//   Net Weight (gm) × (Metal Purity/24) × Gold Rate
// + Net Weight (gm) × Labour (per gm)
// + Diamond Weight (ct) × Diamond Rate
// + Polki Weight (10-14) × Polki param (10-14)
// + ... (all polki ranges)
// + Moissanite Weight × Mosannite Rate
// + Black Diamond Weight × Black Diamond Rate
// + Total Stone Weight (g) × Stone Labour
// + Gold Pirai Weight × (Gold Pirai Karat/24) × Gold Rate
// + Pirai Amount

function calcGold(cf: Record<string, unknown>, purity: number, p: PricingParams): number {
  const netWt = n(cf.net_weight_gm)

  const metal   = netWt * (purity / 24) * p.gold_rate
  const labour  = netWt * p.labour_per_gm
  const diamond = n(cf.diamond_weight_ct) * p.diamond_rate
  const polki   =
    n(cf.polki_weight_10_14) * p.polki_weight_10_14 +
    n(cf.polki_weight_14_18) * p.polki_weight_14_18 +
    n(cf.polki_weight_18_24) * p.polki_weight_18_24 +
    n(cf.polki_weight_24_28) * p.polki_weight_24_28 +
    n(cf.polki_weight_28_32) * p.polki_weight_28_32 +
    n(cf.polki_weight_32_42) * p.polki_weight_32_42 +
    n(cf.polki_weight_42_50) * p.polki_weight_42_50 +
    n(cf.polki_solitaire_weight) * p.polki_solitaire_weight

  // Check both spellings for moissanite
  const moissaniteWt = n(cf.moissanite_weight) || n(cf.mosannite_weight)
  const moissanite  = moissaniteWt * p.mosannite_rate

  const blackDiamond = (n(cf.black_diamond_weight_ct) || n(cf.black_diamond)) * p.black_diamond_rate
  const stonelabour  = n(cf.total_stone_weight_g) * p.stone_labour

  const piraiKarat  = n(cf.gold_pirai_karat)
  const piraiWt     = n(cf.gold_pirai_weight)
  const pirai       = piraiWt * (piraiKarat / 24) * p.gold_rate
  const piraiAmount = n(cf.pirai_amount)

  return Math.round(metal + labour + diamond + polki + moissanite + blackDiamond + stonelabour + pirai + piraiAmount)
}

// ─── Silver formula ───────────────────────────────────────────────────────────
// OG Price = Gross Weight × Silver Rate + Gross Weight × Silver Labour

function calcSilver(fields: PricingFields, p: PricingParams): number {
  const gw = n(fields.gross_weight_g)
  return Math.round(gw * p.silver_rate + gw * p.silver_labour)
}

// ─── Main entry point ─────────────────────────────────────────────────────────
// Returns the computed price, or null if the metal type is unsupported / data missing.
export function calcPrice(fields: PricingFields, params: PricingParams): number | null {
  const type = (fields.metal_type ?? '').toLowerCase().trim()
  const cf   = fields.custom_fields

  if (type === 'gold' || type === 'rose gold') {
    const karat = parseKarat(fields.metal_purity)
    if (karat === 0) return null   // purity not set — can't calculate
    return calcGold(cf, karat, params)
  }

  if (type === 'silver') {
    return calcSilver(fields, params)
  }

  return null   // Platinum, other types → manual input
}
