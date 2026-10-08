import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, matchesGlob, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const SCRIPT_KINDS = new Map([
  ['.js', ts.ScriptKind.JS],
  ['.mjs', ts.ScriptKind.JS],
  ['.cjs', ts.ScriptKind.JS],
  ['.jsx', ts.ScriptKind.JSX],
  ['.ts', ts.ScriptKind.TS],
  ['.mts', ts.ScriptKind.TS],
  ['.cts', ts.ScriptKind.TS],
  ['.tsx', ts.ScriptKind.TSX]
])
const BLANK_LINE_PATTERN = /^[ \t]*\n$/
const NEGATED_GLOB_PREFIX = /^!+/
const MESSAGES = {
  return: 'return 앞에 빈 줄이 필요합니다.',
  if: '연속된 블록 if 사이에 빈 줄이 필요합니다.'
}

function statementsOf(node) {
  const hasStatementList =
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseClause(node) ||
    ts.isDefaultClause(node)

  if (!hasStatementList) {
    return []
  }

  return node.statements.filter((statement) => !ts.isEmptyStatement(statement))
}

function isBlockIf(statement) {
  return ts.isIfStatement(statement) && ts.isBlock(statement.thenStatement)
}

// The first statement of a list keeps Biome's layout; later returns and adjacent block ifs are separated.
// A return needs the blank line right above it, after any leading comment. A block if accepts a blank
// line anywhere between the previous if and its own line.
function spacingKind(statement, previous) {
  if (ts.isReturnStatement(statement)) {
    return 'return'
  }

  if (isBlockIf(statement) && isBlockIf(previous)) {
    return 'if'
  }

  return null
}

/**
 * Biome가 정렬한 JavaScript/TypeScript source에 문장 간격 정책을 적용한다.
 * 같은 줄에 이어진 문장은 Biome 포맷이 먼저 나누므로 고치지 않고 unresolved로 돌려준다.
 * 구문 오류가 있는 source는 바꾸지 않고 hasSyntaxError로 알린다.
 */
export function applyStatementSpacing(source, fileName) {
  const scriptKind = SCRIPT_KINDS.get(extname(fileName))
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
  // parseDiagnostics holds only the parser's syntax errors; type and binder errors are not computed here.
  const hasSyntaxError = sourceFile.parseDiagnostics.length > 0

  if (hasSyntaxError) {
    return { text: source, missing: [], unresolved: [], hasSyntaxError }
  }

  const lineStarts = sourceFile.getLineStarts()
  const missing = []
  const unresolved = []

  function isBlankLine(line) {
    return BLANK_LINE_PATTERN.test(source.slice(lineStarts[line], lineStarts[line + 1]))
  }

  function hasBlankLine(kind, previous, line) {
    if (kind === 'return') {
      return isBlankLine(line - 1)
    }

    const previousEndLine = sourceFile.getLineAndCharacterOfPosition(previous.end).line
    for (let between = previousEndLine + 1; between < line; between++) {
      if (isBlankLine(between)) {
        return true
      }
    }

    return false
  }

  function visit(node) {
    const statements = statementsOf(node)

    for (const [index, statement] of statements.entries()) {
      const previous = statements[index - 1]
      const kind = previous && spacingKind(statement, previous)

      if (kind) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile))
        const lineStart = lineStarts[line]
        const issue = { line: line + 1, kind, lineStart }

        if (previous.end > lineStart) {
          unresolved.push(issue)
        } else if (!hasBlankLine(kind, previous, line)) {
          missing.push(issue)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  missing.sort((a, b) => a.line - b.line)
  unresolved.sort((a, b) => a.line - b.line)

  const insertions = [...new Set(missing.map((issue) => issue.lineStart))].sort((a, b) => b - a)
  let text = source

  for (const position of insertions) {
    text = `${text.slice(0, position)}\n${text.slice(position)}`
  }

  return { text, missing, unresolved, hasSyntaxError }
}

function readIncludes(root) {
  const config = JSON.parse(readFileSync(join(root, 'biome.json'), 'utf8'))
  const fileIncludes = config.files?.includes ?? ['**']
  const formatterIncludes = config.formatter?.includes ?? ['**']

  return [fileIncludes, formatterIncludes]
}

// Mirrors Biome's ordered includes: a later negated glob excludes a matched file or folder.
function isIncluded(path, patterns) {
  let included = false

  for (const pattern of patterns) {
    const isNegated = pattern.startsWith('!')
    const glob = pattern.replace(NEGATED_GLOB_PREFIX, '')
    const matches = matchesGlob(path, glob) || matchesGlob(path, `${glob}/**`)

    if (matches) {
      included = !isNegated
    }
  }

  return included
}

function listSourceFiles(cwd, paths) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  const rootPath = root.trim()
  const includes = readIncludes(rootPath)
  const args = [
    'ls-files',
    '-z',
    '--deduplicate',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    ...paths
  ]
  const listed = execFileSync('git', args, { cwd, encoding: 'utf8' }).split('\0')

  return listed.filter((file) => {
    const absolute = resolve(cwd, file)
    const fromRoot = relative(rootPath, absolute)
    const isSource = SCRIPT_KINDS.has(extname(file))

    return isSource && existsSync(absolute) && includes.every((list) => isIncluded(fromRoot, list))
  })
}

function run(argv, cwd) {
  const [mode, ...paths] = argv
  const isKnownMode = mode === '--check' || mode === '--write'

  if (!isKnownMode) {
    console.error('Usage: node scripts/statement-spacing.mjs --check|--write [path...]')

    return 2
  }

  const files = listSourceFiles(cwd, paths.length > 0 ? paths : ['.'])
  let failures = 0
  let syntaxErrors = 0
  let fixed = 0

  for (const file of files) {
    const absolute = resolve(cwd, file)
    const source = readFileSync(absolute, 'utf8')
    const { text, missing, unresolved, hasSyntaxError } = applyStatementSpacing(source, absolute)

    if (hasSyntaxError) {
      console.error(`${file}: 구문 오류가 있어 문장 간격을 적용하지 않았습니다.`)
      syntaxErrors++
      continue
    }

    const reported = mode === '--check' ? [...missing, ...unresolved] : unresolved

    for (const issue of reported) {
      console.error(`${file}:${issue.line}: ${MESSAGES[issue.kind]}`)
    }

    failures += reported.length

    if (mode === '--write' && text !== source) {
      writeFileSync(absolute, text)
      fixed++
    }
  }

  if (mode === '--write') {
    console.log(`Checked ${files.length} files. Fixed ${fixed} files.`)
  }

  // A syntax error is a different failure from a spacing mismatch, matching the old formatter exit code.
  if (syntaxErrors > 0) {
    return 2
  }

  if (failures > 0) {
    console.error('문장 간격 정책을 맞추려면 Biome 포맷 후 `--write`를 실행합니다.')

    return 1
  }

  return 0
}

const entryPath = process.argv[1]
const hasEntryPath = entryPath != null
if (hasEntryPath) {
  const isDirectRun = import.meta.url === pathToFileURL(entryPath).href
  if (isDirectRun) {
    process.exitCode = run(process.argv.slice(2), process.cwd())
  }
}
