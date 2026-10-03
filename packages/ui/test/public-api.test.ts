import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ContentStack, ExampleSection, SupportingText } from '../src/index'

it('공개 composition을 조합하면 section 제목과 본문 안의 native 링크가 연결된다', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(
    createElement(
      ContentStack,
      null,
      createElement(
        ExampleSection,
        { title: '사용 안내' },
        createElement(
          SupportingText,
          null,
          '자세한 설명은 ',
          createElement('a', { href: '/help' }, '도움말'),
          '을 확인하세요.'
        )
      )
    )
  )
  const section = container.querySelector('section')!
  const heading = section.querySelector('h2')!
  const paragraph = section.querySelector('p')!
  const link = paragraph.querySelector('a')!

  expect(heading.textContent).toBe('사용 안내')
  expect(paragraph.textContent).toBe('자세한 설명은 도움말을 확인하세요.')
  expect(link.getAttribute('href')).toBe('/help')
})
