import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const VARIABLE_DEFINITION_PATTERN = /(--df-[a-z0-9-]+)\s*:/g
const VARIABLE_REFERENCE_PATTERN = /var\((--df-[a-z0-9-]+)\)/g

const css = await readFile(new URL('../tokens.css', import.meta.url), 'utf8')
const constants = await readFile(new URL('../src/tokens.stylex.ts', import.meta.url), 'utf8')

function block(selector) {
  const start = css.indexOf(`${selector} {`)
  assert.notEqual(start, -1, selector)
  const end = css.indexOf('\n}', start)

  return css.slice(start, end)
}

function definedNames(source) {
  return [...source.matchAll(VARIABLE_DEFINITION_PATTERN)].map((match) => match[1])
}

const darkNames = definedNames(block(':root'))

test('다크 기본값은 변수마다 한 번만 정의한다', () => {
  assert.equal(new Set(darkNames).size, darkNames.length)
})

test('라이트 값과 reduced-motion은 다크 기본값에 있는 변수만 바꾼다', () => {
  const overrides = [
    ...definedNames(block(":root[data-theme='light']")),
    ...definedNames(block('@media (prefers-reduced-motion: reduce)'))
  ]
  const unknown = overrides.filter((name) => {
    const isUnknown = !darkNames.includes(name)

    return isUnknown
  })
  assert.deepEqual(unknown, [])
})

test('reduced-motion에서 전환 시간을 모두 0으로 둔다', () => {
  const durations = darkNames.filter((name) => {
    const isDuration = name.startsWith('--df-dur-')

    return isDuration
  })
  const hasDurations = durations.length > 0
  assert.ok(hasDurations)
  const reduced = block('@media (prefers-reduced-motion: reduce)')
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
