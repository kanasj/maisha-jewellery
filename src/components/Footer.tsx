import Link from 'next/link'
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from '@/lib/utils'

export default function Footer({ siteName }: { siteName: string }) {
  return (
    <footer className="bg-[#1A1714] text-[#FAF8F5] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <p className="font-cormorant text-2xl font-semibold tracking-widest mb-4">{siteName}</p>
          <p className="text-sm text-[#FAF8F5]/60 leading-relaxed">Timeless elegance, handcrafted with love. Each piece tells a story of heritage and artistry.</p>
        </div>
        <div>
          <p className="text-xs tracking-widest uppercase text-[#B8973A] mb-4">Navigate</p>
          <ul className="space-y-2 text-sm text-[#FAF8F5]/70">
            <li><Link href="/" className="hover:text-[#B8973A] transition-colors">Home</Link></li>
            <li><Link href="/shop" className="hover:text-[#B8973A] transition-colors">Shop</Link></li>
            <li><Link href="/about" className="hover:text-[#B8973A] transition-colors">About</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs tracking-widest uppercase text-[#B8973A] mb-4">Get In Touch</p>
          <a href={buildWhatsAppUrl(WHATSAPP_NUMBER, 'Hi! I would like to enquire about your jewellery.')} target="_blank" rel="noopener noreferrer" className="text-sm text-[#FAF8F5]/70 hover:text-[#B8973A] transition-colors block">
            WhatsApp: +91 63777 58170
          </a>
          <p className="text-xs text-[#FAF8F5]/40 mt-8">&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
