/** Defaults for current preferences; existing unknown fields remain intact. */
import { db } from './db'
import type { Settings } from './types'
export const DEFAULT_SETTINGS: Settings = {
  id: 'settings', updatedAt: 0, theme: 'system', weekStartsOn: 1, haptics: true,
  atlasStyle: 'physical', atlasLayers: { undiscovered: true, areas: true, groups: [] },
}
export function normalizeSettings(raw: object): Settings {
  const { skyTheme: _legacy, ...rest } = raw as Record<string, unknown>
  return { ...DEFAULT_SETTINGS, ...rest, id: 'settings' } as Settings
}
export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('settings')
    if (existing) {
      const merged = { ...DEFAULT_SETTINGS, ...existing }
      if (Object.keys(merged).length !== Object.keys(existing).length) await db.settings.put(merged)
    } else await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: Date.now() })
  })
}
