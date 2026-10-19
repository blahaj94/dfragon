import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import '../../assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { AuthApi } from '@dfragon/desktop-contracts/types/auth'
import App from '../../App'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'

declare global {
  interface Window {
    auth?: AuthApi
  }
}
const root = document.getElementById('root')
const hasRoot = root != null
if (!hasRoot) {
  throw new Error('Auth fixture root missing')
}
createRoot(root).render(
  <StrictMode>
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  </StrictMode>
)
