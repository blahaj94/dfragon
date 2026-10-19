type CacheEntry<T> = { value: T; bytes: number; expiresAt: number }

export type CompletedCacheOptions = Readonly<{
  maximumEntries: number
  maximumBytes: number
  ttlMs: number
}>

/** 완료한 성공값만 공유하므로 서로 다른 호출자의 취소 신호를 묶지 않는다. */
export class CompletedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>()
  private bytes = 0

  constructor(private readonly options: CompletedCacheOptions) {}

  read(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }

    if (performance.now() >= entry.expiresAt) {
      this.remove(key, entry)

      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)

    return entry.value
  }

  write(key: string, value: T, bytes: number): void {
    const now = performance.now()
    for (const [storedKey, entry] of this.entries) {
      if (storedKey === key || now >= entry.expiresAt) {
        this.remove(storedKey, entry)
      }
    }
    if (bytes > this.options.maximumBytes) {
      return
    }
    while (
      this.entries.size >= this.options.maximumEntries ||
      this.bytes + bytes > this.options.maximumBytes
    ) {
      const oldest = this.entries.entries().next().value
      if (!oldest) {
        break
      }
      this.remove(oldest[0], oldest[1])
    }
    this.entries.set(key, {
      value,
      bytes,
      expiresAt: now + this.options.ttlMs
    })
    this.bytes += bytes
  }

  private remove(key: string, entry: CacheEntry<T>): void {
    this.entries.delete(key)
    this.bytes -= entry.bytes
  }
}
