import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ColorThemeContext } from '../hooks/color-theme-context'

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
    const previousTheme = root.dataset.theme
    const previousColorScheme = root.style.colorScheme
    const theme = light ? 'light' : 'dark'
    // tokens.css가 data-theme으로 색을 고르고, color-scheme은 스크롤 막대 같은 기본 컨트롤을 맞춘다.
    root.dataset.theme = theme
    root.style.colorScheme = theme

    return () => {
      if (previousTheme == null) {
        delete root.dataset.theme
      } else {
        root.dataset.theme = previousTheme
      }
      root.style.colorScheme = previousColorScheme
    }
  }, [light])

  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>
}
