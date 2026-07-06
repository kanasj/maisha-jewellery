'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function HeroBanner({ banners }: { banners: string[] }) {
  const active_banners = banners.filter(Boolean)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (active_banners.length <= 1) return
    const id = setInterval(() => setActive((p) => (p + 1) % active_banners.length), 5000)
    return () => clearInterval(id)
  }, [active_banners.length])

  return (
    <section className="relative flex items-center justify-center overflow-hidden bg-[#1A1714]" style={{ minHeight: '90vh' }}>

      {/* Banner images — crossfade */}
      {active_banners.length > 0 ? (
        active_banners.map((url, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            <Image
              src={url}
              alt={`Banner ${i + 1}`}
              fill
              className="object-cover object-top"
              priority={i === 0}
              sizes="100vw"
            />
            {/* Warm dark overlay like the Mughal poster */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1A1714]/75 via-[#1A1714]/50 to-[#1A1714]/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1714]/60 via-transparent to-transparent" />
          </div>
        ))
      ) : (
        /* Fallback gradient — Mughal warm palette */
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2C1A0E] via-[#1A1714] to-[#0D0B09]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#B8973A]/15 via-transparent to-[#8B6914]/10" />
          {/* Decorative arch silhouette */}
          <svg className="absolute bottom-0 left-0 right-0 w-full opacity-10" viewBox="0 0 1440 400" fill="none">
            <path d="M0 400 L0 200 Q180 0 360 200 L360 400 Z" fill="#B8973A"/>
            <path d="M360 400 L360 200 Q540 0 720 200 L720 400 Z" fill="#B8973A"/>
            <path d="M720 400 L720 200 Q900 0 1080 200 L1080 400 Z" fill="#B8973A"/>
            <path d="M1080 400 L1080 200 Q1260 0 1440 200 L1440 400 Z" fill="#B8973A"/>
          </svg>
        </div>
      )}

      {/* Hero text */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <p className="text-xs tracking-[0.5em] uppercase text-[#B8973A] mb-6 font-inter">
          Handcrafted with Heritage
        </p>
        <h1 className="font-cormorant text-6xl sm:text-7xl lg:text-8xl font-light text-white leading-tight mb-6 drop-shadow-lg">
          Timeless<br />
          <span className="italic text-[#B8973A]">Elegance</span>
        </h1>
        <p className="text-[#FAF8F5]/75 text-sm tracking-wider mb-12 max-w-sm mx-auto leading-relaxed">
          Each piece in our collection is a testament to generations of artisanal craftsmanship.
        </p>
        <Link
          href="/shop"
          className="inline-block border border-[#B8973A] text-[#B8973A] text-xs tracking-[0.35em] uppercase px-12 py-4 hover:bg-[#B8973A] hover:text-white transition-all duration-300"
        >
          Explore Collection
        </Link>
      </div>

      {/* Slide dots */}
      {active_banners.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {active_banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i === active ? '2rem' : '0.5rem',
                backgroundColor: i === active ? '#B8973A' : 'rgba(255,255,255,0.35)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Left/Right arrows for manual navigation */}
      {active_banners.length > 1 && (
        <>
          <button
            onClick={() => setActive((p) => (p - 1 + active_banners.length) % active_banners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center border border-white/30 text-white/60 hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={() => setActive((p) => (p + 1) % active_banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center border border-white/30 text-white/60 hover:border-[#B8973A] hover:text-[#B8973A] transition-colors"
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}
    </section>
  )
}
