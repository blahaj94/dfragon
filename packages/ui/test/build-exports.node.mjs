import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as typo from '@dfragon/ui/typo'

test('React 전용 package export를 ESM으로 가져와 native element로 렌더링한다', () => {
  assert.deepEqual(Object.keys(typo).sort(), ['Typo', 'typographyVariants'])
  const markup = renderToStaticMarkup(
    createElement(typo.Typo.txtM, { as: 'a', href: '/example' }, '공개 ESM 텍스트')
  )
  assert.match(markup, /<a\b[^>]*\bhref="\/example"/)
  assert.match(markup, />공개 ESM 텍스트<\/a>$/)
})
