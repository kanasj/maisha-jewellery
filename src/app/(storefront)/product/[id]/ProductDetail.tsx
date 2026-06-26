'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { buildWhatsAppUrl, formatPrice, WHATSAPP_NUMBER } from '@/lib/utils'
import type { Product, Category, ProductParam } from '@/lib/types'
import { MessageCircle, ChevronDown, Loader2 } from 'lucide-react'
import StorefrontBackButton from '@/components/StorefrontBackButton'

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
  const [activeImg, setActiveImg]     = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [sharing, setSharing]         = useState(false)
  const images = product.images?.length ? product.images : []
  const enquiryMsg = `Hi! I'm interested in *${product.name}* (SKU: ${product.sku}). Could you please share more details?`

  async function handleEnquire() {
    const productUrl = `${window.location.origin}/product/${product.id}`
    const fullMsg    = `${enquiryMsg}\n\n${productUrl}`
    setSharing(true)
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ text: enquiryMsg, url: productUrl })
          return
        } catch {
          // user cancelled or not supported — fall through
        }
      }
      window.open(buildWhatsAppUrl(WHATSAPP_NUMBER, fullMsg), '_blank', 'noopener')
    } finally {
      setSharing(false)
    }
  }

  // ── Spec buckets ───────────────────────────────────────────────────────────
  // Purity may be stored as "14K" or "14" — normalise to always show "14K"
  const purityStr = product.metal_purity
    ? (String(product.metal_purity).toUpperCase().endsWith('K')
        ? String(product.metal_purity)
        : `${product.metal_purity}K`)
    : ''
  const metalLabel = product.metal_type
    ? `${product.metal_type}${purityStr ? ` · ${purityStr}` : ''}`
    : null

  const subCatParam = productParams.find((p) => p.visible_on_storefront && p.name === 'jewellery_sub_category')
  const subCatValue = subCatParam ? String(product.custom_fields?.[subCatParam.name] ?? '') : ''

  // All detailed specs for the collapsible drawer
  const detailRows: { label: string; value: string }[] = []
  if (builtinVisibility.show_metal && product.metal_type)
    detailRows.push({ label: 'Metal', value: `${product.metal_type}${purityStr ? ` (${purityStr})` : ''}` })
  if (subCatValue)
    detailRows.push({ label: subCatParam!.label, value: subCatValue })
  if (builtinVisibility.show_stone && product.stone_weight_ct)
    detailRows.push({ label: 'Diamond Weight', value: `${product.stone_weight_ct} ct` })
  if (builtinVisibility.show_gross_weight && product.gross_weight_g)
    detailRows.push({ label: 'Gross Weight', value: `${product.gross_weight_g} g` })
  productParams
    .filter((p) => p.visible_on_storefront && p.name !== 'jewellery_sub_category')
    .forEach((p) => {
      const val = product.custom_fields?.[p.name]
      if (val === undefined || val === null || val === '') return
      detailRows.push({ label: p.label, value: p.field_type === 'toggle' ? (val ? 'Yes' : 'No') : String(val) })
    })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="mb-6">
        <StorefrontBackButton />
      </div>

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
              <Image src={images[activeImg]} alt={product.name} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" />
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
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill className="object-contain" sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-xs tracking-widest uppercase text-[#B8973A] mb-2">{product.categories?.name}</p>
          <h1 className="font-cormorant text-4xl font-medium mb-2 leading-tight">{product.name}</h1>
          <p className="text-xs text-[#1A1714]/40 tracking-wider">SKU: {product.sku}</p>

          {/* ── About This Piece ── */}
          {product.description && (
            <div className="my-6 border-t border-[#E8E0D5] pt-6">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8973A] mb-3">About This Piece</p>
              <blockquote className="font-cormorant text-xl italic font-light text-[#1A1714]/70 leading-relaxed">
                {product.description}
              </blockquote>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-6 h-px bg-[#B8973A]/40" />
                <span className="text-[#B8973A]/50 text-[10px] tracking-widest uppercase">Maisha Jewellery · Jaipur</span>
              </div>
            </div>
          )}

          {/* ── Price ── */}
          <div className={product.description ? '' : 'mt-6'}>
            {product.price_inr && (
              <p className="font-cormorant text-3xl text-[#1A1714] mb-1">{formatPrice(product.price_inr)}</p>
            )}
            {product.mrp_inr && product.mrp_inr > (product.price_inr ?? 0) && (
              <p className="text-sm text-[#1A1714]/40 line-through">{formatPrice(product.mrp_inr)}</p>
            )}
          </div>

          {/* ── Quick chips ── */}
          {(metalLabel || subCatValue) && (
            <div className="flex flex-wrap gap-2 mt-5">
              {metalLabel && (
                <span className="text-xs tracking-wide border border-[#E8E0D5] text-[#1A1714]/60 px-3 py-1 rounded-full">
                  {metalLabel}
                </span>
              )}
              {subCatValue && (
                <span className="text-xs tracking-wide border border-[#E8E0D5] text-[#1A1714]/60 px-3 py-1 rounded-full">
                  {subCatValue}
                </span>
              )}
            </div>
          )}

          {/* ── Collapsible details ── */}
          {detailRows.length > 0 && (
            <div className="mt-6 border-t border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                className="w-full flex items-center justify-between py-4 text-xs tracking-widest uppercase text-[#1A1714]/50 hover:text-[#B8973A] transition-colors"
              >
                <span>View Details</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {detailsOpen && (
                <div className="pb-6 space-y-3 border-t border-[#E8E0D5] pt-4">
                  {detailRows.map((r) => (
                    <SpecRow key={r.label} label={r.label} value={r.value} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleEnquire}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-3 bg-[#B8973A] text-white text-xs tracking-[0.3em] uppercase px-8 py-5 hover:bg-[#A07C2A] transition-colors disabled:opacity-70"
            >
              {sharing
                ? <Loader2 size={16} className="animate-spin" />
                : <MessageCircle size={16} />
              }
              Enquire on WhatsApp
            </button>
            <p className="text-xs text-[#1A1714]/40 text-center mt-4">
              We respond within 2 hours during business hours
            </p>
          </div>
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
