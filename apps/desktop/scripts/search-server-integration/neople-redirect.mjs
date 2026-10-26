import assert from 'node:assert/strict'
import process from 'node:process'

// Test child의 --import에만 지정하며 제품 entry는 이 module을 import하지 않는다.
const nativeFetch = fetch
globalThis.fetch = (input, options) => {
  const url = new URL(input)
  assert.equal(url.origin, 'https://api.neople.co.kr', 'unexpected outbound request in search test')

  return nativeFetch(
    `${process.env.DFRAGON_TEST_NEOPLE_ORIGIN}${url.pathname}${url.search}`,
    options
  )
}
