import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../check-docs.mjs', import.meta.url))

async function writeFiles(directory, files) {
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(directory, name)), { recursive: true })
    await writeFile(join(directory, name), content)
  }
}

// tracked는 git add한 파일, untracked는 add하지 않은 새 파일이다. submodules는 내용을 받지 않은 submodule
// 경로로, clone 직후처럼 빈 디렉터리와 gitlink 항목만 둔다. 검사는 Git 저장소 단위로 실행된다.
async function checkFixture(t, { tracked, untracked = {}, submodules = [] }) {
  const directory = await mkdtemp(join(tmpdir(), 'check-docs-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await run('git', ['init', '-q'], { cwd: directory })
  await writeFiles(directory, tracked)
  await run('git', ['add', '--all'], { cwd: directory })

  for (const path of submodules) {
    await mkdir(join(directory, path), { recursive: true })
    const gitlink = `160000,${'1'.repeat(40)},${path}`
    await run('git', ['update-index', '--add', '--cacheinfo', gitlink], { cwd: directory })
  }

  await writeFiles(directory, untracked)

  try {
    const { stdout, stderr } = await run('node', [script], { cwd: directory })

    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr }
  }
}

// front matter의 YAML 주석은 heading이 아니므로 아래 두 번째 개요가 개요-1이 된다.
const guide = [
  '---',
  '# 개요',
  'type: reference',
  '---',
  '',
  '# 개요',
  '',
  '## 설치와 실행',
  '',
  '## 개요',
  '',
  '## `check-docs`',
  '',
  '### API (v2) 사용, 예외!',
  '',
  '## [링크 제목](https://example.com) 안내',
  '',
  '## 설치 <sup>beta</sup> 안내',
  '',
  '## a < b 비교',
  ''
].join('\n')

test('파일, 디렉터리, GitHub slug 규칙의 anchor와 add하지 않은 새 문서 링크는 통과한다', async (t) => {
  const result = await checkFixture(t, {
    tracked: {
      'README.md': [
        '# 문서 안내',
        '',
        '[가이드](docs/guide.md), [절](docs/guide.md#설치와-실행), [중복 heading](docs/guide.md#개요-1)',
        '[code span heading](docs/guide.md#check-docs), [문장부호](docs/guide.md#api-v2-사용-예외)',
        '[링크가 든 heading](docs/guide.md#링크-제목-안내), [같은 문서](#문서-안내)',
        '[HTML 태그](docs/guide.md#설치-beta-안내), [짝 없는 꺾쇠](docs/guide.md#a--b-비교)',
        '[인코딩](docs/guide.md#%EC%84%A4%EC%B9%98%EC%99%80-%EC%8B%A4%ED%96%89), [query](docs/guide.md?plain=1#개요)',
        '[디렉터리](scripts/), [코드 줄](scripts/tool.mjs#L1), [새 문서](docs/draft.md#초안)',
        '[저장소 루트 기준](/docs/guide.md), [괄호 경로](<docs/guide.md>)',
        '[외부](https://example.com/missing.md#none), [메일](mailto:team@example.com)',
        '<img src="docs/logo.png" alt="logo" />',
        '',
        '[참조]: docs/guide.md#개요',
        '',
        '`[code span 안](missing.md)`은 링크가 아니다.',
        '',
        '```md',
        '[code block 안](missing.md)',
        '```',
        ''
      ].join('\n'),
      'docs/guide.md': guide,
      'docs/logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'scripts/tool.mjs': 'export {}\n'
    },
    untracked: { 'docs/draft.md': '# 초안\n' }
  })

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /문서 링크, 경로 검사 통과: Markdown 파일 3개, 링크 21개/u)
})

