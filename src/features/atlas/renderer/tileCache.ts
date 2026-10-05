/** Bounded bitmap LRU; every rejected, replaced or evicted bitmap is released once. */
export interface Bitmap {
  close(): void
}
export class TileCache<T extends Bitmap> {
  private readonly entries = new Map<string, T>()
  generation = 0
  constructor(readonly budget: number) {}
  get size() {
    return this.entries.size
  }
  get(key: string) {
    const value = this.entries.get(key)
    if (value) {
      this.entries.delete(key)
      this.entries.set(key, value)
    }
    return value
  }
  put(key: string, bitmap: T, generation = this.generation, protectedKeys: Set<string> = new Set()) {
    if (generation !== this.generation) {
      bitmap.close()
      return false
    }
    const previous = this.entries.get(key)
    if (previous && previous !== bitmap) previous.close()
    this.entries.delete(key)
    this.entries.set(key, bitmap)
    while (this.entries.size > this.budget) {
      const victim = [...this.entries.keys()].find((k) => !protectedKeys.has(k) && k !== key)
      if (!victim) {
        this.entries.delete(key)
        bitmap.close()
        return false
      }
      this.entries.get(victim)!.close()
      this.entries.delete(victim)
    }
    return true
  }
  clear() {
    this.generation++
    for (const value of this.entries.values()) value.close()
    this.entries.clear()
  }
}
