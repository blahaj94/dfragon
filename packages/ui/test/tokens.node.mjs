import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const VARIABLE_DEFINITION_PATTERN = /(--df-[a-z0-9-]+)\s*:/g
const VARIABLE_REFERENCE_PATTERN = /var\((--df-[a-z0-9-]+)\)/g

const css = await readFile(new URL('../tokens.css', import.meta.url), 'utf8')
const constants = await readFile(new URL('../src/tokens.stylex.ts', import.meta.url), 'utf8')

// 규칙의 첫 선택자부터 닫는 괄호까지 읽는다. 시작 표시는 줄 맨 앞에서 찾는다.
function block(start) {
  const index = css.indexOf(`\n${start}`)
  assert.notEqual(index, -1, start)
  const end = css.indexOf('\n}', index)

  return css.slice(index + 1, end)
}

function definedNames(source) {
  return [...source.matchAll(VARIABLE_DEFINITION_PATTERN)].map((match) => match[1])
}

const REDUCED_MOTION_RULE_START = '@media (prefers-reduced-motion: reduce) {'
const darkNames = definedNames(block(':root {'))

test('다크 기본값은 변수마다 한 번만 정의한다', () => {
  assert.equal(new Set(darkNames).size, darkNames.length)
})

test('reduced-motion은 다크 기본값에 있는 변수만 바꾼다', () => {
  const overrides = definedNames(block(REDUCED_MOTION_RULE_START))
  const unknown = overrides.filter((name) => {
    const isUnknown = !darkNames.includes(name)

    return isUnknown
  })
  assert.deepEqual(unknown, [])
})

test('color-scheme은 다크로 정하고 라이트 테마 규칙은 두지 않는다', () => {
  assert.match(block(':root {'), /^\s*color-scheme:\s*dark;$/m)
  assert.doesNotMatch(css, /data-theme/)
})

test('reduced-motion에서 전환 시간을 모두 0으로 둔다', () => {
  const durations = darkNames.filter((name) => {
    const isDuration = name.startsWith('--df-dur-')

    return isDuration
  })
  const hasDurations = durations.length > 0
  assert.ok(hasDurations)
  const reduced = block(REDUCED_MOTION_RULE_START)
  for (const name of durations) {
    assert.match(reduced, new RegExp(`${name}:\\s*0ms;`), name)
  }
})

test('StyleX 토큰 상수는 tokens.css에 정의된 변수만 참조한다', () => {
  const references = [...constants.matchAll(VARIABLE_REFERENCE_PATTERN)].map((match) => match[1])
  const hasReferences = references.length > 0
  assert.ok(hasReferences)
  const undefinedNames = references.filter((name) => {
    const isUndefined = !darkNames.includes(name)

    return isUndefined
  })
  assert.deepEqual(undefinedNames, [])
})
