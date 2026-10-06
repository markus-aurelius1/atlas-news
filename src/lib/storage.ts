/**
 * localStorage keys. The app was called Lodestar before it became Tars; keys
 * written under the old name are moved over once, so nobody loses a running
 * theme or Atlas preferences to the rename. Unrelated keys stay untouched.
 */
export const KEYS = {
  theme: 'tars.theme',
  atlasVisit: 'tars.atlas.lastVisit',
  sidebar: 'tars.sidebar.collapsed',
  reader: 'tars.reader.prefs',
} as const

const LEGACY: Partial<Record<keyof typeof KEYS, string>> = {
  theme: 'lodestar.theme',
  atlasVisit: 'lodestar:atlas:lastVisit',
}

let migrated = false

/** Copy values from the pre-rename keys (once per launch; cheap and idempotent). */
export function migrateLegacyKeys(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = globalThis.localStorage): void {
  if (migrated || !storage) return
  migrated = true
  try {
    for (const [name, legacy] of Object.entries(LEGACY) as Array<[keyof typeof KEYS, string]>) {
      const value = storage.getItem(legacy)
      if (value === null) continue
      if (storage.getItem(KEYS[name]) === null) storage.setItem(KEYS[name], value)
      storage.removeItem(legacy)
    }
  } catch {
    /* storage unavailable (private mode) */
  }
}

/** For tests. */
export function resetLegacyMigration() {
  migrated = false
}
