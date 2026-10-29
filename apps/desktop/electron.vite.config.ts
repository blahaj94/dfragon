import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { rendererTransforms } from './build/renderer-transforms'
import { uiNotices, desktopNotices } from '@dfragon/licenses/vite'
import { readChannelNameFromMode, readDesktopChannel } from './build/channels'

const LIB_IMPORT_PATTERN = /^@dfragon\/lib$/
const OCR_CONTRACT_IMPORT_PATTERN = /^@dfragon\/lib\/ocr-contract$/
const SHAPE_CHECK_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/shape-check$/
const UI_IMPORT_PATTERN = /^@dfragon\/ui$/

export default defineConfig(({ mode, command }) => {
  const libAlias = resolve('../../packages/lib/src/index.ts')
  const shapeCheckAlias = resolve('../../packages/lib/src/utils/shape-check.ts')
  const channelName = readChannelNameFromMode(mode)
  const desktopChannel = JSON.stringify(
    channelName != null ? readDesktopChannel(channelName) : null
  )
  const backendEntry = resolve('src/backend/main.ts')
  const frontendRoot = resolve('src/frontend')
  const rendererInput = {
    app: resolve('src/frontend/index.html'),
    ...(mode === 'mvp-preview' ? { mvpPreview: resolve('src/frontend/mvp-preview.html') } : {})
  }
  const rendererAliases = [
    { find: '@frontend', replacement: resolve('src/frontend/src') },
    { find: LIB_IMPORT_PATTERN, replacement: libAlias },
    { find: UI_IMPORT_PATTERN, replacement: resolve('../../packages/ui/src/index.tsx') }
  ]
  const rendererPlugins = [
    ...rendererTransforms(),
    uiNotices({ runtimeRoot: resolve('.') }),
    desktopNotices(),
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
          },
          { find: SHAPE_CHECK_IMPORT_PATTERN, replacement: shapeCheckAlias }
        ]
      },
      define: {
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
      resolve: {
        alias: [
          { find: LIB_IMPORT_PATTERN, replacement: libAlias },
          { find: SHAPE_CHECK_IMPORT_PATTERN, replacement: shapeCheckAlias }
        ]
      },
      build: {
        externalizeDeps: false,
        rollupOptions: {
          input: { index: resolve('src/preload/index.ts') }
        }
      }
    },
    renderer: {
      worker: { format: 'es' },
      root: frontendRoot,
      build: {
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
