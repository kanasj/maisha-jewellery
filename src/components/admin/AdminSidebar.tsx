'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, Tag, Upload, LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/import', label: 'Bulk Import', icon: Upload },
  { href: '/admin/settings', label: 'Site Maintenance', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <aside className="w-56 bg-[#1A1714] text-white min-h-screen flex flex-col flex-shrink-0">
      <div className="px-6 py-8 border-b border-white/10">
        <p className="font-cormorant text-xl font-semibold">Maisha</p>
        <p className="text-xs text-white/40 tracking-widest uppercase mt-1">Admin</p>
      </div>
      <nav className="flex-1 px-3 py-6 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors',
              pathname === href
                ? 'bg-[#B8973A] text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-white/60 hover:text-white text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
