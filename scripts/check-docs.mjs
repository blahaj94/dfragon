import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rules = {
  missingTarget: '상대 링크는 저장소에 있는 파일, 디렉터리를 가리킨다',
  outsideRepository: '상대 링크는 저장소 밖을 가리키지 않는다',
  missingAnchor: 'anchor는 대상 문서의 heading과 맞는다',
  malformedLink: '링크의 퍼센트 인코딩이 올바르다',
  missingPath: 'code span의 저장소 경로는 저장소에 있는 파일, 디렉터리를 가리킨다'
}

// GitHub는 문서 첫 줄부터 시작하는 YAML front matter를 표로 보여 주고 heading으로 읽지 않는다.
const frontMatterOpening = /^---\s*$/u
const frontMatterClosing = /^(?:---|\.\.\.)\s*$/u
// 과거 revision을 기록한 문서는 지금 없는 경로를 그대로 남긴다.
const historicalStatus = /^status:[ \t]*historical[ \t]*$/u
const codeFenceOpening = /^\s*(`{3,}|~{3,})(.*)$/u
const atxHeading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/u
const atxClosingSequence = /(?:^|[ \t]+)#+$/u
// 같은 길이의 백틱 묶음이 열고 닫는 code span이다.
const codeSpan = /(?<!`)(`+)(?!`)(.*?[^`])\1(?!`)/gu
const image = /!\[[^\]]*\]\([^)]*\)/gu
const inlineLink = /\[([^\]]*)\]\([^)]*\)/gu
const referenceLink = /\[([^\]]*)\]\[[^\]]*\]/gu
const backslashEscape = /\\([!-/:-@[-`{-~])/gu
const linkDestinationStart = /\]\(/gu
const referenceDefinition = /^ {0,3}\[[^\]]+\]:[ \t]*(\S+)/u
const htmlLinkAttribute = /<(?:a|img)\b[^>]*?\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/giu
// URL scheme(https:, mailto: 등)이나 //로 시작하는 주소는 외부 링크로 보고 검사하지 않는다.
const externalDestination = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu
// github-slugger와 같은 기준이다. 문자, 결합 문자, 십진 숫자, 연결 문장부호, 공백과 하이픈만 남긴다.
const slugRemovedCharacter = /[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\p{Join_Control} -]/gu
const slugSpace = / /gu
const markdownFile = /\.md$/iu
const referenceAngleBrackets = /^<|>$/gu
const trailingSlashes = /\/+$/u
// code span 전체가 저장소 루트 기준이 분명한 경로일 때만 확인한다. scripts/, docs/로 시작하는 짧은 경로는
// 앱 디렉터리나 다른 저장소 기준인 경우가 많다. glob, 자리표시(<name>, ...), 줄 번호가 붙은 표기는 경로로 보지 않는다.
const repositoryPath = /^(?:\.\/)?((?:apps|packages|\.github)\/[^\s*?<>{}[\]$#:]*)$/u
const placeholderPath = /\.\.\./u

function slugifyHeading(text) {
  return text.toLowerCase().replace(slugRemovedCharacter, '').replace(slugSpace, '-')
}

// `<`부터 다음 `>`까지를 HTML 태그로 보고 지운다. 짝이 없는 꺾쇠는 그 글자만 지운다.
// slug 단계에서도 지워지는 글자라 anchor 결과는 같고, 태그 조각을 남기지 않는다.
function removeHtmlTags(text) {
  let result = ''
  let index = 0

  while (index < text.length) {
    const character = text[index]

    if (character === '<') {
      const closingIndex = text.indexOf('>', index + 1)
      const hasClosing = closingIndex !== -1
      index = hasClosing ? closingIndex + 1 : index + 1
      continue
    }

    if (character !== '>') {
      result += character
    }
    index += 1
  }

  return result
}

// 렌더링된 heading의 글자만 남긴다. code span 안의 글자는 그대로 두고 링크, 이미지, HTML 표기를 걷어 낸다.
function headingText(source) {
  const parts = source.split(codeSpan)
  let text = ''

  // split은 [본문, 백틱, code span 내용, 본문, ...] 순서로 나눈다.
  for (let index = 0; index < parts.length; index += 3) {
    const withoutLinks = parts[index]
      .replace(image, '')
      .replace(inlineLink, '$1')
      .replace(referenceLink, '$1')
    const prose = removeHtmlTags(withoutLinks).replace(backslashEscape, '$1')
    text += prose + (parts[index + 2] ?? '')
  }

  return text.trim()
}

// GitHub처럼 같은 slug가 다시 나오면 -1, -2를 붙이고, 붙인 결과도 이미 있으면 다음 번호를 쓴다.
function createSlugger() {
  const occurrences = new Map()

  return (text) => {
    const base = slugifyHeading(text)
    let slug = base

    while (occurrences.has(slug)) {
      const count = occurrences.get(base) + 1
      occurrences.set(base, count)
      slug = `${base}-${count}`
    }

    occurrences.set(slug, 0)

    return slug
  }
}

function readDestination(text, start) {
  let index = start

  while (text[index] === ' ' || text[index] === '\t') {
    index += 1
  }

  if (text[index] === '<') {
    const end = text.indexOf('>', index + 1)

    if (end === -1) {
      return null
    }

    return text.slice(index + 1, end)
  }

  let depth = 0
  let destination = ''

  for (; index < text.length; index += 1) {
    const character = text[index]

    if (character === '\\' && index + 1 < text.length) {
      destination += text[index + 1]
      index += 1
      continue
    }

    if (character === ' ' || character === '\t') {
      break
    }

    if (character === '(') {
      depth += 1
    }

    if (character === ')') {
      if (depth === 0) {
        break
      }

      depth -= 1
    }

    destination += character
  }

  return destination
}

function lineDestinations(text) {
  const destinations = []

  for (const match of text.matchAll(linkDestinationStart)) {
    destinations.push(readDestination(text, match.index + match[0].length))
  }

  const definition = referenceDefinition.exec(text)

  if (definition) {
    destinations.push(definition[1].replace(referenceAngleBrackets, ''))
  }

  for (const match of text.matchAll(htmlLinkAttribute)) {
    destinations.push(match[1] ?? match[2])
  }

  return destinations.filter((destination) => destination != null && destination.length > 0)
}

function frontMatterLines(lines) {
  if (!frontMatterOpening.test(lines[0] ?? '')) {
    return []
  }

  const closing = lines.findIndex((line, index) => index > 0 && frontMatterClosing.test(line))

  if (closing === -1) {
    return []
  }

  return lines.slice(0, closing + 1)
}

function linePaths(text) {
  const paths = []

  for (const match of text.matchAll(codeSpan)) {
    const path = repositoryPath.exec(match[2].trim())

    if (path && !placeholderPath.test(path[1])) {
      paths.push(path[1].replace(trailingSlashes, ''))
    }
  }

  return paths
}

// ATX heading의 anchor, code block 밖의 링크 목적지와 code span의 저장소 경로를 줄 번호와 함께 모은다.
function scanMarkdown(content) {
  const lines = content.split('\n')
  const frontMatter = frontMatterLines(lines)
  const historical = frontMatter.some((line) => historicalStatus.test(line))
  const slug = createSlugger()
  const anchors = new Set()
  const links = []
  const paths = []
  let fence = null

  for (let index = frontMatter.length; index < lines.length; index += 1) {
    const line = lines[index]

    if (fence) {
      const closing = line.trim()
      const isClosingFence =
        closing.length >= fence.length && closing === fence.marker.repeat(closing.length)

      if (isClosingFence) {
        fence = null
      }

      continue
    }

    const opening = codeFenceOpening.exec(line)
    // 백틱 fence의 info string에는 백틱이 들어갈 수 없으므로 한 줄짜리 code span과 구분된다.
    const isCodeFence = opening && !(opening[1][0] === '`' && opening[2].includes('`'))

    if (isCodeFence) {
      fence = { marker: opening[1][0], length: opening[1].length }
      continue
    }

    const heading = atxHeading.exec(line)

    if (heading) {
      const title = (heading[2] ?? '').replace(atxClosingSequence, '')
      anchors.add(slug(headingText(title)))
    }

    for (const destination of lineDestinations(line.replace(codeSpan, ''))) {
      links.push({ line: index + 1, destination })
    }

    for (const path of linePaths(line)) {
      paths.push({ line: index + 1, path })
    }
  }

  return { anchors, links, paths, historical }
}

function decode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function splitDestination(destination) {
  const hashIndex = destination.indexOf('#')
  let path = destination
  let fragment = null

  if (hashIndex !== -1) {
    path = destination.slice(0, hashIndex)
    fragment = destination.slice(hashIndex + 1)
  }

  const queryIndex = path.indexOf('?')

  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex)
  }

  return { path, fragment }
}

function resolveTarget(source, path) {
  if (path.startsWith('/')) {
    return posix.normalize(path.slice(1))
  }

  return posix.normalize(posix.join(posix.dirname(source), path))
}

function linkViolation(source, link, rule) {
  return { path: source, line: link.line, rule, text: link.destination }
}

function checkLink(source, link, repository) {
  if (externalDestination.test(link.destination)) {
    return null
  }

  const { path, fragment } = splitDestination(link.destination)
  const decodedPath = decode(path)
  const decodedFragment = decode(fragment ?? '')

  if (decodedPath == null || decodedFragment == null) {
    return linkViolation(source, link, rules.malformedLink)
  }

  let target = source

  if (decodedPath.length > 0) {
    target = resolveTarget(source, decodedPath).replace(trailingSlashes, '')
  }

  if (target === '..' || target.startsWith('../')) {
    return linkViolation(source, link, rules.outsideRepository)
  }

  const exists = repository.files.has(target) || repository.directories.has(target)

  if (!exists) {
    return linkViolation(source, link, rules.missingTarget)
  }

  // 코드 파일의 #L10 같은 줄 anchor와 디렉터리 anchor는 GitHub 화면이 정하므로 Markdown 대상만 확인한다.
  const checksAnchor = decodedFragment.length > 0 && markdownFile.test(target)

  if (checksAnchor && !repository.anchorsOf(target).has(decodedFragment)) {
    return linkViolation(source, link, rules.missingAnchor)
  }

  return null
}

function checkPath(source, mention, repository) {
  const { path } = mention
  const exists = repository.files.has(path) || repository.directories.has(path)
  // submodule 안의 파일은 이 저장소의 Git 목록에 없고 CI도 submodule 없이 검사한다.
  const insideSubmodule = [...repository.submodules].some((submodule) => {
    return path.startsWith(`${submodule}/`)
  })

  if (exists || insideSubmodule || repository.ignored.has(path)) {
    return null
  }

  return { path: source, line: mention.line, rule: rules.missingPath, text: path }
}

function ancestorDirectories(paths) {
  const directories = new Set([''])

  for (const path of paths) {
    let parent = posix.dirname(path)

    while (parent !== '.' && !directories.has(parent)) {
      directories.add(parent)
      parent = posix.dirname(parent)
    }
  }

  return directories
}

// 추적 파일과 ignore 대상이 아닌 새 파일을 모두 본다. 아직 add하지 않은 새 문서도 링크 대상이 된다.
function listRepositoryPaths(root) {
  const args = ['ls-files', '-z', '--deduplicate', '--cached', '--others', '--exclude-standard']
  const output = execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const files = new Set()
  const submodules = new Set()

  for (const path of output.split('\0').filter((entry) => entry.length > 0)) {
    const stats = statSync(resolve(root, path), { throwIfNoEntry: false })

    // 지운 뒤 아직 commit하지 않은 파일은 링크 대상에서 뺀다. ls-files가 디렉터리로 주는 항목은 submodule이다.
    if (stats == null) {
      continue
    }

    if (stats.isDirectory()) {
      submodules.add(path)
    } else {
      files.add(path)
    }
  }

  const directories = ancestorDirectories([...files, ...submodules])

  for (const submodule of submodules) {
    directories.add(submodule)
  }

  return { files, directories, submodules }
}

// build 산출물, 로컬 .env처럼 ignore 규칙에 걸리는 경로는 checkout마다 있고 없음이 달라 확인하지 않는다.
function listIgnoredPaths(root, paths) {
  if (paths.length === 0) {
    return new Set()
  }

  const result = spawnSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
    cwd: root,
    encoding: 'utf8',
    input: paths.join('\0')
  })

  // check-ignore는 ignore 대상이 하나도 없으면 1로 끝난다.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore 실패: ${result.error?.message ?? result.stderr}`)
  }

  return new Set(result.stdout.split('\0').filter((entry) => entry.length > 0))
}

