'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { buildWhatsAppUrl, formatPrice, WHATSAPP_NUMBER } from '@/lib/utils'
import type { Product, Category, ProductParam } from '@/lib/types'
import { MessageCircle } from 'lucide-react'

type ProductWithCategory = Product & { categories?: Pick<Category, 'name' | 'slug'> | null }

interface BuiltinVisibility {
  show_metal: boolean
  show_stone: boolean
  show_gross_weight: boolean
}

export default function ProductDetail({
  product,
  productParams,
  builtinVisibility,
}: {
  product: ProductWithCategory
  productParams: ProductParam[]
  builtinVisibility: BuiltinVisibility
}) {
  const [activeImg, setActiveImg] = useState(0)
  const images = product.images?.length ? product.images : []
  const enquiryMsg = `Hi! I'm interested in *${product.name}* (SKU: ${product.sku}). Could you please share more details?`

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      {/* Breadcrumb */}
      <p className="text-xs tracking-widest uppercase text-[#1A1714]/40 mb-8">
        <Link href="/" className="hover:text-[#B8973A] transition-colors">Home</Link>
        <span> / </span>
        <Link href="/shop" className="hover:text-[#B8973A] transition-colors">Shop</Link>
        {product.categories && (
          <>
            <span> / </span>
            <Link href={`/shop?category=${product.categories.slug}`} className="hover:text-[#B8973A] transition-colors">
              {product.categories.name}
            </Link>
          </>
        )}
        <span> / </span>
        <span className="text-[#1A1714]/70">{product.name}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-[#F0EBE3] relative mb-4 overflow-hidden">
            {images[activeImg] ? (
              <Image src={images[activeImg]} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-cormorant text-8xl text-[#B8973A]/20">K</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`w-20 h-20 flex-shrink-0 relative border-2 transition-colors overflow-hidden ${activeImg === i ? 'border-[#B8973A]' : 'border-transparent'}`}>
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-xs tracking-widest uppercase text-[#B8973A] mb-2">{product.categories?.name}</p>
          <h1 className="font-cormorant text-4xl font-medium mb-2 leading-tight">{product.name}</h1>
          <p className="text-xs text-[#1A1714]/40 mb-6 tracking-wider">SKU: {product.sku}</p>

          {product.price_inr && (
            <p className="font-cormorant text-3xl text-[#1A1714] mb-1">{formatPrice(product.price_inr)}</p>
          )}
          {product.mrp_inr && product.mrp_inr > (product.price_inr ?? 0) && (
            <p className="text-sm text-[#1A1714]/40 line-through mb-6">{formatPrice(product.mrp_inr)}</p>
          )}

          {product.description && (
            <p className="text-sm text-[#1A1714]/70 leading-relaxed mb-8 border-t border-[#E8E0D5] pt-6">{product.description}</p>
          )}

          {/* Specs */}
          <div className="border-t border-[#E8E0D5] pt-6 mb-8 space-y-3">
            {builtinVisibility.show_metal && product.metal_type && (
              <SpecRow label="Metal" value={`${product.metal_type}${product.metal_purity ? ` (${product.metal_purity})` : ''}`} />
            )}
            {builtinVisibility.show_stone && product.stone_type && (
              <SpecRow label="Stone" value={`${product.stone_type}${product.stone_weight_ct ? ` — ${product.stone_weight_ct} ct` : ''}`} />
            )}
            {builtinVisibility.show_gross_weight && product.gross_weight_g && (
              <SpecRow label="Gross Weight" value={`${product.gross_weight_g} g`} />
            )}
            {/* Custom fields — only visible ones */}
            {productParams.filter((p) => p.visible_on_storefront).map((p) => {
              const val = product.custom_fields?.[p.name]
              if (val === undefined || val === null || val === '') return null
              const display = p.field_type === 'toggle' ? (val ? 'Yes' : 'No') : String(val)
              return <SpecRow key={p.id} label={p.label} value={display} />
            })}
          </div>

          <a
            href={buildWhatsAppUrl(WHATSAPP_NUMBER, enquiryMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-3 bg-[#B8973A] text-white text-xs tracking-[0.3em] uppercase px-8 py-5 hover:bg-[#A07C2A] transition-colors"
          >
            <MessageCircle size={16} />
            Enquire on WhatsApp
          </a>
          <p className="text-xs text-[#1A1714]/40 text-center mt-4">
            We respond within 2 hours during business hours
          </p>
        </div>
      </div>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#1A1714]/50 tracking-wide">{label}</span>
      <span className="text-[#1A1714] font-medium">{value}</span>
    </div>
  )
}
