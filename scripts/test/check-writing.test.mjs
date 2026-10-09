import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const script = fileURLToPath(new URL('../check-writing.mjs', import.meta.url))
const root = fileURLToPath(new URL('../../', import.meta.url))

async function checkFixture(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'check-writing-'))
  t.after(() => rm(directory, { recursive: true, force: true }))

  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(directory, name)), { recursive: true })
    await writeFile(join(directory, name), content)
  }

  try {
    const { stdout, stderr } = await run('node', [script, ...Object.keys(files)], {
      cwd: directory
    })

    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr }
  }
}

test('DFragon 표기, 식별자, 합니다체와 하세요체는 통과한다', async (t) => {
  const result = await checkFixture(t, {
    'allowed.md': [
      'DFragon Desktop은 던파 창을 찾습니다.',
      'DFRAGON_DISTRIBUTION_API_ORIGIN=https://api.example.test',
      '__DFRAGON_DESKTOP_BUILD__, @dfragon/ui, dfragon://auth/callback, notices/DFRAGON-MODIFICATIONS.txt',
      '창 목록을 불러오지 못했습니다. 닉네임을 입력하세요. 다시 로그인해 주세요.',
      "confirm: '저장하시겠습니까?'",
      '필요한 값이 없습니다. 주요 항목과 개요, 해요체 설명',
      '측정 조건, 스킬, 데미지 · 2026-10-09 기준',
      ''
    ].join('\n')
  })

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /파일 1개/u)
})

test('옛 표기, 해요체 어미, 나열 가운뎃점, 붙여 쓴 요청형을 경로, 줄 번호와 함께 보고하고 실패한다', async (t) => {
  const result = await checkFixture(t, {
    'copy.tsx': [
      "const title = 'DFRAGON Desktop'",
      'Dfragon 앱에서 다시 로그인해 주세요.',
      "title: '던파 창을 찾지 못했어요',",
      "if (!window.confirm('삭제할까요?')) {",
      '<p>모든 패스키를 잃으면 계정을 복구할 수 없어요.</p>',
      '"body": "타격 장면을 비교해보는 영상이에요."',
      '패스키가 있나요: 로그인했어요, 다시 시도하세요',
      '측정 조건·스킬·데미지를 확인하세요.',
      '게임 창을 열어주세요.',
      '라이선스를 확인하세요.',
      ''
    ].join('\n')
  })

  assert.equal(result.code, 1)

  for (const line of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    assert.match(result.stderr, new RegExp(`^copy\\.tsx:${line}: `, 'mu'), `${line}번째 줄`)
  }

  assert.doesNotMatch(result.stderr, /^copy\.tsx:10: /mu)
  assert.match(result.stderr, /위반 9건/u)
})

test('규칙 문서처럼 금지 표기를 예시로 담는 제외 경로는 명시해도 건너뛴다', async (t) => {
  const result = await checkFixture(t, {
    'docs/rules/writing.md': '`DFRAGON`, `Dfragon`은 쓰지 않는다. 동작·구조 나열은 쉼표로 쓴다.\n'
  })

  assert.equal(result.code, 0, result.stderr)
})

test('NUL 바이트가 있는 이진 파일은 건너뛴다', async (t) => {
  const result = await checkFixture(t, { 'icon.bin': Buffer.from('DFRAGON\0못했어요', 'utf8') })

  assert.equal(result.code, 0, result.stderr)
})

test('인자 없이 실행하면 저장소의 Git 추적 파일이 모두 통과한다', async () => {
  const { stdout } = await run('node', [script], { cwd: root })

  assert.match(stdout, /표기와 문체 검사 통과: 파일 \d+개/u)
})
