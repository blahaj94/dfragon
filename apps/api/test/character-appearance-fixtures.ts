import type { SearchClock } from '../src/characters/types.js'

export const identity = { serverId: 'siroco', characterId: 'synthetic-character' }
export const appearance = {
  ...identity,
  characterName: '합성캐릭터',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  avatar: [
    {
      slotId: 'HEADGEAR',
      itemId: 'synthetic-hat',
      itemName: ' 합성 모자 ',
      clone: { itemId: 'synthetic-clone', itemName: '합성 외형' }
    },
    {
      slotId: 'FUTURE_SLOT',
      itemId: 'synthetic-new',
      itemName: '새 슬롯',
      clone: { itemId: null, itemName: null }
    }
  ]
}

export function payload() {
  return {
    ...appearance,
    level: 115,
    adventureName: '비공개 모험단 필드',
    equipment: ['제외할 장비'],
    avatar: [
      {
        ...appearance.avatar[0],
        clone: { ...appearance.avatar[0]!.clone, private: true },
        optionAbility: '제외할 옵션',
        emblems: ['제외할 엠블렘']
      },
      { slotId: 'FUTURE_SLOT', itemId: 'synthetic-new', itemName: '새 슬롯' }
    ]
  }
}

export class AppearanceClock implements SearchClock {
  value = 0
  private timers = new Map<object, { callback: () => void; at: number }>()

  now(): number {
    return this.value
  }
  setTimer(callback: () => void, delay: number): object {
    const id = {}
    this.timers.set(id, { callback, at: this.value + delay })

    return id
  }
  clearTimer(timer: unknown): void {
    this.timers.delete(timer as object)
  }
  get timerCount(): number {
    return this.timers.size
  }
  advance(value: number): void {
    this.value = value
    for (const [id, timer] of this.timers) {
      if (timer.at <= value) {
        this.timers.delete(id)
        timer.callback()
      }
    }
  }
}

export function completionSignal(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}
