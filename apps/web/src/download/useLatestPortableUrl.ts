import { useEffect, useState } from 'react'
import { fetchPortableUrl } from './latest-release'

export function useLatestPortableUrl(): string | null {
  const [portableUrl, setPortableUrl] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPortableUrl(controller.signal).then((found) => {
      if (!controller.signal.aborted) {
        setPortableUrl(found)
      }
    })

    return () => controller.abort()
  }, [])

  return portableUrl
}
