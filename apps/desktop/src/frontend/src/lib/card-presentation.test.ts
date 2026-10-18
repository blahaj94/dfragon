import { expect, it } from 'vitest'
import { getCharacterCardFrameState } from './card-presentation'
import type { SlotState } from '../types/cards'

it('검색 상태를 카드의 꺾쇠 상태로 바꾸고 이름 수정을 가장 앞에 둔다', () => {
  const states: SlotState[] = [
    'success',
    'pending',
    'failure',
    'empty',
    'idle',
    'waiting-portrait',
    'waiting-policy'
  ]

  expect(states.map((state) => getCharacterCardFrameState({ state, editing: false }))).toEqual([
    'default',
    'default',
    'failure',
    'failure',
    'waiting',
    'waiting',
    'waiting'
  ])
  expect(states.map((state) => getCharacterCardFrameState({ state, editing: true }))).toEqual(
    states.map(() => 'selected')
  )
})
