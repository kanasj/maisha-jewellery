import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import BackButton from '@/components/admin/BackButton'
import PasskeySetupPrompt from '@/components/admin/PasskeySetupPrompt'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      {/* pt-14 reserves space for mobile top bar; md:ml-56 offsets for desktop sidebar */}
      <div className="md:ml-56 pt-14 md:pt-0">
        <main className="p-4 sm:p-8">
          <BackButton />
          {children}
        </main>
      </div>
      <PasskeySetupPrompt />
    </div>
  )
}
