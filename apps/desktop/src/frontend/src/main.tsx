import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import './assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { blockNativeDrag } from './lib/native-drag'
import { startRendererDiagnostics } from './lib/runtime-diagnostics'

startRendererDiagnostics(window.diagnostics)
blockNativeDrag(document)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
