import '@seed-design/css/base.css'
import '@ldb/ui/foundation.css'
import './fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Preview } from './Preview'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>
)
