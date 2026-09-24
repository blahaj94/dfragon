import '@seed-design/css/base.css'
import '@dfragon/ui/foundation.css'
import './assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ColorThemeProvider } from './components/ColorThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  </StrictMode>
)
