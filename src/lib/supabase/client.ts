import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use sessionStorage so the session is cleared when the browser is closed.
        // Explicit logout also clears it (and deletes the passkey from the DB).
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )
}
