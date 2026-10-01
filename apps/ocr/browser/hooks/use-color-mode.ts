import { useEffect, useState } from 'react'

type ColorMode = 'light' | 'dark'
const STORAGE_KEY = 'ocr-color-mode'

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(() => {
    try {
      const storedMode = localStorage.getItem(STORAGE_KEY)
      if (storedMode === 'dark') {

        return 'dark'
      }

      return 'light'
    } catch {

      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.seedColorMode = `${mode}-only`
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Theme switching remains available when browser storage is disabled.
    }
  }, [mode])

  return {
    mode,
    toggle: () =>
      setMode((current) => {
        if (current === 'light') {

          return 'dark'
        }

        return 'light'
      })
  }
}
