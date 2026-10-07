import '@seed-design/css/base.css'
import '@dfragon/ui/foundation.css'
import './assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import { CharacterSnapshotPage } from './pages/character-detail/CharacterSnapshotPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorThemeProvider>
      <CharacterSnapshotPage />
    </ColorThemeProvider>
  </StrictMode>
)
