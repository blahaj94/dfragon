import { describe, expect, it } from 'vitest'
import {
  characterErrors,
  summarizeDeveloperEvaluation,
  type DeveloperEvaluation
} from './developer-evaluation'
import { binarizeNicknamePixels } from './nickname-pixels'
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

  it('서로 다른 정답 길이와 빈 정답의 오류를 전체 code point 문자 수로 가중 집계한다', () => {
    const samples = Object.freeze([
      Object.freeze(sample('long', '😀가나')),
      Object.freeze(sample('short', '다')),
      Object.freeze(sample('empty', ''))
    ])
    const results = Object.freeze({
      long: Object.freeze(success('😀가라')),
      short: Object.freeze(success('')),
      empty: Object.freeze(success('😀')),
      outside: Object.freeze({ status: 'failed' as const })
    })

    const summary = summarizeDeveloperEvaluation(samples, results)

    // 대체 1개 + 삭제 1개 + 빈 정답의 삽입 1개, 정답 문자는 3 + 1 + 0개다.
    expect(summary).toEqual({
      scored: 3,
      matched: 0,
      failed: 0,
      completed: 3,
      accuracy: 0,
      characterErrorRate: 3 / 4
    })
    expect(samples.map(({ text }) => text)).toEqual(['😀가나', '다', ''])
    expect(results.long.text).toBe('😀가라')
  })

  it('공백·대소문자 차이를 원문 오류로 세며 미작성·실패·미평가를 점수 분모에서 제외한다', () => {
    const samples = [
      sample('case-and-space', 'Ab '),
      sample('korean', '가나'),
      sample('unlabeled', null),
      sample('failed', '다'),
      sample('unevaluated', '라')
    ]
    const results = {
      'case-and-space': success('ab'),
      korean: success('가다'),
      unlabeled: success('아무개'),
      failed: { status: 'failed' as const },
      outside: success('참조하지 않는 결과')
    }

    const summary = summarizeDeveloperEvaluation(samples, results)

    // A→a 대체와 끝 공백 삭제가 2개, 나→다 대체가 1개이며 정답 문자는 3 + 2개다.
    expect(summary).toEqual({
      scored: 2,
      matched: 0,
      failed: 1,
      completed: 3,
      accuracy: 0,
      characterErrorRate: 3 / 5
    })
    expect(samples.map(({ text }) => text)).toEqual(['Ab ', '가나', null, '다', '라'])
    expect(results['case-and-space'].text).toBe('ab')
  })

  it('같아 보이는 완성형과 조합형 한글도 저장한 code point 원문대로 비교한다', () => {
    const expected = '가'
    const actual = '\u1100\u1161'

    expect(characterErrors(expected, actual)).toBe(2)
    expect(
      summarizeDeveloperEvaluation([sample('normalization', expected)], {
        normalization: success(actual)
      })
    ).toEqual({
      scored: 1,
      matched: 0,
      failed: 0,
      completed: 1,
      accuracy: 0,
      characterErrorRate: 2
    })
  })
})

describe('제품 전처리', () => {
  it('제품과 평가가 같은 Otsu 반전 이진화를 사용한다', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 128, 0, 0, 0, 255, 100, 150, 200, 255])
    binarizeNicknamePixels(data)
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255])
  })
})
