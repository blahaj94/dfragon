import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ColorThemeContext } from '../lib/color-theme'

export function ColorThemeProvider({
  initialTheme = 'system',
  children
}: {
  initialTheme?: 'system' | 'light' | 'dark'
  children: ReactNode
}): React.JSX.Element {
  const [light, setLight] = useState(
    () =>
      initialTheme === 'light' ||
      (initialTheme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)
  )
  const toggleTheme = useCallback(() => setLight((current) => !current), [])
  const value = useMemo(() => ({ light, toggleTheme }), [light, toggleTheme])

  useEffect(() => {
    const root = document.documentElement
    const previousMode = root.dataset.seedColorMode
    root.dataset.seedColorMode = light ? 'light-only' : 'dark-only'

    return () => {
      if (previousMode == null) {
        delete root.dataset.seedColorMode
      } else {
        root.dataset.seedColorMode = previousMode
      }
    }
  }, [light])

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>
}
