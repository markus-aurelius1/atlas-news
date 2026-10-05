/**
 * Every /api route requires a valid Cloudflare Access token. The token is verified here, server-side, and the
 * identity it carries is the only one the routes behind it ever see. Without Access configuration the routes
 * stay closed rather than open.
 */
import { AccessError, accessConfig, accessToken, verifyAccessJwt, type AccessIdentity } from '../../src/sync/access.ts'

export interface ApiEnv { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; SYNC_DB?: unknown }
export interface ApiData { user?: AccessIdentity }
interface Context { request: Request; env: ApiEnv; data: ApiData; next: () => Promise<Response> }

const refuse = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })

export async function onRequest(context: Context): Promise<Response> {
  const config = accessConfig(context.env)
  if (!config) return refuse(503, 'access_not_configured')
  const token = accessToken(context.request)
  if (!token) return refuse(401, 'unauthenticated')
  try {
    context.data.user = await verifyAccessJwt(token, config, (input) => fetch(input))
  } catch (error) {
    if (error instanceof AccessError) return refuse(401, 'unauthenticated')
    throw error
  }
  return context.next()
}
