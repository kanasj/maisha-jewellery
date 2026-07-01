import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { RP_NAME, RP_ID } from '@/lib/passkey-config'

export async function POST() {
  // Must be authenticated
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch existing credentials for this user to exclude duplicates
  const { data: existing } = await supabase
    .from('admin_passkeys')
    .select('credential_id')
    .eq('user_email', user.email)

  const excludeCredentials = (existing ?? []).map((c: { credential_id: string }) => ({
    id: c.credential_id,
    type: 'public-key' as const,
  }))

  const options = await generateRegistrationOptions({
    rpName:    RP_NAME,
    rpID:      RP_ID,
    userName:  user.email ?? 'admin',
    userDisplayName: 'Maisha Admin',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Face ID / Touch ID only
      userVerification: 'required',
      residentKey: 'preferred',
    },
  })

  // Store challenge in a short-lived HttpOnly cookie
  cookies().set('passkey_challenge', options.challenge, {
    httpOnly: true,
    maxAge: 300,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return NextResponse.json(options)
}
