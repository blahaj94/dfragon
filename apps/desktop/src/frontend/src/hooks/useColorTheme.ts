import { useContext } from 'react'
import { ColorThemeContext } from './color-theme-context'

export function useColorTheme(): {
  light: boolean
  toggleTheme: () => void
} {
  const theme = useContext(ColorThemeContext)
  if (theme == null) {
    throw new Error('useColorTheme must be used within ColorThemeProvider')
  }
  return theme
}
