import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import '../../assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preview } from './Preview'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorThemeProvider>
      <Preview />
    </ColorThemeProvider>
  </StrictMode>
)
