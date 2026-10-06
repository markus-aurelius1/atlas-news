/**
 * Coming back to where you were after signing in again. Sign-in leaves the app (Cloudflare Access asks for the
 * login) and returns to its front door, a fixed address. A screen that sends the reader there first notes the
 * place it was showing; when the app next starts in the same tab, and soon enough to be the same errand, it
 * opens on that place instead. Imported first by main.tsx, so the router reads the restored address.
 */
const KEY = 'tars.resume'
const WINDOW_MS = 30 * 60 * 1000

/** Note the current place (an app route such as `#/current-affairs?read=…`) before leaving to sign in. */
export function rememberPlace(hash: string = location.hash): void {
  try {
    if (hash.startsWith('#/')) sessionStorage.setItem(KEY, JSON.stringify({ hash, at: Date.now() }))
  } catch {
    /* without session storage the app simply opens on its front door */
  }
}

/** The place noted before sign-in, once. Only an app route, only recently, only when nothing else was asked for. */
export function takePlace(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw === null) return null
    sessionStorage.removeItem(KEY)
    const saved = JSON.parse(raw) as { hash?: unknown; at?: unknown }
    if (typeof saved.hash !== 'string' || !saved.hash.startsWith('#/') || saved.hash.length > 4096 || typeof saved.at !== 'number' || now - saved.at > WINDOW_MS || now < saved.at) return null
    return saved.hash
  } catch {
    return null
  }
}

if (typeof location !== 'undefined' && typeof history !== 'undefined') {
  const place = takePlace()
  // A link that names its own destination wins over the remembered one.
  if (place && (location.hash === '' || location.hash === '#' || location.hash === '#/' || location.hash === '#/atlas')) history.replaceState(history.state, '', place)
}
