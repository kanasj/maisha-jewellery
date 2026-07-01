'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, Tag, Upload, LogOut, Settings, Menu, X, ToggleLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/item-status', label: 'Item Status', icon: ToggleLeft },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/import', label: 'Bulk Import', icon: Upload },
  { href: '/admin/settings', label: 'Site Maintenance', icon: Settings },
]

function NavLinks({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-6 space-y-1">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNav}
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
  )
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function signOut() {
    // Delete all passkeys for this user — forces email+password re-authentication next time
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase.from('admin_passkeys').delete().eq('user_email', user.email)
    }
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-[#1A1714] flex items-center justify-between px-4">
        <p className="font-cormorant text-white text-xl font-semibold tracking-wide">Maisha Admin</p>
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-white/70 hover:text-white transition-colors p-1"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="relative w-64 bg-[#1A1714] text-white flex flex-col h-full shadow-2xl">
            <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="font-cormorant text-xl font-semibold">Maisha</p>
                <p className="text-xs text-white/40 tracking-widest uppercase mt-0.5">Admin</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-white/50 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks pathname={pathname} onNav={() => setDrawerOpen(false)} />
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
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 bg-[#1A1714] text-white fixed top-0 left-0 h-full flex-col flex-shrink-0 z-20">
        <div className="px-6 py-8 border-b border-white/10">
          <p className="font-cormorant text-xl font-semibold">Maisha</p>
          <p className="text-xs text-white/40 tracking-widest uppercase mt-1">Admin</p>
        </div>
        <NavLinks pathname={pathname} />
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
    </>
  )
}
