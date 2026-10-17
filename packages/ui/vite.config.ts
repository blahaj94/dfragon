import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uiNotices } from '@dfragon/licenses/vite'

function isExternal(id: string) {
  const isSeed = id.startsWith('@seed-design/')
  const isReact = id === 'react' || id.startsWith('react/')
  const isReactDom = id === 'react-dom' || id.startsWith('react-dom/')
  const isStylex = id === '@stylexjs/stylex' || id.startsWith('@stylexjs/stylex/')
  const isOfficialIcon = id.startsWith('@karrotmarket/react-monochrome-icon')
  const isPeerOrIcon = isSeed || isReact || isReactDom || isStylex || isOfficialIcon

  return isPeerOrIcon
}

export default defineConfig({
  plugins: [react(), uiNotices({ uiRoot: fileURLToPath(new URL('./', import.meta.url)) })],
  build: {
    // 소비자 StyleX는 defineConsts 결과가 같은 이름으로 export될 때만 받아들이므로 식별자를 줄이지 않는다.
    minify: false,
    lib: {
      // tokens.stylex를 별도 entry로 두어 dist에서도 .stylex 파일로 남긴다. 소비자 StyleX compiler는
      // import 경로가 .stylex로 끝나는 파일의 defineConsts만 다른 모듈에서 읽는다.
      entry: {
        index: 'src/index.tsx',
        typo: 'src/typo.tsx',
        'tokens.stylex': 'src/tokens.stylex.ts'
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rolldownOptions: { external: isExternal }
  }
})
