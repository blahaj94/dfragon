import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectPackages, resolvePackageRoot, type NoticeEntry } from './collect.ts'

const noticeRoot = fileURLToPath(new URL('../notices/', import.meta.url))
const moduleId = 'virtual:ldb-desktop-licenses'

/** Build an offline catalog from the same originals used in distribution notices. */
export function collectDesktopCatalog({
  runtimeRoot,
  uiRoot,
  ocrRoot
}: {
  runtimeRoot: string
  uiRoot: string
  ocrRoot: string
}): NoticeEntry[] {
  const document = (root: string, name: string) => ({
    name,
    text: readFileSync(join(root, name), 'utf8')
  })
  const entries: NoticeEntry[] = [
    {
      name: 'SEED Design',
      version: '',
      license: 'Apache-2.0',
      documents: ['SEED-NOTICE', 'SEED-LICENSE'].map((name) =>
        document(join(noticeRoot, 'ui'), name)
      )
    },
    {
      name: 'Seed Icon',
      version: '',
      license: 'Apache-2.0',
      documents: ['ICONS-NOTICE', 'ICONS-LICENSE'].map((name) =>
        document(join(noticeRoot, 'ui'), name)
      )
    },
    {
      name: 'Lucide',
      version: '',
      license: 'ISC · MIT',
      documents: [document(join(noticeRoot, 'desktop'), 'LUCIDE-LICENSE')]
    },
    {
      name: 'NanumSquare Neo',
      version: '',
      license: 'OFL-1.1',
      documents: [document(join(noticeRoot, 'desktop'), 'FONT-LICENSE')]
    },
    {
      name: 'PaddleOCR',
      version: '',
      license: 'Apache-2.0',
      documents: [document(ocrRoot, 'PaddleOCR-LICENSE.txt')]
    },
    {
      name: 'ONNX Runtime',
      version: '',
      license: 'MIT · Third-party notices',
      documents: ['ONNX-Runtime-LICENSE.txt', 'ONNX-Runtime-ThirdPartyNotices.txt'].map((name) =>
        document(ocrRoot, name)
      )
    }
  ]
  const manifest = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8'))
  const peerRoots = Object.keys(manifest.peerDependencies ?? {}).map((name) =>
    resolvePackageRoot(name, uiRoot)
  )
  const packages = new Map<string, NoticeEntry>()
  // UI peers are runtime inputs even though the Desktop manifest installs them as dev dependencies.
  for (const root of [runtimeRoot, uiRoot, ...peerRoots]) {
    const inputs = peerRoots.includes(root) ? [join(root, 'package.json')] : []
    for (const entry of collectPackages(inputs, root)) {
      packages.set(`${entry.name}@${entry.version}`, entry)
    }
  }
  return [
    ...entries,
    ...[...packages.values()].sort((a, b) =>
      `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en')
    )
  ]
}

/** Supply plain license data to the renderer without Node APIs or runtime filesystem access. */
export function desktopLicenseCatalog(options: Parameters<typeof collectDesktopCatalog>[0]) {
  return {
    name: 'ldb-desktop-license-catalog',
    resolveId(id: string) {
      return id === moduleId ? `\0${moduleId}` : null
    },
    load(id: string) {
      if (id !== `\0${moduleId}`) {
        return null
      }
      return `export default ${JSON.stringify(collectDesktopCatalog(options))};`
    }
  }
}
