import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const COOKIE_MAX_AGE = 180 // 3 minutes — tab must ping within this window to stay alive

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_browser_session', '1', {
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
    sameSite: 'strict',
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: false,
  })
  return res
}
