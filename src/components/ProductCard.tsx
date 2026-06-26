import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@/lib/types'

export default function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0] ?? null
  return (
    <Link href={`/product/${product.id}`} className="group block">
      <div className="aspect-square overflow-hidden bg-[#F0EBE3] mb-3 relative">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-cormorant text-4xl text-[#B8973A]/30">K</span>
          </div>
        )}
      </div>
      <p className="text-xs tracking-widest uppercase text-[#1A1714]/50 mb-1">{(product as Product & { categories?: { name: string } }).categories?.name ?? ''}</p>
      <p className="font-cormorant text-lg font-medium text-[#1A1714] leading-snug mb-1 group-hover:text-[#B8973A] transition-colors">{product.name}</p>
      {product.price_inr && (
        <p className="text-sm text-[#1A1714]/70">{formatPrice(product.price_inr)}</p>
      )}
    </Link>
  )
}
