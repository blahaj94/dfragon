import { expect, it } from 'vitest'
import { decodeCtc, decodeCtcCandidates } from './paddle-recognition'

/** 작은 입력의 모든 경로를 직접 열거한다. 제품의 beam이나 forward 점화식을 사용하지 않는다. */
function enumeratePaths(
  rows: readonly (readonly number[])[],
  characters: readonly string[]
): Map<string, number> {
  const probabilities = new Map<string, number>()
  function visit(path: readonly number[], probability: number): void {
    if (path.length === rows.length) {
      let nickname = ''
      for (let index = 0; index < path.length; index += 1) {
        if (path[index] !== 0 && path[index] !== path[index - 1]) {
          nickname += characters[path[index] - 1]
        }
      }
      probabilities.set(nickname, (probabilities.get(nickname) ?? 0) + probability)

      return
    }
    const row = rows[path.length]
    const sum = row.reduce((total, value) => total + value, 0)
    for (let token = 0; token < row.length; token += 1) {
      if (row[token] > 0) {
        visit([...path, token], (probability * row[token]) / sum)
      }
    }
  }
  visit([], 1)

  return probabilities
}

it('CTC 경로를 합산한 문자열 상위 5개를 반환하며 greedy와 다른 1위를 선택한다', () => {
  const data = new Float32Array([0.4, 0.35, 0.25, 0.4, 0.35, 0.25])
  expect(decodeCtcCandidates(data, 2, ['A', 'B'])).toEqual([
    { rank: 1, modelScore: expect.closeTo(40.25, 5), nickname: 'A' },
    { rank: 2, modelScore: expect.closeTo(26.25, 5), nickname: 'B' },
    { rank: 3, modelScore: expect.closeTo(16, 5), nickname: '' },
    { rank: 4, modelScore: expect.closeTo(8.75, 5), nickname: 'AB' },
    { rank: 5, modelScore: expect.closeTo(8.75, 5), nickname: 'BA' }
  ])
  expect(decodeCtc(data, 2, ['A', 'B'])).toBe('A')
})

it.each([
  [
    [0.1, 0.7, 0.2],
    [0.6, 0.1, 0.3],
    [0.3, 0.6, 0.1]
  ],
  [
    [0, 1, 0],
    [1, 0, 0],
    [0, 1, 0]
  ],
  [
    [0, 1, 0],
    [0, 1, 0],
    [0, 0, 1]
  ],
  [
    [0.2, 0.6, 0.2],
    [0.4, 0.3, 0.3],
    [0.1, 0.1, 0.8]
  ]
])('작은 확률 배열의 전체 경로 열거 결과와 순위, 확률이 일치한다: %j', (...rows) => {
  const data = new Float32Array(rows.flat())
  const roundedRows = rows.map((_, index) => [...data.subarray(index * 3, index * 3 + 3)])
  const oracle = enumeratePaths(roundedRows, ['가', '😀'])
  const expectedScores = [...oracle.values()].sort((left, right) => right - left).slice(0, 5)
  const candidates = decodeCtcCandidates(data, rows.length, ['가', '😀'])
  expect(candidates).toHaveLength(expectedScores.length)
  expect(new Set(candidates.map(({ nickname }) => nickname)).size).toBe(candidates.length)
  candidates.forEach(({ rank, nickname, modelScore }, index) => {
    expect(rank).toBe(index + 1)
    expect(modelScore / 100).toBeCloseTo(oracle.get(nickname)!, 10)
    expect(modelScore / 100).toBeCloseTo(expectedScores[index], 10)
  })
})

it('대소문자와 l/I 혼동 후보를 구분하고 다섯 후보의 확률을 100으로 재정규화하지 않는다', () => {
  const characters = [...new Set('lnBloomINbi')]
  const alternatives = [
    [
      ['l', 0.999725],
      ['I', 0.000275]
    ],
    [
      ['n', 0.99996235],
      ['N', 0.00003765]
    ],
    [
      ['B', 0.99994039],
      ['b', 0.00005961]
    ],
    [
      ['l', 0.99998755],
      ['i', 0.00001245]
    ],
    [['o', 1]],
    [['o', 1]],
    [['m', 1]]
  ] as const
  const rows: number[][] = []
  for (const alternativesForStep of alternatives) {
    const row = Array<number>(characters.length + 1).fill(0)
    for (const [character, probability] of alternativesForStep) {
      row[characters.indexOf(character) + 1] = probability
    }
    rows.push(row)
    const blank = Array<number>(characters.length + 1).fill(0)
    blank[0] = 1
    rows.push(blank)
  }
  const candidates = decodeCtcCandidates(new Float32Array(rows.flat()), rows.length, characters)
  expect(candidates.map(({ nickname }) => nickname)).toEqual([
    'lnBloom',
    'InBloom',
    'lnbloom',
    'lNBloom',
    'lnBioom'
  ])
  expect(candidates.reduce((sum, { modelScore }) => sum + modelScore, 0)).toBeLessThan(100)
  expect(candidates[0].modelScore).toBeGreaterThan(99.9)
})

