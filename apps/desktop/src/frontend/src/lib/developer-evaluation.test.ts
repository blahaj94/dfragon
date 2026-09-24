import { describe, expect, it } from 'vitest'
import {
  characterErrors,
  summarizeDeveloperEvaluation,
  type DeveloperEvaluation
} from './developer-evaluation'
import { invertNicknamePixels } from './nickname-pixels'
import type { DeveloperSample } from '../../../preload/common/types/developer'

const sample = (id: string, text: string | null): DeveloperSample => ({
  id,
  text,
  createdAt: '2026-09-24T00:00:00.000Z',
  width: 100,
  height: 20,
  excluded: false,
  source: null
})
const success = (text: string): Extract<DeveloperEvaluation, { status: 'success' }> => ({
  status: 'success' as const,
  text,
  confidence: 99,
  milliseconds: 10
})

describe('개발자 모델 채점', () => {
  it('한글·보조 평면 문자를 code point로 세고 삽입·삭제·대체를 계산한다', () => {
    expect(characterErrors('가나다', '가라')).toBe(2)
    expect(characterErrors('😀나', '나')).toBe(1)
    expect(characterErrors('', '가')).toBe(1)
  })
  it('미작성·실패·미평가를 정답률 분모에 섞지 않으며 빈 정답은 채점한다', () => {
    const summary = summarizeDeveloperEvaluation(
      [
        sample('one', '가나'),
        sample('two', ''),
        sample('three', null),
        sample('four', '다'),
        sample('five', '라')
      ],
      {
        one: success('가다'),
        two: success(''),
        three: success('아무개'),
        four: { status: 'failed' }
      }
    )
    expect(summary).toEqual({
      scored: 2,
      matched: 1,
      failed: 1,
      completed: 3,
      accuracy: 0.5,
      characterErrorRate: 0.5
    })
  })
  it('원문을 임의로 정리하지 않으며 정답 문자 수가 0이면 CER를 표시하지 않는다', () => {
    expect(
      summarizeDeveloperEvaluation([sample('one', '')], { one: success('가') }).characterErrorRate
    ).toBeNull()
    expect(
      summarizeDeveloperEvaluation([sample('one', 'Ab')], { one: success('ab ') }).accuracy
    ).toBe(0)
    expect(summarizeDeveloperEvaluation([], {}).accuracy).toBeNull()
  })
})

describe('제품 전처리', () => {
  it('제품과 평가가 같은 반전 회색조 변환을 사용한다', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 128, 0, 0, 0, 255, 100, 150, 200, 255])
    invertNicknamePixels(data)
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 112, 112, 112, 255])
  })
})
