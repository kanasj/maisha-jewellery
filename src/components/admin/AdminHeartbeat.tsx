'use client'
import { useEffect } from 'react'

// Pings /api/admin-heartbeat every 90s to keep the browser-session cookie alive.
// When the tab closes, pings stop → cookie expires after 3 min → middleware forces re-login.
export default function AdminHeartbeat() {
  useEffect(() => {
    const ping = () => fetch('/api/admin-heartbeat', { method: 'POST' })
    ping() // refresh immediately on mount
    const id = setInterval(ping, 90_000)
    return () => clearInterval(id)
  }, [])
  return null
}
