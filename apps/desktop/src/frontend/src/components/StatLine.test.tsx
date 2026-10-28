// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StatLine } from './StatLine'
import { toScoreView } from '../lib/card-score'
import { bufferCard, dealerCard } from '../testing/fixtures/character-cards'
import { toneClassesOf } from '../testing/test-support/score-tone-class'
import type { CharacterCard } from '../types/cards'

// jsdom은 색을 계산하지 않으므로 같은 선언에서 나온 class를 값이 가졌는지로 확인한다.
const dim = stylex.create({
  missing: { color: colors.cardBorderStrong },
  vacant: { color: colors.cardBorder }
})

const hasClass = (element: Element, style: keyof typeof dim): boolean =>
  element.className.split(' ').includes(stylex.props(dim[style]).className!)

let root: Root
let container: HTMLElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function render({
  fame,
  card,
  vacant = false,
  tier
}: {
  fame: number | null
  card: CharacterCard | null
  vacant?: boolean
  tier?: 'top' | 'ranker'
}): Promise<void> {
  await act(async () =>
    root.render(<StatLine fame={fame} score={toScoreView(card)} vacant={vacant} tier={tier} />)
  )
}

function term(label: string): HTMLElement {
  return [...container.querySelectorAll('dt')].find((item) => item.textContent === label)!
}

const value = (label: string): HTMLElement => term(label).nextElementSibling as HTMLElement

const shown = (element: HTMLElement): string | undefined =>
  element.firstChild?.textContent ?? undefined

it('명성과 줄인 점수 라벨을 한 줄에 두고 사이에 세로선을 둔다', async () => {
  await render({ fame: 125850, card: dealerCard })
  expect([...container.querySelectorAll('dt')].map((item) => item.textContent)).toEqual([
    '명성',
    '장비'
  ])
  expect(shown(value('명성'))).toBe('125,850')
  expect(shown(value('장비'))).toBe('330,556')
  const divider = container.querySelector('[aria-hidden="true"]:empty')!
  expect(divider.previousElementSibling).toBe(value('명성').parentElement)
  expect(divider.nextElementSibling).toBe(value('장비').parentElement)

  await render({ fame: 100, card: bufferCard })
  expect(term('버프')).toBeDefined()
  expect(shown(value('버프'))).toBe('55,358')
})

it('0과 알 수 없음을 구분하고 값이 없으면 흐린 -를 둔다', async () => {
  await render({ fame: 0, card: { ...dealerCard, score: null } })
  expect(shown(value('명성'))).toBe('0')
  expect(value('장비').textContent).toBe('-')
  expect(hasClass(value('장비'), 'missing')).toBe(true)
  expect(hasClass(value('장비'), 'vacant')).toBe(false)

  await render({ fame: null, card: null, vacant: true })
  expect(value('명성').textContent).toBe('-')
  expect(hasClass(value('명성'), 'vacant')).toBe(true)
})

it('라벨과 값을 같은 색으로 칠한다. 명성은 기본색, 점수는 역할 색이다', async () => {
  await render({ fame: 1, card: dealerCard })
  expect(toneClassesOf(term('명성'))).toEqual([])
  expect(toneClassesOf(value('명성'))).toEqual([])
  expect(toneClassesOf(term('장비'))).toEqual(['dealer'])
  expect(toneClassesOf(value('장비'))).toEqual(['dealer'])

  await render({ fame: 1, card: bufferCard })
  expect(toneClassesOf(term('버프'))).toEqual(['buffer'])
  expect(toneClassesOf(value('버프'))).toEqual(['buffer'])
})

it('상위, 랭커 단계 카드는 라벨과 값 모두 단계 색으로 칠한다', async () => {
  await render({ fame: 1, card: dealerCard, tier: 'top' })
  for (const label of ['명성', '장비']) {
    expect(toneClassesOf(term(label)), label).toEqual(['top'])
    expect(toneClassesOf(value(label)), label).toEqual(['top'])
  }

  await render({ fame: 1, card: bufferCard, tier: 'ranker' })
  for (const label of ['명성', '버프']) {
    expect(toneClassesOf(term(label)), label).toEqual(['ranker'])
    expect(toneClassesOf(value(label)), label).toEqual(['ranker'])
  }
})

it('점수의 계산값 안내와 계산하지 못한 사유를 보조 기술에 전한다', async () => {
  await render({ fame: 1, card: dealerCard })
  expect(value('장비').textContent).toContain('DFragon 계산값')
  expect(value('장비').getAttribute('title')).toContain('DFragon 계산값')

  const skipped: CharacterCard = {
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind: 'resolution', message: 'ValueError: switching item has no candidate' },
      approximate: null,
      versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    }
  }
  await render({ fame: 1, card: skipped })
  expect(value('장비').textContent).toBe('-계산하지 못함, 아이템을 판별하지 못함')
  expect(container.textContent).not.toContain('ValueError')
})

it('근사값 점수는 ≈를 붙이고 근사값이라는 뜻을 전한다', async () => {
  const approximate: CharacterCard = {
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind: 'resolution', message: 'ValueError: switching item has no candidate' },
      approximate: {
        value: 321000,
        source: 'input_gate_diagnostic',
        warning: '근사값, 1% 밖일 가능성 높음: ValueError: switching item has no candidate'
      },
      versions: { package: 'dnfscore-native 0.3.1', rulesRev: 'rev14', bundleId: 'phase32-rev14b' }
    }
  }
  await render({ fame: 1, card: approximate })
  const description =
    '근사값, 아이템을 판별하지 못함. 입력값 차이를 무시하고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  expect(shown(value('장비'))).toBe('≈321,000')
  expect(value('장비').getAttribute('title')).toBe(description)
  expect(value('장비').textContent).toContain(description)
  expect(toneClassesOf(value('장비'))).toEqual(['dealer'])
})
