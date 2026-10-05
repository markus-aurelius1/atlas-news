/** Honest offline status: bundled assets become installed only after the service worker has cached them. */
import { useEffect, useState } from 'react'
import { onWake } from '@/services/lifecycle'

interface AssetManifest { totalBytes: number; assets: { path: string; bytes: number; version: string }[] }
export function OfflineAtlas() {
  const [status,setStatus]=useState<{total:number;bytes:number;installed:number}|null>(null)
  useEffect(() => {
    let live = true, generation = 0
    const check = async () => {
      const run = ++generation
      const response = await fetch(`${import.meta.env.BASE_URL}atlas-assets/v1/manifest.json`)
      if (!response.ok) return
      const manifest = await response.json() as AssetManifest
      const keys = 'caches' in window ? await caches.keys() : []
      const stores = await Promise.all(keys.filter(k => k.includes('precache')).map(k => caches.open(k)))
      let installed = 0
      for (const asset of manifest.assets) {
        if (!live || run !== generation) return
        const path = new URL(import.meta.env.BASE_URL + asset.path, location.origin).href
        for (const cache of stores) {
          const cached = await cache.match(path, { ignoreSearch: true })
          if (!cached?.ok) continue
          const bytes = await cached.arrayBuffer()
          if (bytes.byteLength !== asset.bytes) continue
          const digest = await crypto.subtle.digest('SHA-256', bytes)
          const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
          // An older cache's same path is not proof that this asset version is installed.
          if (hash === asset.version) { installed++; break }
        }
      }
      if (live && run === generation) setStatus({ total: manifest.assets.length, bytes: manifest.totalBytes, installed })
    }
    const refresh = () => { void check().catch(() => {}) }
    refresh()
    const stop = onWake(refresh)
    const worker = navigator.serviceWorker
    worker?.addEventListener('controllerchange', refresh)
    if (worker) void worker.ready.then(() => { if (live) refresh() }).catch(() => {})
    return () => { live = false; generation++; stop(); worker?.removeEventListener('controllerchange', refresh) }
  }, [])
  return <section className="settings-offline"><h3>Offline Atlas</h3><p>World context, India detail, every place and all 149 curated questions are bundled.</p>{status&&<p>{(status.bytes/1024/1024).toFixed(2)} MiB · {status.installed}/{status.total} assets saved offline{status.installed<status.total?' · allow the initial download to finish':''}</p>}<p>Regional detail packs are not yet published. No online map cache is used.</p></section>
}
