import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/ProductCard'
import HeroBanner from '@/components/HeroBanner'
import type { Product, Category } from '@/lib/types'

export default async function HomePage() {
  const supabase = createClient()

  const [{ data: categories }, { data: featured }, { data: settings }, { data: catProducts }] = await Promise.all([
    supabase.from('categories').select('*').is('parent_id', null).order('name'),
    supabase.from('products').select('*, categories(name, slug)').eq('is_active', true).eq('is_featured', true).limit(8),
    supabase.from('site_settings').select('key, value').in('key', ['banner_1', 'banner_2', 'banner_3']),
    // One product per category to use as category cover image
    supabase.from('products').select('category_id, images').eq('is_active', true).neq('images', '{}').limit(500),
  ])

  // Build map: category_id → first image
  const catImageMap: Record<string, string> = {}
  for (const p of (catProducts ?? [])) {
    if (p.category_id && p.images?.[0] && !catImageMap[p.category_id]) {
      catImageMap[p.category_id] = p.images[0]
    }
  }

  const settingsMap = Object.fromEntries((settings ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
  const banners = [
    settingsMap['banner_1'] ?? '',
    settingsMap['banner_2'] ?? '',
    settingsMap['banner_3'] ?? '',
  ]

  return (
    <div>
      {/* Hero — rotating banner */}
      <HeroBanner banners={banners} />

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <p className="text-xs tracking-[0.4em] uppercase text-[#B8973A] text-center mb-3">Browse By</p>
          <h2 className="font-cormorant text-4xl text-center mb-12">Our Collections</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {(categories as Category[]).map((cat) => (
              <Link
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                className="group relative aspect-[3/4] bg-[#F0EBE3] overflow-hidden flex items-end justify-center pb-6"
              >
                {catImageMap[cat.id] && (
                  <Image
                    src={catImageMap[cat.id]}
                    alt={cat.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1714]/60 to-transparent" />
                <p className="relative z-10 font-cormorant text-xl text-white group-hover:text-[#B8973A] transition-colors">
                  {cat.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured && featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 border-t border-[#E8E0D5]">
          <p className="text-xs tracking-[0.4em] uppercase text-[#B8973A] text-center mb-3">Handpicked</p>
          <h2 className="font-cormorant text-4xl text-center mb-12">Featured Pieces</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(featured as Product[]).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/shop" className="inline-block border border-[#1A1714] text-[#1A1714] text-xs tracking-[0.3em] uppercase px-10 py-4 hover:bg-[#1A1714] hover:text-white transition-colors">
              View All
            </Link>
          </div>
        </section>
      )}

      {/* About strip */}
      <section className="bg-[#1A1714] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.4em] uppercase text-[#B8973A] mb-4">Our Story</p>
          <h2 className="font-cormorant text-4xl font-light text-white mb-6">A Legacy of Craftsmanship</h2>
          <p className="text-[#FAF8F5]/60 leading-relaxed mb-8">
            At Maisha Jewellery, every ornament is crafted with meticulous attention to detail, blending timeless traditions with contemporary aesthetics.
          </p>
          <Link href="/about" className="inline-block border border-[#B8973A] text-[#B8973A] text-xs tracking-[0.3em] uppercase px-8 py-3 hover:bg-[#B8973A] hover:text-white transition-colors">
            Learn More
          </Link>
        </div>
      </section>
    </div>
  )
}
