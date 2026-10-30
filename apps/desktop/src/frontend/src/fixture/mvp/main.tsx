import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import '../../assets/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { blockNativeDrag } from '../../lib/native-drag'
import { Preview } from './Preview'

blockNativeDrag(document)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>
)
