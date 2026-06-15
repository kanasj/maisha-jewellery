import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import FloatingWhatsApp from '@/components/FloatingWhatsApp'
import { getSiteSettings, getFontUrl } from '@/lib/settings'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Maisha Jewellery — Timeless Elegance',
  description: 'Discover exquisite handcrafted jewellery at Maisha Jewellery.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()
  const fontUrl = getFontUrl(settings.heading_font)

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fontUrl} rel="stylesheet" />
      </head>
      <body
        className="bg-[#FAF8F5] text-[#1A1714] font-sans antialiased"
        style={{ '--font-heading': `'${settings.heading_font}', serif` } as React.CSSProperties}
      >
        {children}
        <FloatingWhatsApp />
      </body>
    </html>
  )
}
