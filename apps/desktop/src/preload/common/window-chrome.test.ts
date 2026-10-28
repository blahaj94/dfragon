import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { WINDOW_CHROME_COLORS } from './window-chrome'

const tokensCss = readFileSync(
  new URL('../../../../../packages/ui/tokens.css', import.meta.url),
  'utf8'
)

// tokens.css는 :root(다크) 블록에서 변수를 처음 정의한다.
function readDarkTokenValue(name: string): string {
  const match = tokensCss.match(new RegExp(`--df-${name}:\\s*(#[0-9a-f]{6})\\b`))
  expect(match).not.toBeNull()

  return match![1]
}

it('창 버튼 띠의 색은 tokens.css의 다크 상단 바 면과 기본 글자 색을 따른다', () => {
  expect(WINDOW_CHROME_COLORS).toEqual({
    color: readDarkTokenValue('bg-bar'),
    symbolColor: readDarkTokenValue('fg-default')
  })
})
