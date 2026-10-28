import assert from 'node:assert/strict'
import process from 'node:process'

const nativeFetch = fetch
globalThis.fetch = (input, options) => {
  const url = new URL(input)
  assert.equal(url.origin, 'https://api.neople.co.kr', 'unexpected outbound request in search test')

  return nativeFetch(
    `${process.env.DFRAGON_TEST_NEOPLE_ORIGIN}${url.pathname}${url.search}`,
    options
  )
}
