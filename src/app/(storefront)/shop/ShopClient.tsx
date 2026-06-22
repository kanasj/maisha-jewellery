'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import StorefrontBackButton from '@/components/StorefrontBackButton'
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
  const [category, setCategory]       = useState(searchParams.get('category') ?? '')
  const [subCategory, setSubCategory] = useState('')
  const [metal, setMetal]             = useState('')
  const [stone, setStone]             = useState('')
  const [priceMin, setPriceMin]       = useState('')
  const [priceMax, setPriceMax]       = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Separate top-level categories and sub-categories
  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories])
  const allSubCategories = useMemo(() => categories.filter((c) => !!c.parent_id), [categories])

  // Sub-categories of the currently selected parent
  const activeParent    = parentCategories.find((c) => c.slug === category)
  const subCategoriesOf = useMemo(
    () => activeParent ? allSubCategories.filter((c) => c.parent_id === activeParent.id) : [],
    [activeParent, allSubCategories]
  )

  // All child slugs of active parent (for "parent selected, no sub" filter)
  const childSlugsOfActive = useMemo(() => subCategoriesOf.map((c) => c.slug), [subCategoriesOf])

  function handleCategoryChange(slug: string) {
    setCategory(slug)
    setSubCategory('')   // reset sub-category whenever parent changes
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const prodSlug = (p as Product & { categories?: { slug: string } }).categories?.slug ?? ''

      if (subCategory) {
        // Sub-category selected → exact match
        if (prodSlug !== subCategory) return false
      } else if (category) {
        // Parent selected → include products in parent category OR any of its children
        if (prodSlug !== category && !childSlugsOfActive.includes(prodSlug)) return false
      }

      if (metal && p.metal_type?.toLowerCase() !== metal.toLowerCase()) return false
      if (stone && p.stone_type?.toLowerCase() !== stone.toLowerCase()) return false
      if (priceMin && p.price_inr !== null && p.price_inr < Number(priceMin)) return false
      if (priceMax && p.price_inr !== null && p.price_inr > Number(priceMax)) return false
      return true
    })
  }, [products, category, subCategory, childSlugsOfActive, metal, stone, priceMin, priceMax])

  const activeCategory    = parentCategories.find((c) => c.slug === category)
  const activeSubCategory = subCategoriesOf.find((c) => c.slug === subCategory)
  const pageTitle = activeSubCategory?.name ?? activeCategory?.name ?? 'All Jewellery'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-6">
        <StorefrontBackButton />
      </div>

      <h1 className="font-cormorant text-5xl mb-2">{pageTitle}</h1>
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
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {/* Category */}
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
              >
                <option value="">All</option>
                {parentCategories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            {/* Sub-category — only shown when a parent has children */}
            {subCategoriesOf.length > 0 && (
              <div>
                <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Sub-category</label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
                >
                  <option value="">All</option>
                  {subCategoriesOf.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
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

            {/* Stone */}
            <div>
              <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Stone</label>
              <select
                value={stone}
                onChange={(e) => setStone(e.target.value)}
                className="w-full border border-[#E8E0D5] bg-transparent text-sm px-3 py-2 focus:outline-none focus:border-[#B8973A]"
              >
                <option value="">All</option>
                {STONE_TYPES.map((s) => <option key={s}>{s}</option>)}
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
            onClick={() => { setCategory(''); setSubCategory(''); setMetal(''); setStone(''); setPriceMin(''); setPriceMax('') }}
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
