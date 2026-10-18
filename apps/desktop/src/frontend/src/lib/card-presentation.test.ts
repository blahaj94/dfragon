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

it('상위, 랭커 단계는 조회를 마친 카드에만 보이고 이름 수정과 실패가 단계보다 앞선다', () => {
  const states: SlotState[] = ['success', 'pending', 'failure', 'empty', 'idle', 'waiting-portrait']

  expect(
    states.map((state) => getCharacterCardFrameState({ state, editing: false, tier: 'ranker' }))
  ).toEqual(['ranker', 'default', 'failure', 'failure', 'waiting', 'waiting'])
  expect(getCharacterCardFrameState({ state: 'success', editing: false, tier: 'top' })).toBe('top')
  expect(getCharacterCardFrameState({ state: 'success', editing: true, tier: 'top' })).toBe(
    'selected'
  )
})
