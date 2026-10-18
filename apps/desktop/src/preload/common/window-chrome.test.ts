import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { WINDOW_CHROME_COLORS } from './window-chrome'

const tokensCss = readFileSync(
  new URL('../../../../../packages/ui/tokens.css', import.meta.url),
  'utf8'
)

// tokens.css는 :root(다크) 블록 다음에 라이트 블록에서 같은 변수를 다시 정의한다.
function readTokenValues(name: string): { dark: string; light: string } {
  const values = [...tokensCss.matchAll(new RegExp(`--df-${name}:\\s*(#[0-9a-f]{6})\\b`, 'g'))].map(
    (match) => match[1]
  )
  expect(values).toHaveLength(2)

  return { dark: values[0], light: values[1] }
}

it('창 버튼 띠의 색은 tokens.css의 상단 바 면과 기본 글자 색을 따른다', () => {
  const bar = readTokenValues('bg-bar')
  const text = readTokenValues('fg-default')

  expect(WINDOW_CHROME_COLORS).toEqual({
    dark: { color: bar.dark, symbolColor: text.dark },
    light: { color: bar.light, symbolColor: text.light }
  })
})
