/**
 * Where "Sign in" sends the browser. The installed app's own pages come from its offline cache, so they never
 * meet Access; this route always goes to the network, Access asks for a login when the session has lapsed,
 * and the request that then arrives here is simply sent back to the app. The destination is fixed.
 */
export function onRequest({ request }: { request: Request }): Response {
  return new Response(null, { status: 302, headers: { Location: new URL('/', request.url).toString(), 'Cache-Control': 'no-store' } })
}
