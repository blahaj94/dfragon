import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import { rendererTransforms } from './build/renderer-transforms'
import { seedDesignPlugin } from '@seed-design/vite-plugin'
import { uiNotices, desktopNotices, desktopLicenseCatalog } from '@dfragon/licenses/vite'
import {
  readDistributionApiOrigin,
  readDistributionAccountsOrigin
} from './build/distribution-config'
import { readDesktopSourceInfo } from './build/build-info'

export default defineConfig(({ mode, command }) => {
  const libAlias = resolve('../../packages/lib/src/index.ts')
  const desktopBuild = JSON.stringify(
    readDesktopSourceInfo(fileURLToPath(new URL('.', import.meta.url)))
  )
  const developmentAuth = JSON.stringify(mode === 'dfragon-development')
  const distributionAccountsOrigin = JSON.stringify(
    mode === 'dfragon-distribution' ? readDistributionAccountsOrigin() : null
  )
  const distributionApiOrigin = JSON.stringify(
    mode === 'dfragon-distribution' ? readDistributionApiOrigin() : null
  )
  const backendEntry = resolve('src/backend/main.ts')
  const frontendRoot = resolve('src/frontend')
  const rendererInput =
    mode === 'mvp-preview'
      ? {
          app: resolve('src/frontend/index.html'),
          mvpPreview: resolve('src/frontend/mvp-preview.html')
        }
      : resolve('src/frontend/index.html')
  const rendererAliases = [
    { find: '@frontend', replacement: resolve('src/frontend/src') },
    {
      find: /^@dfragon\/lib\/utils\/pagination$/,
      replacement: resolve('../../packages/lib/src/utils/pagination.ts')
    },
    { find: /^@dfragon\/ui$/, replacement: resolve('../../packages/ui/src/index.tsx') }
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
      resolve: { alias: { '@dfragon/lib': libAlias } },
      define: {
        __DFRAGON_DESKTOP_BUILD__: desktopBuild,
        __DFRAGON_DEVELOPMENT_AUTH__: developmentAuth,
        __DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN__: distributionAccountsOrigin,
        __DFRAGON_DISTRIBUTION_API_ORIGIN__: distributionApiOrigin
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
    preload: { build: { externalizeDeps: false } },
    renderer: {
      worker: { format: 'es' },
      root: frontendRoot,
      build: {
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
