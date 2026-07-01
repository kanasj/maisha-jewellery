'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
]

export default function Navbar({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur border-b border-[#E8E0D5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-3">
        {/* Hamburger on left for mobile */}
        <button className="md:hidden flex-shrink-0" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href="/" className="flex items-center gap-3 h-full py-2 flex-1">
          <div className="relative h-full aspect-square">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <span className="font-cormorant text-2xl font-semibold tracking-widest text-[#1A1714]">
            {siteName}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm tracking-widest uppercase text-[#1A1714]/70 hover:text-[#B8973A] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      {open && (
        <div className="md:hidden bg-[#FAF8F5] border-t border-[#E8E0D5] px-4 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm tracking-widest uppercase text-[#1A1714]/70 hover:text-[#B8973A]">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
