import { useContext } from 'react'
import { ColorThemeContext } from '../lib/color-theme'

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