function checkRepository(root) {
  const { files, directories, submodules } = listRepositoryPaths(root)
  const scans = new Map()

  function scanOf(path) {
    if (!scans.has(path)) {
      scans.set(path, scanMarkdown(readFileSync(resolve(root, path), 'utf8')))
    }

    return scans.get(path)
  }

  const markdownPaths = [...files].filter((path) => markdownFile.test(path)).sort()

  function pathsOf(source) {
    const scan = scanOf(source)

    if (scan.historical) {
      return []
    }

    return scan.paths
  }

  const mentionedPaths = markdownPaths.flatMap((source) => pathsOf(source).map(({ path }) => path))
  const missingPaths = [...new Set(mentionedPaths)].filter((path) => {
    return !files.has(path) && !directories.has(path)
  })
  const repository = {
    files,
    directories,
    submodules,
    ignored: listIgnoredPaths(root, missingPaths),
    anchorsOf: (path) => scanOf(path).anchors
  }
  const violations = []
  let linkCount = 0

  for (const source of markdownPaths) {
    const sourceViolations = []

    for (const link of scanOf(source).links) {
      linkCount += 1
      sourceViolations.push(checkLink(source, link, repository))
    }

    for (const mention of pathsOf(source)) {
      sourceViolations.push(checkPath(source, mention, repository))
    }

    const found = sourceViolations.filter((violation) => violation != null)
    violations.push(...found.sort((left, right) => left.line - right.line))
  }

  return {
    violations,
    markdownCount: markdownPaths.length,
    linkCount,
    pathCount: mentionedPaths.length
  }
}

function main(args) {
  if (args.length > 0) {
    console.error('Usage: node scripts/check-docs.mjs')
    process.exit(2)
  }

  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const { violations, markdownCount, linkCount, pathCount } = checkRepository(root)

  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line}: ${violation.rule}: ${violation.text}`)
  }

  if (violations.length > 0) {
    console.error(`위반 ${violations.length}건. 사용법: scripts/README.md#check-docs`)
    process.exit(1)
  }

  console.log(
    `문서 링크, 경로 검사 통과: Markdown 파일 ${markdownCount}개, 링크 ${linkCount}개, 저장소 경로 ${pathCount}개`
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
