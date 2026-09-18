import { createContext } from 'react'

type ColorThemeContextValue = {
  light: boolean
  toggleTheme: () => void
}

export const ColorThemeContext = createContext<ColorThemeContextValue | null>(null)
