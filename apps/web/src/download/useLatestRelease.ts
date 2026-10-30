import { useEffect, useState } from 'react'
import { fetchPortableRelease, type PortableRelease } from './latest-release'

export function useLatestRelease(): PortableRelease | null {
  const [release, setRelease] = useState<PortableRelease | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPortableRelease(controller.signal).then((found) => {
      if (!controller.signal.aborted) {
        setRelease(found)
      }
    })

    return () => controller.abort()
  }, [])

  return release
}
