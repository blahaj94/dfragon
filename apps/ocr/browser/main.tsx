import * as stylex from '@stylexjs/stylex'
import { styles } from './styles.js'
import { QueryClientProvider } from '@tanstack/react-query'
import { createOcrQueryClient } from './query.js'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import '@seed-design/css/base.css'
import '../../../packages/ui/foundation.css'
import './reset.css'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('OCR root element is missing')
}
const queryClient = createOcrQueryClient()
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <div {...stylex.props(styles.root)}>
      <App />
    </div>
  </QueryClientProvider>
)
