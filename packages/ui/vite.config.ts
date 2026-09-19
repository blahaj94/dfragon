import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uiNotices } from '@ldb/licenses/vite'

function isExternal(id: string) {
  const isSeed = id.startsWith('@seed-design/')
  const isReact = id === 'react' || id.startsWith('react/')
  const isReactDom = id === 'react-dom' || id.startsWith('react-dom/')
  const isOfficialIcon = id.startsWith('@karrotmarket/react-monochrome-icon')
  const isPeerOrIcon = isSeed || isReact || isReactDom || isOfficialIcon
  return isPeerOrIcon
}

export default defineConfig({
  plugins: [react(), uiNotices({ uiRoot: fileURLToPath(new URL('./', import.meta.url)) })],
  build: {
    lib: {
      entry: { index: 'src/index.tsx', typo: 'src/typo.tsx' },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rolldownOptions: { external: isExternal }
  }
})
