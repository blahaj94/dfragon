import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const skippedPaths = new Set([
  'docs/rules/writing.md',
  'scripts/check-writing.mjs',
  'scripts/test/check-writing.test.mjs',
  'packages/lib/src/cp949-characters.ts',
  'apps/desktop/assets/ocr/korean-dict.txt'
])
const legacyBrandName = /(?<![A-Za-z0-9_-])DFRAGON(?![A-Za-z0-9_-])/u
const mixedCaseBrandName = /(?<![A-Za-z0-9_-])Dfragon(?![A-Za-z0-9_-])/u
const casualEnding =
  /(?<=[가-힣])(?:(?<![필주중개소수동강세니])요|죠)[.!?,:]?(?=[\s'"`<)\]}」』]|$)/u
const tightMiddleDot = /(?<! )·|·(?! )/u
const attachedRequest = /[가-힣]주세요/u
// 웹사이트 소개 문구는 해요체로 쓴다(2026-10-31 저장소 소유자 결정, Issue #1037).
const sitePath = 'apps/web/'

export const rules = [
  { name: '옛 표기 DFRAGON, Dfragon을 쓰지 않는다', pattern: legacyBrandName },
  { name: '옛 표기 DFRAGON, Dfragon을 쓰지 않는다', pattern: mixedCaseBrandName },
  {
    name: '사용자 문구에 해요체를 쓰지 않는다',
    pattern: casualEnding,
    skips: (path) => path.startsWith(sitePath)
  },
  { name: '나열에는 가운뎃점 대신 쉼표와 공백을 쓴다', pattern: tightMiddleDot },
  { name: '요청형의 주세요는 띄어 쓴다', pattern: attachedRequest }
]

export function findViolations(path, content) {
  const violations = []

  content.split('\n').forEach((text, index) => {
    for (const rule of rules) {
      if (rule.skips?.(path)) {
        continue
      }

      if (rule.pattern.test(text)) {
        violations.push({ path, line: index + 1, rule: rule.name, text: text.trim() })
      }
    }
  })

  return violations
}

export function listTrackedFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })

  return output.split('\0').filter((path) => path.length > 0 && !skippedPaths.has(path))
}

export function checkFiles(root, paths) {
  const violations = []

  for (const path of paths) {
    if (skippedPaths.has(path)) {
      continue
    }

    const file = resolve(root, path)
    const stats = statSync(file, { throwIfNoEntry: false })

    if (!stats?.isFile()) {
      continue
    }

    const bytes = readFileSync(file)

    if (bytes.includes(0)) {
      continue
    }

    violations.push(...findViolations(path, bytes.toString('utf8')))
  }

  return violations
}

function main(args) {
  const hasExplicitPaths = args.length > 0
  const root = hasExplicitPaths ? process.cwd() : repositoryRoot
  const paths = hasExplicitPaths ? args : listTrackedFiles(repositoryRoot)
  const violations = checkFiles(root, paths)

  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line}: ${violation.rule}: ${violation.text}`)
  }

  if (violations.length > 0) {
    console.error(`위반 ${violations.length}건. 기준: docs/rules/writing.md`)
    process.exit(1)
  }

  console.log(`표기와 문체 검사 통과: 파일 ${paths.length}개`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
