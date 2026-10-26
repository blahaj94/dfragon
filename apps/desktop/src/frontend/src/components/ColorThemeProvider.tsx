import { useEffect, type ReactNode } from 'react'

/**
 * Desktop 창의 테마를 다크로 고정한다. 시스템 설정이나 이전에 남은 `data-theme`과 관계없이 다크를 쓰고,
 * 해제하면 이전 값을 되돌린다.
 */
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
