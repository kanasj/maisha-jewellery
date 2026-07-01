import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { RP_ID, ORIGIN } from '@/lib/passkey-config'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const challenge = cookies().get('passkey_challenge')?.value
  if (!challenge) return NextResponse.json({ error: 'Challenge expired — try again' }, { status: 400 })

  const body = await req.json()

  let verification
  try {
    // In dev, use the actual request origin so any port works
    const expectedOrigin = process.env.NODE_ENV === 'production'
      ? ORIGIN
      : (req.headers.get('origin') ?? ORIGIN)

    verification = await verifyRegistrationResponse({
      response:          body,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID:      RP_ID,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }

  const { credential } = verification.registrationInfo

  // Store the credential — base64url encode the public key bytes
  const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64url')

  const { error } = await supabase.from('admin_passkeys').upsert({
    credential_id: credential.id,
    public_key:    publicKeyB64,
    counter:       credential.counter,
    user_email:    user.email,
  }, { onConflict: 'credential_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clear the challenge cookie
  cookies().delete('passkey_challenge')

  return NextResponse.json({ verified: true })
}
