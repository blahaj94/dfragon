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

  it('동일 샘플 참조도 각각 채점하고 code point 문자 합계로 CER를 가중 집계한다', () => {
    const repeated = Object.freeze(sample('repeated', '😀나'))
    const samples = Object.freeze([
      repeated,
      Object.freeze(sample('short', '가')),
      Object.freeze(sample('empty', '')),
      repeated
    ])
    const results = Object.freeze({
      repeated: Object.freeze(success('나')),
      short: Object.freeze(success('')),
      empty: Object.freeze(success('😀')),
      outside: Object.freeze({ status: 'failed' as const })
    })

    const summary = summarizeDeveloperEvaluation(samples, results)

    expect(summary).toEqual({
      scored: 4,
      matched: 0,
      failed: 0,
      completed: 4,
      accuracy: 0,
      characterErrorRate: 4 / 5
    })
    expect(samples[0]).toBe(repeated)
    expect(samples[3]).toBe(repeated)
  })

  it('샘플별 조회·채점 순서와 실패·미평가·미작성의 단락 평가를 유지한다', () => {
    const reads: string[] = []
    const labeled = sample('labeled', '가')
    const failed = sample('failed', '나')
    const missing = sample('missing', '다')
    const unlabeled = sample('unlabeled', null)
    Object.defineProperty(labeled, 'text', {
      get: () => {
        reads.push('label')

        return '가'
      }
    })
    for (const skipped of [failed, missing]) {
      Object.defineProperty(skipped, 'text', {
        get: () => {
          throw new Error('실패·미평가 라벨을 읽으면 안 된다')
        }
      })
    }
    Object.defineProperty(unlabeled, 'text', {
      get: () => {
        reads.push('unlabeled label')

        return null
      }
    })
    const labeledResult = success('가')
    Object.defineProperty(labeledResult, 'text', {
      get: () => {
        reads.push('prediction')

        return '가'
      }
    })
    const unlabeledResult = success('아무개')
    Object.defineProperty(unlabeledResult, 'text', {
      get: () => {
        throw new Error('미작성 정답의 원문을 읽으면 안 된다')
      }
    })
    const results = new Proxy<Record<string, DeveloperEvaluation>>(
      { labeled: labeledResult, failed: { status: 'failed' }, unlabeled: unlabeledResult },
      {
        get: (target, id, receiver) => {
          reads.push(String(id))

          return Reflect.get(target, id, receiver)
        }
      }
    )

    const summary = summarizeDeveloperEvaluation([labeled, failed, missing, unlabeled], results)

    expect(summary).toEqual({
      scored: 1,
      matched: 1,
      failed: 1,
      completed: 2,
      accuracy: 1,
      characterErrorRate: 0
    })
    expect(reads).toEqual([
      'labeled',
      'label',
      'label',
      'prediction',
      'label',
      'prediction',
      'label',
      'failed',
      'missing',
      'unlabeled',
      'unlabeled label'
    ])
  })

  it('결과 조회 중 추가된 샘플도 기존 순회와 같이 평가한다', () => {
    const samples = [sample('first', '가')]
    const firstResult = success('가')
    const results = {
      get first() {
        samples.push(sample('later', '나'))

        return firstResult
      },
      later: success('나')
    }

    const summary = summarizeDeveloperEvaluation(samples, results)

    expect(summary).toEqual({
      scored: 2,
      matched: 2,
      failed: 0,
      completed: 2,
      accuracy: 1,
      characterErrorRate: 0
    })
  })
})

describe('제품 전처리', () => {
  it('제품과 평가가 같은 반전 회색조 변환을 사용한다', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 128, 0, 0, 0, 255, 100, 150, 200, 255])
    invertNicknamePixels(data)
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 112, 112, 112, 255])
  })
})
