/**
 * Cloudflare Access is the only identity. Access signs a JWT for every request it lets through; this module
 * checks that signature against the team's published keys, and the issuer, audience and validity window,
 * before anything is read or written. Nothing the browser says about who it is is ever used.
 */
export interface AccessConfig {
  /** `https://<team>.cloudflareaccess.com` */
  issuer: string
  /** Application audience (AUD) tags that may reach these routes. */
  audiences: string[]
}

export interface AccessIdentity {
  /** Lower-cased email from the token: the account key. */
  email: string
  sub: string
}

export class AccessError extends Error {}

type Fetcher = (input: string) => Promise<Response>
interface Jwk { kid?: string; kty?: string; alg?: string; n?: string; e?: string }

const KEY_TTL_MS = 60 * 60 * 1000
/** An unknown key id refetches the key set, but not more often than this. */
const KEY_RETRY_MS = 60 * 1000
const LEEWAY_S = 60

/** `ACCESS_TEAM_DOMAIN` is the team host (or origin); `ACCESS_AUD` is one or more audience tags, comma-separated. */
export function accessConfig(env: { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string } | undefined): AccessConfig | null {
  const domain = env?.ACCESS_TEAM_DOMAIN?.trim().replace(/\/+$/, '')
  const audiences = (env?.ACCESS_AUD ?? '').split(',').map((a) => a.trim()).filter(Boolean)
  if (!domain || !audiences.length) return null
  return { issuer: /^https?:\/\//.test(domain) ? domain : `https://${domain}`, audiences }
}

/** Access forwards the token in a header; the cookie carries the same token for requests that predate the header. */
export function accessToken(request: Request): string | null {
  const header = request.headers.get('Cf-Access-Jwt-Assertion')
  if (header) return header
  const cookie = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('CF_Authorization='))
  return cookie ? cookie.slice('CF_Authorization='.length) : null
}

function decode(part: string): Uint8Array<ArrayBuffer> {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const json = (part: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(new TextDecoder().decode(decode(part)))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError('Malformed token')
  return value as Record<string, unknown>
}

const keySets = new Map<string, { at: number; keys: Map<string, CryptoKey> }>()

async function loadKeys(issuer: string, fetcher: Fetcher, now: number): Promise<Map<string, CryptoKey>> {
  const response = await fetcher(`${issuer}/cdn-cgi/access/certs`)
  if (!response.ok) throw new AccessError('Access keys unavailable')
  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== 'RSA' || !jwk.n || !jwk.e) continue
    keys.set(jwk.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']))
  }
  keySets.set(issuer, { at: now, keys })
  return keys
}

async function signingKey(issuer: string, kid: string, fetcher: Fetcher, now: number): Promise<CryptoKey | undefined> {
  const cached = keySets.get(issuer)
  if (cached && now - cached.at < KEY_TTL_MS && (cached.keys.has(kid) || now - cached.at < KEY_RETRY_MS)) return cached.keys.get(kid)
  return (await loadKeys(issuer, fetcher, now)).get(kid)
}

/** Verify an Access JWT. Throws `AccessError` unless every check passes. */
export async function verifyAccessJwt(token: string, config: AccessConfig, fetcher: Fetcher, now = Date.now()): Promise<AccessIdentity> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new AccessError('Malformed token')
  let header: Record<string, unknown>, claims: Record<string, unknown>, signature: Uint8Array<ArrayBuffer>
  try {
    header = json(parts[0])
    claims = json(parts[1])
    signature = decode(parts[2])
  } catch {
    throw new AccessError('Malformed token')
  }
  // Only the algorithm Access signs with; never "none" and never a symmetric one.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new AccessError('Unsupported token')
  const key = await signingKey(config.issuer, header.kid, fetcher, now)
  if (!key) throw new AccessError('Unknown signing key')
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed))) throw new AccessError('Bad signature')

  const seconds = Math.floor(now / 1000)
  if (claims.iss !== config.issuer) throw new AccessError('Wrong issuer')
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audience.some((a) => typeof a === 'string' && config.audiences.includes(a))) throw new AccessError('Wrong audience')
  if (typeof claims.exp !== 'number' || claims.exp <= seconds - LEEWAY_S) throw new AccessError('Expired token')
  if (typeof claims.nbf === 'number' && claims.nbf > seconds + LEEWAY_S) throw new AccessError('Token not yet valid')
  // Service tokens carry no email; sync is per person.
  if (typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(claims.email) || claims.email.length > 320) throw new AccessError('Token has no user')
  return { email: claims.email.toLowerCase(), sub: typeof claims.sub === 'string' ? claims.sub : '' }
}

/** For tests. */
export function forgetAccessKeys() {
  keySets.clear()
}
