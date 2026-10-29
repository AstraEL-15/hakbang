import 'server-only'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

/** Verifies the Firebase ID token in `Authorization: Bearer …`. Returns the uid, or a 401 Response. */
export async function requireUser(req: Request): Promise<string | Response> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return Response.json({ error: 'Please sign in first.' }, { status: 401 })
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    if (!payload.sub) throw new Error('no sub')
    return payload.sub
  } catch {
    return Response.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 })
  }
}
