import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const verifyScript = fileURLToPath(new URL('../scripts/verify-build.mjs', import.meta.url))
const indexSource = `import { Dialog } from "@base-ui/react/dialog";\nimport * as stylex from "@stylexjs/stylex";\nimport React from "react";\nimport { jsx } from "react/jsx-runtime";\nimport { colors } from "./tokens.stylex.js";\nexport { Dialog, React, colors, jsx, stylex };\n`
const tokensSource = `import * as stylex from "@stylexjs/stylex";\nconst colors = stylex.defineConsts({ signal: "var(--df-signal)" });\nexport { colors };\n`
const libraryFiles = ['index.js', 'tokens.stylex.js', 'typo.js']
const tokensStyles = ':root{--df-brand-dragon:#e83830}'
const foundationStyles =
  'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}'
// 앱 전역 글꼴 CSS도 대체 글꼴로 같은 이름을 쓴다. 이 선언은 공용 font stack으로 세지 않는다.
const appFontStyles =
  "body{font-family:'Pretendard Variable',system-ui,'Apple SD Gothic Neo',sans-serif}"

// 검사하려는 bundle 경계만 작은 임시 산출물로 만든다.
async function createLibraryFixture(context) {
  const output = await mkdtemp(join(tmpdir(), 'dfragon-ui-build-'))
  context.after(() => rm(output, { recursive: true, force: true }))
  await mkdir(join(output, 'notices'))
  await writeFile(join(output, 'notices/bundle-modules.json'), '[]')
  await writeFile(join(output, 'notices/bundle-files.json'), JSON.stringify(libraryFiles))
  await writeFile(join(output, 'index.js'), indexSource)
  await writeFile(join(output, 'tokens.stylex.js'), tokensSource)
  await writeFile(
    join(output, 'typo.js'),
    `import { jsx } from 'react/jsx-runtime';\nexport const Typo = jsx;\n`
  )
  await writeFile(join(output, 'index.d.ts'), 'export declare const ActionButton: unknown;\n')
  await writeFile(join(output, 'typo.d.ts'), 'export declare const Typo: unknown;\n')
  await writeFile(
    join(output, 'tokens.stylex.d.ts'),
    'export declare const colors: { signal: string };\n'
  )

  return output
}

function inspect(output, mode = 'library') {
  const result = spawnSync(process.execPath, [verifyScript, mode, output], {
    encoding: 'utf8',
    timeout: 10_000
  })
  assert.ifError(result.error)

  return result
}

async function createConsumerFixture(context, styles) {
  const output = await createLibraryFixture(context)
  const graph = [
    { name: 'react', version: '19.3.0', modules: ['index.js'] },
    { name: 'react-dom', version: '19.3.0', modules: ['index.js'] },
    { name: '@base-ui/react', version: '1.9.0', modules: ['esm/index.js'] }
  ]
  await writeFile(join(output, 'notices/bundle-modules.json'), JSON.stringify(graph))
  await writeFile(join(output, 'notices/THIRD-PARTY.txt'), 'MIT License fixture\n')
  await writeFile(join(output, 'styles.css'), `${tokensStyles}${styles}`)

  return output
}

