import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'

const noticeRoot = fileURLToPath(new URL('../notices/', import.meta.url))
const overrides: Record<string, { file: string; source: string; sha256: string }[]> = JSON.parse(
  readFileSync(new URL('../overrides.json', import.meta.url), 'utf8')
)

export interface NoticeEntry {
  name: string
  version: string
  license: string
  documents: { name: string; text: string }[]
}

export function findPackageRoot(file: string): string {
  let directory = dirname(file.split('?')[0])
  while (true) {
    const manifest = join(directory, 'package.json')
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name) {
      return realpathSync(directory)
    }
    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error('License collection could not identify a package')
    }
    directory = parent
  }
}

export function resolvePackageRoot(name: string, from: string): string {
  const require = createRequire(join(from, 'package.json'))
  try {
    return dirname(require.resolve(`${name}/package.json`))
  } catch {
    return findPackageRoot(require.resolve(name))
  }
}

// Include conventional root notices and nested license directories, without crawling source.
export function readNotices(directory: string): NoticeEntry['documents'] {
  const documents: NoticeEntry['documents'] = []
  function visit(folder: string): void {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name, 'en')
    )) {
      const file = join(folder, entry.name)
      if (entry.isDirectory()) {
        visit(file)
      } else if (entry.isFile()) {
        documents.push({
          name: relative(directory, file).replaceAll('\\', '/'),
          text: readFileSync(file, 'utf8')
        })
      }
    }
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      !/^(licen[cs]es?|notice|copying|copyright|third[-_]?party[-_]?notices?)([._-]|$)/i.test(
        entry.name
      )
    ) {
      continue
    }
    const file = join(directory, entry.name)
    if (entry.isDirectory()) {
      visit(file)
    } else if (entry.isFile()) {
      documents.push({ name: entry.name, text: readFileSync(file, 'utf8') })
    }
  }
  return documents.sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

/** Bundled modules plus installed production dependencies; development tools are excluded. */
export function collectPackages(moduleIds: Iterable<string>, runtimeRoot?: string): NoticeEntry[] {
  const roots = new Set<string>()
  for (const id of moduleIds) {
    if (id.includes('/node_modules/') && !id.startsWith('\0')) {
      roots.add(findPackageRoot(id))
    }
  }
  const visited = new Set<string>()
  function visit(directory: string): void {
    directory = realpathSync(directory)
    if (visited.has(directory)) {
      return
    }
    visited.add(directory)
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies }
    for (const name of Object.keys(dependencies)) {
      let dependency: string
      try {
        dependency = resolvePackageRoot(name, directory)
      } catch (error) {
        if (name in (manifest.optionalDependencies ?? {})) {
          continue
        }
        throw error
      }
      roots.add(realpathSync(dependency))
      visit(dependency)
    }
  }
  if (runtimeRoot) {
    visit(runtimeRoot)
  }
  return [...roots]
    .map((directory) => {
      return packageNotice(directory)
    })
    .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'))
}

export function packageNotice(directory: string): NoticeEntry {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  const documents = readNotices(directory)
  const key = `${manifest.name}@${manifest.version}`
  const overrideKey = manifest.name.startsWith('@koromix/koffi-')
    ? `koffi@${manifest.version}`
    : key
  for (const notice of overrides[overrideKey] ?? []) {
    const text = readFileSync(join(noticeRoot, notice.file), 'utf8')
    if (createHash('sha256').update(text).digest('hex') !== notice.sha256) {
      throw new Error(`License checksum mismatch for ${key}`)
    }
    documents.push({ name: notice.file, text })
  }
  if (key === 'guid-typescript@1.0.9' && !documents.length) {
    documents.push({
      name: 'LICENSE-STATUS.txt',
      text: '이 패키지는 npm에서 ISC를 선언하지만 배포 패키지와 현재 공식 저장소에 라이선스 원문이 없습니다. 저작권 문구를 추정하지 않았으며 원문 확보가 필요합니다.\nhttps://www.npmjs.com/package/guid-typescript/v/1.0.9\nhttps://github.com/snico-dev/guid-typescript'
    })
  }
  if (!documents.length) {
    throw new Error(`Missing license text for ${manifest.name}@${manifest.version}`)
  }
  return {
    name: manifest.name,
    version: manifest.version,
    license:
      (typeof manifest.license === 'string' ? manifest.license : 'See license text') +
      (key === 'guid-typescript@1.0.9' ? ' · 원문 확인 필요' : ''),
    documents
  }
}
