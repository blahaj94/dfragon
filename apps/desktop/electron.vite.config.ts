import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { rendererTransforms } from './build/renderer-transforms'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices, desktopNotices, desktopLicenseCatalog } from '@dfragon/licenses/vite'
import { readChannelNameFromMode, readDesktopChannel } from './build/channels'
import { readDesktopSourceInfo } from './build/build-info'

const LIB_IMPORT_PATTERN = /^@dfragon\/lib$/
const OCR_CONTRACT_IMPORT_PATTERN = /^@dfragon\/lib\/ocr-contract$/
const PAGINATION_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/pagination$/
const UI_IMPORT_PATTERN = /^@dfragon\/ui$/

export default defineConfig(({ mode, command }) => {
  const libAlias = resolve('../../packages/lib/src/index.ts')
  const desktopBuild = JSON.stringify(
    readDesktopSourceInfo(fileURLToPath(new URL('.', import.meta.url)))
  )
  const channelName = readChannelNameFromMode(mode)
  const desktopChannel = JSON.stringify(
    channelName == null ? null : readDesktopChannel(channelName)
  )
  const backendEntry = resolve('src/backend/main.ts')
  const frontendRoot = resolve('src/frontend')
  const rendererInput = {
    app: resolve('src/frontend/index.html'),
    characterDetail: resolve('src/frontend/character-detail.html'),
    ...(mode === 'mvp-preview' ? { mvpPreview: resolve('src/frontend/mvp-preview.html') } : {})
  }
  const rendererAliases = [
    { find: '@frontend', replacement: resolve('src/frontend/src') },
    { find: LIB_IMPORT_PATTERN, replacement: libAlias },
    {
      find: PAGINATION_IMPORT_PATTERN,
      replacement: resolve('../../packages/lib/src/utils/pagination.ts')
    },
    { find: UI_IMPORT_PATTERN, replacement: resolve('../../packages/ui/src/index.tsx') }
  ]
  const rendererPlugins = [
    ...rendererTransforms(),
    seedDesignPlugin(),
    uiNotices({ uiRoot: resolve('../../packages/ui'), runtimeRoot: resolve('.') }),
    desktopNotices(),
    desktopLicenseCatalog({
      runtimeRoot: resolve('.'),
      uiRoot: resolve('../../packages/ui'),
      ocrRoot: resolve('assets/ocr')
    }),
    ...(mode === 'mvp-preview'
      ? [
          {
            name: 'mvp-preview-notices',
            transformIndexHtml(html, context) {
              if (command !== 'serve' || context.path !== '/mvp-preview.html') {
                return html
              }

              return html.replace(
                "script-src 'self';",
                "script-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*;"
              )
            },
            generateBundle() {
              this.emitFile({
                type: 'asset',
                fileName: 'notices/mvp/NOTICE.md',
                source: readFileSync(
                  resolve('src/frontend/src/fixture/mvp/assets/NOTICE.md'),
                  'utf8'
                )
              })
            }
          } satisfies Plugin
        ]
      : [])
  ]

  return {
    main: {
      resolve: {
        alias: [
          { find: LIB_IMPORT_PATTERN, replacement: libAlias },
          {
            find: OCR_CONTRACT_IMPORT_PATTERN,
            replacement: resolve('../../packages/lib/src/ocr-contract.ts')
          }
        ]
      },
      define: {
        __DFRAGON_DESKTOP_BUILD__: desktopBuild,
        __DFRAGON_CHANNEL__: desktopChannel
      },
      build: {
        // Ky is ESM-only; bundle its default export into the CommonJS main process.
        externalizeDeps: { exclude: ['ky', '@dfragon/lib'] },
        lib: {
          entry: backendEntry
        },
        outDir: 'out/backend'
      }
    },
    preload: {
      resolve: { alias: [{ find: LIB_IMPORT_PATTERN, replacement: libAlias }] },
      build: {
        externalizeDeps: false,
        rollupOptions: {
          input: {
            index: resolve('src/preload/index.ts'),
            'character-detail': resolve('src/preload/character-detail.ts')
          }
        }
      }
    },
    renderer: {
      worker: { format: 'es' },
      root: frontendRoot,
      build: {
        // StyleX 규칙을 담은 공통 CSS를 모든 HTML entry에서 읽는다.
        cssCodeSplit: false,
        rollupOptions: {
          input: rendererInput,
          output: {
            assetFileNames: 'assets/[name][extname]'
          }
        },
        outDir: 'out/frontend'
      },
      resolve: {
        alias: rendererAliases
      },
      plugins: rendererPlugins
    }
  }
})
