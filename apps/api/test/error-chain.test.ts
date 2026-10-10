import assert from 'node:assert/strict'
import test from 'node:test'
import { describeErrorChain, withSanitizedCause } from '../src/error-chain.js'

// 정제 결과에 나오면 안 되는 값이다. 모두 합성 값이며 실제 credential이 아니다.
const secret = 'fake-secret-detail-3e1d'

test('식별자 형식이 아닌 오류 이름과 code는 남기지 않는다', () => {
  const error = Object.assign(new Error(secret), { code: `${secret} with spaces` })
  error.name = `Name ${secret}`
  const numericCode = Object.assign(new Error(secret), { code: 23505 })

  const [entry] = describeErrorChain(error)
  const [numeric] = describeErrorChain(numericCode)

  assert.equal(entry!.name, '<unnamed>')
  assert.equal(entry!.code, undefined)
  assert.equal(numeric!.code, undefined)
  assert.equal(JSON.stringify([entry, numeric]).includes(secret), false)
})

test('원인은 다섯 단계까지만 따라가고 순환하는 cause에서도 끝난다', () => {
  const looping = new Error('looping')
  looping.cause = looping
  let deep: Error = new Error('root')
  for (let depth = 0; depth < 7; depth += 1) {
    deep = new Error(`depth ${depth}`, { cause: deep })
  }

  assert.equal(describeErrorChain(looping).length, 5)
  assert.equal(describeErrorChain(deep).length, 5)
})

test('withSanitizedCause는 원래 오류 object를 cause로 붙이지 않고 정제한 chain만 이어 준다', () => {
  const original = Object.assign(new Error(secret), { code: 'ECONNRESET', query: secret })
  const failure = withSanitizedCause(new Error('정제한 응답 오류'), original)

  assert.equal(failure.cause, undefined)
  const chain = describeErrorChain(failure)
  assert.deepEqual(
    chain.map(({ name, code }) => ({ name, code })),
    [
      { name: 'Error', code: undefined },
      { name: 'Error', code: 'ECONNRESET' }
    ]
  )
  assert.equal(JSON.stringify(chain).includes(secret), false)
})

test('오류마다 stack frame은 다섯 줄, 한 줄은 300자까지만 남긴다', () => {
  const error = new Error('frame 한도')
  const longFrame = `    at long (${'a'.repeat(400)}.js:1:1)`
  const frames = Array.from({ length: 7 }, (_, index) => `    at frame${index} (file.js:1:1)`)
  error.stack = ['Error: frame 한도', longFrame, ...frames].join('\n')

  const [entry] = describeErrorChain(error)

  assert.equal(entry!.frames!.length, 5)
  assert.equal(entry!.frames![0]!.length, 300)
  assert.equal(entry!.frames![4], 'frame3 (file.js:1:1)')
})

test('정제한 chain을 이은 failure를 다시 감싸도 오류는 다섯 개까지만 남긴다', () => {
  let failure = new Error('root')
  for (let depth = 0; depth < 6; depth += 1) {
    failure = withSanitizedCause(new Error(`wrapper ${depth}`), failure)
  }

  assert.equal(describeErrorChain(failure).length, 5)
})
