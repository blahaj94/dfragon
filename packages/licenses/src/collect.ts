/**
 * 오픈소스 고지 수집 흐름 (의사코드)
 *
 * 초기화:
 *   라이선스 파일을 모아 둔 notices 폴더의 위치를 구한다.
 *   패키지에 빠진 라이선스 파일을 어디서 가져올지 overrides.json에서 읽는다.
 *
 * 패키지 위치 찾기:
 *   모듈 경로의 query를 제거하고, name이 있는 package.json까지 상위로 이동한다.
 *   의존성 이름은 package.json 경로로 해석하고, 불가능하면 진입 파일에서 역추적한다.
 *   파일이 속한 패키지를 찾지 못하면 오류를 낸다.
 *
 * collectPackages(번들 모듈, 선택적 runtimeRoot):
 *   가상 모듈을 제외한 node_modules 입력에서 파일이 속한 패키지를 찾아 중복을 제거한다.
 *   runtimeRoot가 있으면 dependencies와 optionalDependencies를 재귀 탐색한다.
 *     실제 경로별 방문 기록으로 순환을 막고 devDependencies는 탐색하지 않는다.
 *     해석되지 않는 optional 의존성은 건너뛰고, 필수 의존성 오류는 전파한다.
 *   패키지마다 아래 packageNotice를 실행하고 이름@버전 순서로 결과를 반환한다.
 *
 * packageNotice(패키지 경로):
 *   루트의 LICENSE / NOTICE / COPYING / COPYRIGHT / ThirdPartyNotices 계열을 읽는다.
 *     해당 이름의 디렉터리는 내부 파일도 읽되 일반 소스 디렉터리는 순회하지 않는다.
 *     문서 이름은 패키지 상대 경로로 기록하고 정렬한다.
 *   이름@버전에 등록된 중앙 보완 원문을 SHA-256 확인 후 추가한다.
 *     Koffi 플랫폼 패키지는 같은 버전의 부모 Koffi 보완 원문을 사용한다.
 *     보완 원문의 해시가 다르면 오류를 낸다.
 *   guid-typescript@1.0.9에 원문이 없으면 원문 확보 필요 문서를 넣는다.
 *     이 버전의 결과에는 원문 확인 필요 표시도 붙인다.
 *   그 외 원문이 없는 패키지는 오류를 낸다.
 *   패키지 이름, 버전, 선언 라이선스와 수집한 원문을 반환한다.
 */

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import type { NoticeEntry } from './types.ts'
export type { NoticeEntry } from './types.ts'

const noticeRoot = fileURLToPath(new URL('../notices/', import.meta.url))
const overrides: Record<string, { file: string; source: string; sha256: string }[]> = JSON.parse(
  readFileSync(new URL('../overrides.json', import.meta.url), 'utf8')
)

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
    const manifest = require.resolve(`${name}/package.json`)
    // Wildcard exports can resolve to a nonexistent package.json below the real root.
    if (existsSync(manifest)) {
      return findPackageRoot(manifest)
    }
    return findPackageRoot(require.resolve(name))
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
    // Native Windows paths and Vite module IDs use different separators.
    const modulePath = id.replaceAll('\\', '/')
    if (modulePath.includes('/node_modules/') && !modulePath.startsWith('\0')) {
      roots.add(findPackageRoot(modulePath))
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
