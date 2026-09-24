import '@seed-design/css/base.css'
import '@dfragon/ui/foundation.css'
import '../../assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preview } from './Preview'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'

const theme = new URLSearchParams(window.location.search).get('theme')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorThemeProvider initialTheme={theme === 'light' || theme === 'system' ? theme : 'dark'}>
      <Preview />
    </ColorThemeProvider>
  </StrictMode>
)
