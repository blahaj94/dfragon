import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const uiRoot = fileURLToPath(new URL('../', import.meta.url))
const verifyScript = fileURLToPath(new URL('../scripts/verify-build.mjs', import.meta.url))
const notice = '/*! DFRAGON modified SEED source: test fixture */\n'
const indexSource = `${notice}import { ActionButton } from "@seed-design/react";\nimport React from "react";\nimport { jsx } from "react/jsx-runtime";\nexport { ActionButton, React, jsx };\n`

// 실제 고지·provenance는 보존하고 검사하려는 bundle 경계만 작은 임시 산출물로 만든다.
async function createLibraryFixture(context) {
  const output = await mkdtemp(join(tmpdir(), 'dfragon-ui-build-'))
  context.after(() => rm(output, { recursive: true, force: true }))
  await mkdir(join(output, 'notices'))
  await cp(join(uiRoot, '../licenses/notices/ui'), join(output, 'notices'), { recursive: true })
  await cp(join(uiRoot, 'seed-provenance.json'), join(output, 'notices/seed-provenance.json'))
  await writeFile(join(output, 'notices/bundle-modules.json'), '[]')
  await writeFile(join(output, 'notices/bundle-files.json'), '["index.js","typo.js"]')
  await writeFile(
    join(output, 'notices/DFRAGON-MODIFICATIONS.txt'),
    'DialogTrigger declaration; Layout header/footer/children.\n'
  )
  await writeFile(join(output, 'index.js'), indexSource)
  await writeFile(
    join(output, 'typo.js'),
    `${notice}import { jsx } from 'react/jsx-runtime';\nexport const Typo = jsx;\n`
  )
  await writeFile(join(output, 'index.d.ts'), 'export declare const ActionButton: unknown;\n')
  await writeFile(join(output, 'typo.d.ts'), 'export declare const Typo: unknown;\n')

  return output
}

function inspect(output) {
  const result = spawnSync(process.execPath, [verifyScript, 'library', output], {
    encoding: 'utf8',
    timeout: 10_000
  })
  assert.ifError(result.error)

  return result
}

test('공개 ESM·선언 파일과 React 전용 Typo 산출물을 허용한다', async (context) => {
  const output = await createLibraryFixture(context)
  const result = inspect(output)
  assert.equal(result.status, 0, result.stderr)
})

test('Typo가 순수 React chunk를 통해 구현을 재수출해도 허용한다', async (context) => {
  const output = await createLibraryFixture(context)
  await writeFile(join(output, 'typo.js'), `${notice}export { Typo } from './react-helper.js';\n`)
  await writeFile(
    join(output, 'react-helper.js'),
    `${notice}import { createElement } from 'react';\nexport const Typo = createElement;\n`
  )
  await writeFile(
    join(output, 'notices/bundle-files.json'),
    '["index.js","typo.js","react-helper.js"]'
  )
  const result = inspect(output)
  assert.equal(result.status, 0, result.stderr)
})

for (const file of ['index.js', 'index.d.ts', 'typo.js', 'typo.d.ts']) {
  test(`공개 산출물 ${file}이 누락되면 실패한다`, async (context) => {
    const output = await createLibraryFixture(context)
    await rm(join(output, file))
    // 목록에서 함께 사라져도 package export에 필요한 파일 누락을 잡아야 한다.
    if (file.endsWith('.js')) {
      const remaining = ['index.js', 'typo.js'].filter((entry) => entry !== file)
      await writeFile(join(output, 'notices/bundle-files.json'), JSON.stringify(remaining))
    }
    const result = inspect(output)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Public export artifact/)
    assert.match(result.stderr, new RegExp(file.replaceAll('.', '\\.')))
  })
}

for (const { name, file, source, failure } of [
  {
    name: '선언에 pnpm 내부 경로가 남은 경우',
    file: 'typo.d.ts',
    source: 'export { Typo } from "../node_modules/.pnpm/react/index";\n',
    failure: /Portable browser declaration: typo\.d\.ts/
  },
  {
    name: '선언이 node: 접두사 없이 Node builtin을 가져오는 경우',
    file: 'typo.d.ts',
    source: 'export type { ReadStream } from "fs";\n',
    failure: /Portable browser declaration: typo\.d\.ts/
  },
  {
    name: '선언이 import type 표현식으로 Node builtin을 참조하는 경우',
    file: 'typo.d.ts',
    source: 'export type NodeStream = import("fs").ReadStream;\n',
    failure: /Portable browser declaration: typo\.d\.ts/
  },
  {
    name: 'Typo가 SEED runtime을 가져오는 경우',
    file: 'typo.js',
    source: `${notice}export { Text } from '@seed-design/react';\n`,
    failure: /React-only Typo entry/
  },
  {
    name: 'Typo가 다른 library chunk를 통해 공용 runtime을 가져오는 경우',
    file: 'typo.js',
    source: `${notice}export { Typo } from './index.js';\n`,
    failure: /React-only Typo entry/
  },
  {
    name: 'library JS가 소비자 소유 CSS를 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import '@seed-design/css/base.css';\n`,
    failure: /Library must not import CSS/
  }
]) {
  test(`${name} 빌드 경계 검사에 실패한다`, async (context) => {
    const output = await createLibraryFixture(context)
    await writeFile(join(output, file), source)
    const result = inspect(output)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, failure)
  })
}
