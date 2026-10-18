import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as typo from '@dfragon/ui/typo'

const WHITESPACE_PATTERN = /\s+/g

test('React 전용 package export를 ESM으로 가져와 native element로 렌더링한다', () => {
  assert.deepEqual(Object.keys(typo).sort(), ['Typo', 'typographyVariants'])
  const markup = renderToStaticMarkup(
    createElement(typo.Typo.txtM, { as: 'a', href: '/example' }, '공개 ESM 텍스트')
  )
  assert.match(markup, /<a\b[^>]*\bhref="\/example"/)
  assert.match(markup, />공개 ESM 텍스트<\/a>$/)
})

test('소비자 compiler가 library의 StyleX 선언을 산출 CSS의 atomic class로 만든다', async () => {
  const stylesheet = await readFile(
    new URL('../node_modules/.tmp/build-consumer/consumer.css', import.meta.url),
    'utf8'
  )
  const rules = stylesheet.replace(WHITESPACE_PATTERN, '')
  for (const declaration of [
    // dist의 공용 Component 선언이 tokens.stylex.js 상수를 var(--df-*)로 풀어 쓴다.
    'height:var(--df-size-control-sm)',
    'border-top-color:var(--df-signal)',
    'font-family:var(--df-font-num)',
    'outline-color:var(--df-signal)',
    // dist의 shapes가 별도 tokens.stylex.js의 상수를, 소비자 source가 package export의 상수를 쓴다.
    'clip-path:polygon(00,calc(100%-var(--df-cut))0,100%var(--df-cut),100%100%,0100%)',
    'background-color:var(--df-signal)'
  ]) {
    const atomicRule = new RegExp(
      `\\.x[a-z0-9]+(?::not\\(#\\\\#\\))*\\{${RegExp.escape(declaration)};?\\}`
    )
    assert.match(rules, atomicRule, declaration)
  }
})
