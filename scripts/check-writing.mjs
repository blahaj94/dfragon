import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 기준은 docs/rules/writing.md다.
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
// 규칙 문서, 검사 스크립트와 그 테스트는 금지 표기를 예시로 담고, CP949 문자 표와 OCR 사전은 가운뎃점 자체가 데이터라 제외한다.
const skippedPaths = new Set([
  'docs/rules/writing.md',
  'scripts/check-writing.mjs',
  'scripts/test/check-writing.test.mjs',
  'packages/lib/src/cp949-characters.ts',
  'apps/desktop/assets/ocr/korean-dict.txt'
])
// 앞뒤에 _, -, 영숫자가 붙은 표기는 환경 변수, 빌드 상수, 파일 이름 같은 식별자로 보고 건너뛴다.
const legacyBrandName = /(?<![A-Za-z0-9_-])DFRAGON(?![A-Za-z0-9_-])/u
const mixedCaseBrandName = /(?<![A-Za-z0-9_-])Dfragon(?![A-Za-z0-9_-])/u
// 한글 뒤에 오는 해요체 어미가 문장 끝이나 구두점 뒤의 공백, 따옴표, 태그, 괄호 앞에 있는 경우다. 하세요, 주세요는 허용한다.
const casualEnding =
  /(?<=[가-힣])(?:[아어여해돼예에네데게까군래나가]요|죠)[.!?,:]?(?=[\s'"`<)\]}」』]|$)/u
// 나열의 가운뎃점이다. 양쪽에 공백을 둔 ` · ` 구분자는 제목, 상태 표시에 허용한다.
const tightMiddleDot = /(?<! )·|·(?! )/u
// 보조용언 주세요를 붙여 쓴 요청형이다. `열어 주세요`처럼 띄어 쓴다.
const attachedRequest = /[가-힣]주세요/u

export const rules = [
  { name: '제품 이름은 DFragon으로 쓴다', pattern: legacyBrandName },
  { name: '제품 이름은 DFragon으로 쓴다', pattern: mixedCaseBrandName },
  { name: '사용자 문구에 해요체를 쓰지 않는다', pattern: casualEnding },
  { name: '나열에는 가운뎃점 대신 쉼표와 공백을 쓴다', pattern: tightMiddleDot },
  { name: '요청형의 주세요는 띄어 쓴다', pattern: attachedRequest }
]

export function findViolations(path, content) {
  const violations = []

  content.split('\n').forEach((text, index) => {
    for (const rule of rules) {
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

    // submodule 같은 디렉터리 항목은 읽지 않는다.
    if (!stats?.isFile()) {
      continue
    }

    const bytes = readFileSync(file)

    // NUL 바이트가 있는 파일은 이미지, 폰트 같은 이진 파일로 보고 건너뛴다.
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