test('Base UI 사본 하나와 tokens.css, 공용 글꼴 한 번이 있는 소비자 빌드를 허용한다', async (context) => {
  const output = await createConsumerFixture(context, foundationStyles)
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

test('Base UI가 번들에 없어도 소비자 빌드를 허용한다', async (context) => {
  const output = await createConsumerFixture(context, foundationStyles)
  const graph = [
    { name: 'react', version: '19.3.0', modules: ['index.js'] },
    { name: 'react-dom', version: '19.3.0', modules: ['index.js'] }
  ]
  await writeFile(join(output, 'notices/bundle-modules.json'), JSON.stringify(graph))
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

test('Base UI 사본이 둘 번들되면 소비자 빌드 검사에 실패한다', async (context) => {
  const output = await createConsumerFixture(context, foundationStyles)
  const graph = JSON.parse(await readFile(join(output, 'notices/bundle-modules.json'), 'utf8'))
  graph.push({ name: '@base-ui/react', version: '1.8.0', modules: ['esm/index.js'] })
  await writeFile(join(output, 'notices/bundle-modules.json'), JSON.stringify(graph))
  const result = inspect(output, 'consumer')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Single bundled copy: @base-ui\/react/)
})

test('글꼴 변수와 앱 전역 글꼴 선언이 함께 있어도 공용 font stack은 한 번으로 센다', async (context) => {
  const output = await createConsumerFixture(
    context,
    `:root{--app-font-family:"Apple SD Gothic Neo",sans-serif}${foundationStyles}${appFontStyles}`
  )
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

test('minify가 따옴표를 지운 공용 font stack도 한 번으로 센다', async (context) => {
  const output = await createConsumerFixture(
    context,
    'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Apple SD Gothic Neo,sans-serif}'
  )
  const result = inspect(output, 'consumer')
  assert.equal(result.status, 0, result.stderr)
})

for (const { name, styles } of [
  {
    name: '글꼴 변수와 앱 전역 글꼴 선언만 있고 공용 font stack이 없는 경우',
    styles: `:root{--app-font-family:"Apple SD Gothic Neo",sans-serif}${appFontStyles}`
  },
  {
    name: '공용 font stack이 두 번 출력된 경우',
    styles: `${foundationStyles}${foundationStyles.replace('body', '.duplicate')}`
  }
]) {
  test(`${name} 소비자 빌드 검사에 실패한다`, async (context) => {
    const output = await createConsumerFixture(context, styles)
    const result = inspect(output, 'consumer')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Shared foundation font stack once/)
  })
}

for (const { name, styles } of [
  { name: 'tokens.css를 import하지 않은 경우', styles: foundationStyles },
  {
    name: 'tokens.css가 두 번 출력된 경우',
    styles: `${tokensStyles}${tokensStyles}${foundationStyles}`
  }
]) {
  test(`${name} 소비자 빌드 검사에 실패한다`, async (context) => {
    const output = await createConsumerFixture(context, '')
    // fixture의 기본 tokens.css 한 번을 덮어써 import 횟수만 바꾼다.
    await writeFile(join(output, 'styles.css'), styles)
    const result = inspect(output, 'consumer')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Consumer must import tokens\.css once/)
  })
}

test('공개 ESM, 선언 파일과 React 전용 Typo 산출물을 허용한다', async (context) => {
  const output = await createLibraryFixture(context)
  const result = inspect(output)
  assert.equal(result.status, 0, result.stderr)
})

test('Typo가 순수 React chunk를 통해 구현을 재수출해도 허용한다', async (context) => {
  const output = await createLibraryFixture(context)
  await writeFile(join(output, 'typo.js'), `export { Typo } from './react-helper.js';\n`)
  await writeFile(
    join(output, 'react-helper.js'),
    `import { createElement } from 'react';\nexport const Typo = createElement;\n`
  )
  await writeFile(
    join(output, 'notices/bundle-files.json'),
    JSON.stringify([...libraryFiles, 'react-helper.js'])
  )
  const result = inspect(output)
  assert.equal(result.status, 0, result.stderr)
})

test('tokens.stylex.d.ts가 없으면 실패한다', async (context) => {
  const output = await createLibraryFixture(context)
  await rm(join(output, 'tokens.stylex.d.ts'))
  const result = inspect(output)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Token declaration: tokens\.stylex\.d\.ts/)
})

test('생성 JS 목록에 tokens.stylex.js가 없으면 실패한다', async (context) => {
  const output = await createLibraryFixture(context)
  await writeFile(join(output, 'notices/bundle-files.json'), '["index.js","typo.js"]')
  const result = inspect(output)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Shared tokens stay in tokens\.stylex\.js/)
})

for (const file of ['index.js', 'index.d.ts', 'typo.js', 'typo.d.ts']) {
  test(`공개 산출물 ${file}이 누락되면 실패한다`, async (context) => {
    const output = await createLibraryFixture(context)
    await rm(join(output, file))
    // 목록에서 함께 사라져도 package export에 필요한 파일 누락을 잡아야 한다.
    if (file.endsWith('.js')) {
      const remaining = libraryFiles.filter((entry) => entry !== file)
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
    name: 'Typo가 Base UI runtime을 가져오는 경우',
    file: 'typo.js',
    source: `export { Field } from '@base-ui/react/field';\n`,
    failure: /React-only Typo entry/
  },
  {
    name: 'Typo가 다른 library chunk를 통해 공용 runtime을 가져오는 경우',
    file: 'typo.js',
    source: `export { Typo } from './index.js';\n`,
    failure: /React-only Typo entry/
  },
  {
    name: 'Typo가 StyleX runtime을 가져오는 경우',
    file: 'typo.js',
    source: `import * as stylex from '@stylexjs/stylex';\nexport const Typo = stylex.props;\n`,
    failure: /React-only Typo entry/
  },
  {
    name: 'library JS가 StyleX 주입 runtime을 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import '@stylexjs/stylex/lib/stylex-inject';\n`,
    failure: /Library must import only @stylexjs\/stylex/
  },
  {
    name: '토큰 상수가 다른 이름으로 export된 경우',
    file: 'tokens.stylex.js',
    source: `import * as stylex from "@stylexjs/stylex";\nconst t = stylex.defineConsts({ signal: "var(--df-signal)" });\nexport { t as colors };\n`,
    failure: /Token constants keep the same export name: t/
  },
  {
    name: 'tokens.stylex.js에 토큰 상수가 없는 경우',
    file: 'tokens.stylex.js',
    source: `export const colors = { signal: "var(--df-signal)" };\n`,
    failure: /Token constants: tokens\.stylex\.js/
  },
  {
    name: '토큰 상수가 index.js에 합쳐진 경우',
    file: 'index.js',
    source: `import * as stylex from "@stylexjs/stylex";\nexport const colors = stylex.defineConsts({ signal: "var(--df-signal)" });\n`,
    failure: /defineConsts only in tokens\.stylex\.js: index\.js/
  },
  {
    name: 'library JS가 소비자 소유 CSS를 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import '@dfragon/ui/tokens.css';\n`,
    failure: /Library must not import CSS/
  },
  {
    name: 'library JS가 SEED runtime을 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import { ActionButton } from '@seed-design/react';\nexport { ActionButton };\n`,
    failure: /Library must not import SEED/
  },
  {
    name: 'library JS가 SEED 아이콘을 가져오는 경우',
    file: 'index.js',
    source: `${indexSource}import '@karrotmarket/react-monochrome-icon';\n`,
    failure: /Library must not import SEED/
  },
  {
    name: 'index.js가 Base UI를 external로 가져오지 않는 경우',
    file: 'index.js',
    source: indexSource
      .replace('import { Dialog } from "@base-ui/react/dialog";\n', '')
      .replace('Dialog, ', ''),
    failure: /External import: @base-ui\/react/
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
