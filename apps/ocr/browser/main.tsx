import { QueryClientProvider } from '@tanstack/react-query'
import { createOcrQueryClient } from './query.js'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import '@seed-design/css/base.css'
import '../../../packages/ui/foundation.css'
import './reset.css'
import './fonts.css'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('OCR root element is missing')
}
const queryClient = createOcrQueryClient()
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