test('없는 파일, 맞지 않는 anchor, ignore 대상, 저장소 밖 링크를 경로, 줄 번호와 함께 보고하고 실패한다', async (t) => {
  const result = await checkFixture(t, {
    tracked: {
      '.gitignore': 'ignored.md\n',
      'README.md': [
        '# 안내',
        '[없는 파일](docs/missing.md)',
        '[없는 절](docs/guide.md#없는-절)',
        '[중복 번호 초과](docs/guide.md#개요-2)',
        '[ignore 대상](ignored.md)',
        '[저장소 밖](../outside.md)',
        '[같은 문서의 없는 절](#없음)',
        '[잘못된 인코딩](docs/guide.md#%E0%A4%A)',
        '[공백이 든 anchor](docs/guide.md#설치와 실행)',
        '[정상](docs/guide.md#개요-1)',
        ''
      ].join('\n'),
      'docs/guide.md': guide
    },
    untracked: { 'ignored.md': '# 무시\n' }
  })

  assert.equal(result.code, 1)

  const expected = [
    [2, '상대 링크는 저장소에 있는 파일, 디렉터리를 가리킨다: docs/missing.md'],
    [3, 'anchor는 대상 문서의 heading과 맞는다: docs/guide.md#없는-절'],
    [4, 'anchor는 대상 문서의 heading과 맞는다: docs/guide.md#개요-2'],
    [5, '상대 링크는 저장소에 있는 파일, 디렉터리를 가리킨다: ignored.md'],
    [6, '상대 링크는 저장소 밖을 가리키지 않는다: ../outside.md'],
    [7, 'anchor는 대상 문서의 heading과 맞는다: #없음'],
    [8, '링크의 퍼센트 인코딩이 올바르다: docs/guide.md#%E0%A4%A'],
    [9, 'anchor는 대상 문서의 heading과 맞는다: docs/guide.md#설치와']
  ]

  for (const [line, message] of expected) {
    assert.ok(result.stderr.includes(`README.md:${line}: ${message}\n`), `${line}번째 줄`)
  }

  assert.doesNotMatch(result.stderr, /^README\.md:10: /mu)
  assert.match(result.stderr, /위반 8건/u)
})

test('code span의 apps, packages, .github 경로가 없으면 보고하고 glob, 자리표시, ignore, submodule 경로와 과거 문서는 건너뛴다', async (t) => {
  const result = await checkFixture(t, {
    tracked: {
      '.gitignore': 'dist/\n.env\n',
      'README.md': [
        '# 안내',
        '`apps/web/src/main.ts`, `apps/web/`, `./packages/lib/index.ts`, `.github/workflows/ci.yml`',
        '`apps/web/draft.ts`는 아직 add하지 않은 새 파일이다.',
        '`apps/*`, `apps/web/**`, `apps/<app>/README.md`, `apps/...`, `apps/web/src/main.ts:10`',
        '`apps/web/dist/main.js`, `apps/web/.env`는 build 산출물과 로컬 설정이다.',
        '`apps/web/models/model.onnx`는 submodule 안의 파일이다.',
        '`scripts/missing.mjs`, `docs/screens/`처럼 앱이나 다른 저장소 기준일 수 있는 경로는 보지 않는다.',
        '`pnpm --filter apps/web/missing test`처럼 경로만 담지 않은 code span도 보지 않는다.',
        '`apps/web/src/old.ts`',
        '[링크](docs/missing.md)와 `packages/lib/old.ts`',
        '``.github/workflows/old.yml``',
        '',
        '```md',
        '`apps/web/src/fenced.ts`',
        '```',
        ''
      ].join('\n'),
      'docs/history.md': [
        '---',
        'status: historical',
        '---',
        '',
        '# 이전 구조',
        '',
        '`apps/web/src/removed.ts`',
        ''
      ].join('\n'),
      'apps/web/src/main.ts': 'export {}\n',
      'packages/lib/index.ts': 'export {}\n',
      '.github/workflows/ci.yml': 'name: CI\n'
    },
    untracked: { 'apps/web/draft.ts': 'export {}\n' },
    submodules: ['apps/web/models']
  })

  assert.equal(result.code, 1)

  const violationLine = /^[\w./-]+\.md:\d+: /u
  const reported = result.stderr.split('\n').filter((line) => violationLine.test(line))

  assert.deepEqual(reported, [
    'README.md:9: code span의 저장소 경로는 저장소에 있는 파일, 디렉터리를 가리킨다: apps/web/src/old.ts',
    'README.md:10: 상대 링크는 저장소에 있는 파일, 디렉터리를 가리킨다: docs/missing.md',
    'README.md:10: code span의 저장소 경로는 저장소에 있는 파일, 디렉터리를 가리킨다: packages/lib/old.ts',
    'README.md:11: code span의 저장소 경로는 저장소에 있는 파일, 디렉터리를 가리킨다: .github/workflows/old.yml'
  ])
  assert.match(result.stderr, /위반 4건/u)
})
