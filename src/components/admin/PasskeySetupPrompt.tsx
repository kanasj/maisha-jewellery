'use client'
import { useState, useEffect } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { ScanFace, X, Loader2, CheckCircle } from 'lucide-react'

export const PASSKEY_CRED_KEY = 'passkey_credential_id'

export default function PasskeySetupPrompt() {
  const [show, setShow]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    // Show prompt if no passkey exists (404) or if the check fails (unknown state)
    fetch('/api/passkey/auth-options', { method: 'POST' })
      .then((r) => { if (!r.ok) setShow(true) })
      .catch(() => setShow(true))
  }, [])

  async function setupFaceId() {
    setLoading(true)
    setError('')
    try {
      const optRes = await fetch('/api/passkey/register-options', { method: 'POST' })
      if (!optRes.ok) {
        const body = await optRes.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to get registration options')
      }
      const options = await optRes.json()

      const credential = await startRegistration({ optionsJSON: options })

      const verRes = await fetch('/api/passkey/register-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(credential),
      })
      if (!verRes.ok) {
        const { error: e } = await verRes.json()
        throw new Error(e)
      }

      // Store this device's credential ID so logout can remove only this passkey.
      // localStorage (not sessionStorage) so it survives tab/browser close on iOS Safari.
      localStorage.setItem(PASSKEY_CRED_KEY, credential.id)

      setDone(true)
      setTimeout(() => setShow(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    // full-width on mobile (avoids iOS safe-area clipping), card on desktop
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 z-50 bg-white border-t sm:border border-gray-200 sm:rounded-xl shadow-xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
      <button
        onClick={() => setShow(false)}
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-500"
      >
        <X size={14} />
      </button>

      {done ? (
        <div className="flex items-center gap-3 text-green-600">
          <CheckCircle size={20} />
          <span className="text-sm font-medium">Face ID set up!</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#B8973A]/10 flex items-center justify-center flex-shrink-0">
              <ScanFace size={18} className="text-[#B8973A]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1714]">Set up Face ID login</p>
              <p className="text-xs text-gray-400">Skip the password next time</p>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={setupFaceId}
              disabled={loading}
              className="flex-1 bg-[#B8973A] text-white text-xs tracking-widest uppercase py-2.5 rounded hover:bg-[#A07C2A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <ScanFace size={12} />}
              {loading ? 'Setting up…' : 'Enable Face ID'}
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-3 py-2.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded transition-colors"
            >
              Later
            </button>
          </div>
        </>
      )}
    </div>
  )
}
