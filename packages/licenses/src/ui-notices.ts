import { collectPackages, findPackageRoot } from './collect.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const noticeRoot = fileURLToPath(new URL('../notices/ui/', import.meta.url))

type BundleContext = {
  getModuleIds(): IterableIterator<string>
  emitFile(asset: { type: 'asset'; fileName: string; source: string }): string
}

// 각 build 입력 graph의 dependency 고지와 module provenance를 보존한다.
// Tree-shaking 전 입력도 포함해 고지와 중복 사본 검사를 보수적으로 수행한다.
// Vite 7(Electron)과 Vite 8에서 공통으로 제공하는 Rollup hook만 사용한다.
export function uiNotices({ uiRoot, runtimeRoot }: { uiRoot: string; runtimeRoot?: string }) {
  return {
    name: 'dfragon-ui-notices',
    generateBundle(
      this: BundleContext,
      _options: unknown,
      bundle: Record<string, { type: 'asset' | 'chunk'; code?: string }>
    ) {
      const provenance = JSON.parse(readFileSync(join(uiRoot, 'seed-provenance.json'), 'utf8'))
      const changes: string[] = []
      for (const source of provenance.files) {
        const isModifiedSource = source.localChanges.length > 0
        if (!isModifiedSource) {
          continue
        }
        changes.push(`${source.local}:\n${JSON.stringify(source.localChanges, null, 2)}`)
      }
      this.emitFile({
        type: 'asset',
        fileName: 'notices/DFRAGON-MODIFICATIONS.txt',
        source: changes.join('\n\n')
      })
      const generatedJavaScriptFiles: string[] = []
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const isJavaScript = chunk.type === 'chunk'
        const hasCode = typeof chunk.code === 'string'
        const shouldMarkSource = isJavaScript && hasCode
        if (!shouldMarkSource) {
          continue
        }
        generatedJavaScriptFiles.push(fileName)
        chunk.code =
          '/*! DFRAGON modified SEED source: see notices/DFRAGON-MODIFICATIONS.txt and notices/seed-provenance.json. */\n' +
          chunk.code
      }
      this.emitFile({
        type: 'asset',
        fileName: 'notices/bundle-files.json',
        source: JSON.stringify(generatedJavaScriptFiles, null, 2)
      })
      for (const name of readdirSync(noticeRoot)) {
        this.emitFile({
          type: 'asset',
          fileName: `notices/${name}`,
          source: readFileSync(join(noticeRoot, name), 'utf8')
        })
      }

      this.emitFile({
        type: 'asset',
        fileName: 'notices/seed-provenance.json',
        source: readFileSync(join(uiRoot, 'seed-provenance.json'), 'utf8')
      })

      const packages = new Map<
        string,
        { name: string; version: string; license: string; modules: string[] }
      >()
      for (const moduleId of this.getModuleIds()) {
        const isDependency = moduleId.includes('/node_modules/') && !moduleId.startsWith('\0')
        if (!isDependency) {
          continue
        }
        const sourcePath = moduleId.split('?')[0]
        const directory = findPackageRoot(sourcePath)
        const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
        const isFirstModule = !packages.has(directory)
        if (isFirstModule) {
          packages.set(directory, {
            name: manifest.name,
            version: manifest.version,
            license: manifest.license,
            modules: []
          })
        }
        packages.get(directory)?.modules.push(relative(directory, sourcePath))
      }

      const thirdParty: string[] = []
      for (const metadata of collectPackages(this.getModuleIds(), runtimeRoot)) {
        thirdParty.push(`${metadata.name}@${metadata.version} (${metadata.license})`)
        for (const document of metadata.documents) {
          thirdParty.push(`${document.name}\n${document.text}`)
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'notices/THIRD-PARTY.txt',
        source: thirdParty.join('\n\n')
      })
      this.emitFile({
        type: 'asset',
        fileName: 'notices/bundle-modules.json',
        source: JSON.stringify([...packages.values()], null, 2)
      })
    }
  }
}
