import { useEffect, type ReactNode } from 'react'

export function ColorThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => {
    const root = document.documentElement
    const previousTheme = root.dataset.theme
    const previousColorScheme = root.style.colorScheme
    // tokens.css가 data-theme으로 색을 고르고, color-scheme은 스크롤 막대 같은 기본 컨트롤을 맞춘다.
    root.dataset.theme = 'dark'
    root.style.colorScheme = 'dark'

    return () => {
      if (previousTheme == null) {
        delete root.dataset.theme
      } else {
        root.dataset.theme = previousTheme
      }
      root.style.colorScheme = previousColorScheme
    }
  }, [])

  return <>{children}</>
}
