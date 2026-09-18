import { useEffect, useState } from 'react'

export function useColorTheme(initialTheme: 'system' | 'light' | 'dark' = 'system'): {
  light: boolean
  toggleTheme: () => void
} {
  const [light, setLight] = useState(
    () =>
      initialTheme === 'light' ||
      (initialTheme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)
  )

  useEffect(() => {
    document.documentElement.dataset.seedColorMode = light ? 'light-only' : 'dark-only'
  }, [light])

  return { light, toggleTheme: () => setLight((current) => !current) }
}
