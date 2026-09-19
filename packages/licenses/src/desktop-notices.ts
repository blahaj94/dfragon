import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { collectPackages, resolvePackageRoot, type NoticeEntry } from './collect.ts'
import { renderNotices } from './viewer.ts'

const noticesRoot = fileURLToPath(new URL('../notices/', import.meta.url))

type DevServer = {
  moduleGraph: { idToModuleMap: Map<string, { id: string | null }> }
  middlewares: {
    use(
      handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void
    ): unknown
  }
}

export function desktopNotices({ desktopRoot, uiRoot }: { desktopRoot: string; uiRoot: string }) {
  function collect(moduleIds: Iterable<string>): Map<string, string> {
    const files = new Map<string, string>()
    const entries = collectPackages(moduleIds, desktopRoot)
    const electronRoot = resolvePackageRoot('electron', desktopRoot)
    const electronVersion = JSON.parse(
      readFileSync(join(electronRoot, 'package.json'), 'utf8')
    ).version
    for (const name of ['LICENSE', 'LICENSES.chromium.html']) {
      files.set(`notices/${name}`, readFileSync(join(electronRoot, 'dist', name), 'utf8'))
    }
    entries.unshift({
      name: 'Electron',
      version: electronVersion,
      license: 'MIT',
      documents: [{ name: 'LICENSE', text: files.get('notices/LICENSE')! }]
    })

    const staticGroups = [
      { directory: join(noticesRoot, 'ui'), name: 'SEED UI 및 아이콘', destination: 'notices' },
      {
        directory: join(noticesRoot, 'desktop'),
        name: 'NanumSquareNeo 및 Lucide',
        destination: 'notices/desktop'
      }
    ]
    for (const group of staticGroups) {
      const documents: NoticeEntry['documents'] = []
      for (const name of readdirSync(group.directory).sort()) {
        const text = readFileSync(join(group.directory, name), 'utf8')
        files.set(`${group.destination}/${name}`, text)
        documents.push({ name, text })
      }
      entries.push({ name: group.name, version: '', license: '원문 참조', documents })
    }
    const ocrRoot = join(desktopRoot, 'assets/ocr')
    const ocrDocuments = [
      'PaddleOCR-LICENSE.txt',
      'ONNX-Runtime-LICENSE.txt',
      'ONNX-Runtime-ThirdPartyNotices.txt',
      'provenance.json'
    ].map((name) => ({ name, text: readFileSync(join(ocrRoot, name), 'utf8') }))
    entries.push({
      name: 'PaddleOCR 모델·사전 및 ONNX Runtime',
      version: '',
      license: 'Apache-2.0 / MIT 및 제3자 고지',
      documents: ocrDocuments
    })
    const provenance = JSON.parse(readFileSync(join(uiRoot, 'seed-provenance.json'), 'utf8'))
    const changes = provenance.files
      .filter((file: { localChanges: string[] }) => file.localChanges.length)
      .map(
        (file: { local: string; localChanges: string[] }) =>
          `${file.local}:\n${JSON.stringify(file.localChanges, null, 2)}`
      )
      .join('\n\n')
    entries.push({
      name: 'LDB의 SEED 수정 내역',
      version: '',
      license: '변경 고지',
      documents: [{ name: 'LDB-MODIFICATIONS.txt', text: changes }]
    })
    files.set('notices/index.html', renderNotices(entries, true))
    files.set('notices/licenses.json', JSON.stringify(entries, null, 2))
    return files
  }
  return {
    name: 'ldb-desktop-notices',
    generateBundle(this: {
      getModuleIds(): IterableIterator<string>
      emitFile(asset: { type: 'asset'; fileName: string; source: string }): unknown
    }) {
      for (const [fileName, source] of collect(this.getModuleIds())) {
        // uiNotices emits the same UI originals; only one plugin owns those output paths.
        if (
          !fileName.startsWith('notices/desktop/') &&
          relative('notices', fileName).match(/^(SEED|ICONS)-/)
        ) {
          continue
        }
        this.emitFile({ type: 'asset', fileName, source })
      }
    },
    configureServer(server: DevServer) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0]
        if (pathname !== '/notices/index.html' && pathname !== '/notices/LICENSES.chromium.html') {
          next()
          return
        }
        try {
          const files = collect(
            [...server.moduleGraph.idToModuleMap.values()].flatMap((module) =>
              module.id ? [module.id] : []
            )
          )
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end(files.get(pathname.slice(1)))
        } catch {
          response.statusCode = 500
          response.end('라이선스 고지를 생성하지 못했습니다. 개발 빌드 설정을 확인해 주세요.')
        }
      })
    }
  }
}
