'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import type { Product, Category } from '@/lib/types'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

interface Props {
  products: Product[]
  categories: Category[]
}

const METAL_TYPES = ['Gold', 'Silver', 'Platinum', 'Rose Gold']
const STONE_TYPES = ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'None']

export default function ShopClient({ products, categories }: Props) {
  const searchParams = useSearchParams()
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [metal, setMetal] = useState('')
  const [stone, setStone] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category && (p as Product & { categories?: { slug: string } }).categories?.slug !== category) return false
      if (metal && p.metal_type?.toLowerCase() !== metal.toLowerCase()) return false
      if (stone && p.stone_type?.toLowerCase() !== stone.toLowerCase()) return false
      if (priceMin && p.price_inr !== null && p.price_inr < Number(priceMin)) return false
      if (priceMax && p.price_inr !== null && p.price_inr > Number(priceMax)) return false
      return true
    })
  }, [products, category, metal, stone, priceMin, priceMax])

  const activeCategory = categories.find((c) => c.slug === category)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="font-cormorant text-5xl mb-2">{activeCategory?.name ?? 'All Jewellery'}</h1>
      <p className="text-sm text-[#1A1714]/50 mb-10">{filtered.length} piece{filtered.length !== 1 ? 's' : ''}</p>

      {/* Filter bar */}
      <div className="border-y border-[#E8E0D5] py-4 mb-8">
        <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#1A1714]/70 hover:text-[#B8973A] transition-colors">
          <SlidersHorizontal size={14} />
          Filters
          <ChevronDown size={14} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
        {filtersOpen && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]">
                <option value="">All</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Metal</label>
              <select value={metal} onChange={(e) => setMetal(e.target.value)} className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]">
                <option value="">All</option>
                {METAL_TYPES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Stone</label>
              <select value={stone} onChange={(e) => setStone(e.target.value)} className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]">
                <option value="">All</option>
                {STONE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Min Price (₹)</label>
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="0" className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]" />
            </div>
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Max Price (₹)</label>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Any" className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]" />
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-cormorant text-3xl text-[#1A1714]/30">No pieces found</p>
          <button
            onClick={() => { setCategory(''); setMetal(''); setStone(''); setPriceMin(''); setPriceMax('') }}
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
