'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export default function StorefrontBackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-xs tracking-widest uppercase text-[#1A1714]/40 hover:text-[#B8973A] transition-colors group"
    >
      <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
      Back
    </button>
  )
}
