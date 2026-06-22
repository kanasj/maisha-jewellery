'use client'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export default function BackButton() {
  const router   = useRouter()
  const pathname = usePathname()

  // Don't show on the dashboard root
  if (pathname === '/admin' || pathname === '/admin/') return null

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#B8973A] transition-colors mb-6 group"
    >
      <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      Back
    </button>
  )
}
