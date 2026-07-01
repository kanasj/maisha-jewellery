import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { RP_ID, ORIGIN } from '@/lib/passkey-config'

export async function POST(req: NextRequest) {
  const challenge = cookies().get('passkey_challenge')?.value
  if (!challenge) return NextResponse.json({ error: 'Challenge expired — try again' }, { status: 400 })

  const body = await req.json()
  const credentialId: string = body.id

  // Look up the matching passkey
  const supabase = createClient()
  const { data: passkey } = await supabase
    .from('admin_passkeys')
    .select('credential_id, public_key, counter, user_email')
    .eq('credential_id', credentialId)
    .single()

  if (!passkey) return NextResponse.json({ error: 'Passkey not found' }, { status: 404 })

  const expectedOrigin = process.env.NODE_ENV === 'production'
    ? ORIGIN
    : (req.headers.get('origin') ?? ORIGIN)

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response:          body,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID:      RP_ID,
      credential: {
        id:        passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, 'base64url'),
        counter:   passkey.counter,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }

  // Update counter to prevent replay attacks
  await supabase
    .from('admin_passkeys')
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq('credential_id', credentialId)

  cookies().delete('passkey_challenge')

  // Generate a magic link token for the admin user using the service role
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type:  'magiclink',
    email: passkey.user_email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Could not create session' }, { status: 500 })
  }

  return NextResponse.json({
    verified:    true,
    email:       passkey.user_email,
    token_hash:  linkData.properties.hashed_token,
  })
}
