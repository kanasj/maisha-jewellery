import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { RP_ID } from '@/lib/passkey-config'

export async function POST() {
  const supabase = createClient()

  // Fetch all registered passkeys
  const { data: passkeys } = await supabase
    .from('admin_passkeys')
    .select('credential_id')

  if (!passkeys || passkeys.length === 0) {
    return NextResponse.json({ error: 'No passkeys registered' }, { status: 404 })
  }

  const allowCredentials = passkeys.map((p: { credential_id: string }) => ({
    id:   p.credential_id,
    type: 'public-key' as const,
  }))

  const options = await generateAuthenticationOptions({
    rpID:             RP_ID,
    userVerification: 'required',
    allowCredentials,
  })

  cookies().set('passkey_challenge', options.challenge, {
    httpOnly: true,
    maxAge: 300,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return NextResponse.json(options)
}
