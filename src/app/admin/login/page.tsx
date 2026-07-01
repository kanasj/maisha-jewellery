'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'
import { Loader2, ScanFace } from 'lucide-react'
import { PASSKEY_CRED_KEY } from '@/components/admin/PasskeySetupPrompt'

export default function AdminLogin() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [passkeyAvail, setPasskeyAvail] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Check if any passkey is registered for this site
  useEffect(() => {
    fetch('/api/passkey/auth-options', { method: 'POST' })
      .then((r) => { if (r.ok) setPasskeyAvail(true) })
      .catch(() => {})
  }, [])

  function markBrowserSession() {
    // Session cookie (no Max-Age) — cleared automatically when browser closes
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `admin_browser_session=1; path=/; SameSite=Strict${secure}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      markBrowserSession()
      router.push('/admin')
    }
  }

  async function handleFaceId() {
    setPasskeyLoading(true)
    setError('')
    try {
      // Get authentication options
      const optRes = await fetch('/api/passkey/auth-options', { method: 'POST' })
      if (!optRes.ok) throw new Error('No passkey found')
      const options = await optRes.json()

      // Trigger browser Face ID / Touch ID
      const credential = await startAuthentication({ optionsJSON: options })

      // Remember which credential this device used (for device-scoped logout)
      sessionStorage.setItem(PASSKEY_CRED_KEY, credential.id)

      // Verify on server — returns a magic link token
      const verRes = await fetch('/api/passkey/auth-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(credential),
      })
      const verData = await verRes.json()
      if (!verRes.ok) throw new Error(verData.error ?? 'Verification failed')

      // Exchange the token for a Supabase session
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: verData.token_hash,
        type:       'magiclink',
      })
      if (otpError) throw new Error(otpError.message)

      markBrowserSession()
      router.push('/admin')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Face ID login failed')
    } finally {
      setPasskeyLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-cormorant text-4xl text-center mb-2">Maisha Jewellery</p>
        <p className="text-xs tracking-widest uppercase text-[#1A1714]/40 text-center mb-10">Admin Panel</p>

        {/* Face ID button — shown only when a passkey is registered */}
        {passkeyAvail && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleFaceId}
              disabled={passkeyLoading}
              className="w-full flex items-center justify-center gap-3 border-2 border-[#B8973A] text-[#B8973A] text-sm tracking-widest uppercase py-4 rounded hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {passkeyLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <ScanFace size={18} />}
              {passkeyLoading ? 'Verifying…' : 'Login with Face ID'}
            </button>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 tracking-widest uppercase">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#E8E0D5] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#B8973A]"
            />
          </div>
          <div>
            <label className="text-xs tracking-widest uppercase text-[#1A1714]/50 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#E8E0D5] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#B8973A]"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#B8973A] text-white text-xs tracking-widest uppercase py-4 hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
