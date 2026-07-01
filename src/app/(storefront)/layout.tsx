import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import FloatingWhatsApp from '@/components/FloatingWhatsApp'
import { getSiteSettings } from '@/lib/settings'

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()
  return (
    <>
      <Navbar siteName={settings.site_name} />
      <main>{children}</main>
      <Footer siteName={settings.site_name} />
      <FloatingWhatsApp />
    </>
  )
}