it('문자 가지치기에서 빠진 정렬 경로도 최종 후보 확률에 포함한다', () => {
  const characters = [...'ABCDEFGHIJKLMNOPQ']
  const first = Array<number>(18).fill(0)
  first[0] = 0.01
  first[1] = 0.99
  const second = Array<number>(18).fill(0.099 / 16)
  second[0] = 0.9
  second[1] = 0.001
  const candidates = decodeCtcCandidates(new Float32Array([...first, ...second]), 2, characters)
  // P(A) = .99*.9 + .99*.001 + .01*.001. 마지막 경로는 top16에서 A가 탈락해도 합산한다.
  expect(candidates[0]).toEqual({ rank: 1, modelScore: expect.closeTo(89.2, 5), nickname: 'A' })
})

it('재채점으로 순위가 바뀌면 복구된 최종 점수 내림차순으로 반환한다', () => {
  const characters = [...'ABCDEFGHIJKLMNOPQ']
  const first = Array<number>(18).fill(0)
  first[0] = 0.6
  first[1] = 0.4
  const second = Array<number>(18).fill(0.77 / 15)
  second[0] = 0.1
  second[1] = 0.03
  second[2] = 0.1
  const data = new Float32Array([...first, ...second])
  // 탐색 중 A는 5.2점으로 빈 문자열과 B의 6점보다 낮다.
  // top16 밖의 blank→A 경로 1.8점을 복구하면 A가 7점으로 1위가 된다.
  const candidates = decodeCtcCandidates(data, 2, characters)
  expect(candidates).toEqual([
    { rank: 1, modelScore: expect.closeTo(7, 5), nickname: 'A' },
    { rank: 2, modelScore: expect.closeTo(6, 5), nickname: '' },
    { rank: 3, modelScore: expect.closeTo(6, 5), nickname: 'B' },
    { rank: 4, modelScore: expect.closeTo(4, 5), nickname: 'AB' },
    { rank: 5, modelScore: expect.closeTo(3.08, 5), nickname: 'C' }
  ])
  expect(decodeCtc(data, 2, characters)).toBe('A')
})

it('blank만 있거나 스텝이 없으면 빈 문자열 후보만 반환한다', () => {
  const expected = [{ rank: 1, modelScore: 100, nickname: '' }]
  expect(decodeCtcCandidates(new Float32Array([1, 0, 0, 1, 0, 0]), 2, ['가', '나'])).toEqual(
    expected
  )
  expect(decodeCtcCandidates(new Float32Array(), 0, ['가'])).toEqual(expected)
})

it('확률이 같은 후보는 사전 순서를 유지하고 부족한 후보를 채워 만들지 않는다', () => {
  expect(decodeCtcCandidates(new Float32Array([0, 0.5, 0.5]), 1, ['Z', 'A'])).toEqual([
    { rank: 1, modelScore: 50, nickname: 'Z' },
    { rank: 2, modelScore: 50, nickname: 'A' }
  ])
})

it.each([
  [0, 0],
  [NaN, 1],
  [Infinity, 0],
  [-0.1, 1.1],
  [0.2, 0.3]
])('확률이 아닌 입력 %j는 실패로 처리한다', (...row) => {
  expect(() => decodeCtcCandidates(new Float32Array(row), 1, ['A'])).toThrow(/probabilit/)
})

it('잘못된 스텝, 배열 크기, 중복 사전과 여러 문자로 된 label을 거절한다', () => {
  expect(() => decodeCtcCandidates(new Float32Array([1, 0]), 2, ['A'])).toThrow(/shape/)
  expect(() => decodeCtcCandidates(new Float32Array(), -1, ['A'])).toThrow(/shape/)
  expect(() => decodeCtcCandidates(new Float32Array([1, 0, 0]), 1, ['A', 'A'])).toThrow(/labels/)
  expect(() => decodeCtcCandidates(new Float32Array([1, 0]), 1, ['AB'])).toThrow(/labels/)
})
