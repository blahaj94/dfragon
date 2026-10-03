import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 실제 test 파일 경로에는 이 probe를 복사해 workflow 테스트의 재귀 실행을 막는다.
const probe = await readFile(new URL('../code-quality-suite.mjs', import.meta.url), 'utf8')

export async function createToolingFixture(t, manifest, suites, failedSuite) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-code-quality-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const trace = join(directory, 'trace')
  await mkdir(join(directory, 'scripts/test'), { recursive: true })
  await mkdir(trace)
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      packageManager: manifest.packageManager,
      scripts: manifest.scripts
    })
  )

  for (const suite of suites) {
    await writeFile(join(directory, 'scripts/test', suite), probe)
  }

  const failed = failedSuite ?? ''
  const env = { ...process.env, ROOT_TOOLING_TRACE: trace, ROOT_TOOLING_FAIL: failed }
  delete env.NODE_TEST_CONTEXT

  return { directory, trace, env }
}
