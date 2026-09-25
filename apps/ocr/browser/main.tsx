import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import '@seed-design/css/base.css'
import '../../../packages/ui/foundation.css'
import './style.css'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('OCR root element is missing')
}
createRoot(root).render(<App />)
