'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import StorefrontBackButton from '@/components/StorefrontBackButton'
import type { Product, Category } from '@/lib/types'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

interface Props {
  products: Product[]
  categories: Category[]
}

const METAL_TYPES = ['Gold', 'Silver', 'Platinum', 'Rose Gold']
const FILTERS_KEY = 'storefront_shop_filters'

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? 'null') } catch { return null }
}

export default function ShopClient({ products, categories }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  // URL params take priority over sessionStorage on first load
  const [category,       setCategory]       = useState(() => searchParams.get('category') || readSession()?.category || '')
  const [jewellerySubCat, setJewellerySubCat] = useState(() => searchParams.get('jsc')      || readSession()?.jewellerySubCat || '')
  const [metal,          setMetal]          = useState(() => searchParams.get('metal')    || readSession()?.metal || '')
  const [priceMin,       setPriceMin]       = useState(() => searchParams.get('min')      || readSession()?.priceMin || '')
  const [priceMax,       setPriceMax]       = useState(() => searchParams.get('max')      || readSession()?.priceMax || '')
  const [filtersOpen,    setFiltersOpen]    = useState(() => readSession()?.filtersOpen ?? false)

  // Keep URL and sessionStorage in sync whenever any filter changes
  const syncFilters = useCallback((
    cat: string, jsc: string, met: string, min: string, max: string
  ) => {
    const params = new URLSearchParams()
    if (cat) params.set('category', cat)
    if (jsc) params.set('jsc', jsc)
    if (met) params.set('metal', met)
    if (min) params.set('min', min)
    if (max) params.set('max', max)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, pathname])

  useEffect(() => {
    syncFilters(category, jewellerySubCat, metal, priceMin, priceMax)
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ category, jewellerySubCat, metal, priceMin, priceMax, filtersOpen }))
  }, [category, jewellerySubCat, metal, priceMin, priceMax, filtersOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Unique Stone Category values from product custom fields
  const subCatOptions = useMemo(() => {
    const vals = products
      .map((p) => String((p.custom_fields as Record<string, unknown>)?.stone_category ?? ''))
      .filter(Boolean)
    return Array.from(new Set(vals)).sort()
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const prodSlug = (p as Product & { categories?: { slug: string } }).categories?.slug ?? ''
      if (category && prodSlug !== category) return false
      if (jewellerySubCat) {
        const cf = (p.custom_fields as Record<string, unknown>) ?? {}
        if (String(cf.stone_category ?? '') !== jewellerySubCat) return false
      }
      if (metal && p.metal_type?.toLowerCase() !== metal.toLowerCase()) return false
      if (priceMin && p.price_inr !== null && p.price_inr < Number(priceMin)) return false
      if (priceMax && p.price_inr !== null && p.price_inr > Number(priceMax)) return false
      return true
    })
  }, [products, category, jewellerySubCat, metal, priceMin, priceMax])

  const activeCategory = categories.find((c) => c.slug === category)

  function clearAll() {
    setCategory(''); setJewellerySubCat(''); setMetal(''); setPriceMin(''); setPriceMax('')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-6">
        <StorefrontBackButton />
      </div>

      <h1 className="font-cormorant text-5xl mb-2">{activeCategory?.name ?? 'All Jewellery'}</h1>
      <p className="text-sm text-[#1A1714]/50 mb-10">{filtered.length} piece{filtered.length !== 1 ? 's' : ''}</p>

      {/* Filter bar */}
      <div className="border-y border-[#E8E0D5] py-4 mb-8">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#1A1714]/70 hover:text-[#B8973A] transition-colors"
        >
          <SlidersHorizontal size={14} />
          Filters
          <ChevronDown size={14} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>

        {filtersOpen && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {/* Category */}
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
              >
                <option value="">All</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            {/* Stone Category */}
            {subCatOptions.length > 0 && (
              <div>
                <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Stone Category</label>
                <select
                  value={jewellerySubCat}
                  onChange={(e) => setJewellerySubCat(e.target.value)}
                  className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
                >
                  <option value="">All</option>
                  {subCatOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            {/* Metal */}
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Metal</label>
              <select
                value={metal}
                onChange={(e) => setMetal(e.target.value)}
                className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
              >
                <option value="">All</option>
                {METAL_TYPES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            {/* Price range */}
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Min Price (₹)</label>
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="0"
                className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
              />
            </div>
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Max Price (₹)</label>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Any"
                className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
              />
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-cormorant text-3xl text-[#1A1714]/30">No pieces found</p>
          <button
            onClick={clearAll}
            className="mt-4 text-xs tracking-widest uppercase text-[#B8973A] hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
