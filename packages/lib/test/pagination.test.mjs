import assert from 'node:assert/strict'
import test from 'node:test'
import { paginate } from '@dfragon/lib/utils/pagination'

const TITLES = {
  references: '0부터 시작하는 페이지에서 입력 배열, 항목 순서, 참조를 보존한다',
  clamp: '존재하는 페이지 범위를 벗어나면 첫 페이지 또는 마지막 페이지로 맞춘다',
  empty: '필터 결과가 비어 있어도 빈 페이지 하나를 유지한다',
  exactMultiple: '항목 수가 페이지 크기의 배수이면 뒤에 빈 페이지를 추가하지 않는다',
  safeIntegerBoundaries: '안전 정수의 최소, 최대 page와 최대 pageSize도 허용한다',
  independentResults: '각 호출의 결과 배열은 서로 독립이고 결과 수정이 입력에 전파되지 않는다',
  generatedPartitions:
    '유한한 길이, 페이지 크기 조합을 재조합하면 모든 항목과 참조가 원래 순서로 남는다',
  invalidPage: '안전 정수가 아닌 page는 빈 목록에서도 RangeError로 거절한다',
  invalidPageSize: '양의 안전 정수가 아닌 pageSize는 빈 목록에서도 RangeError로 거절한다'
}

test(TITLES.references, () => {
  const items = Object.freeze([
    Object.freeze({ id: 'a' }),
    Object.freeze({ id: 'b' }),
    Object.freeze({ id: 'c' }),
    Object.freeze({ id: 'd' }),
    Object.freeze({ id: 'e' })
  ])

  const page = paginate(items, { page: 1, pageSize: 2 })

  assert.deepEqual(page, { items: [items[2], items[3]], pageCount: 3, currentPage: 1 })
  assert.equal(page.items[0], items[2])
  assert.equal(page.items[1], items[3])
  assert.notEqual(page.items, items)
  assert.deepEqual(
    items.map(({ id }) => id),
    ['a', 'b', 'c', 'd', 'e']
  )
})

test(TITLES.clamp, () => {
  const items = ['a', 'b', 'c', 'd', 'e']

  assert.deepEqual(paginate(items, { page: -1, pageSize: 2 }), {
    items: ['a', 'b'],
    pageCount: 3,
    currentPage: 0
  })
  assert.deepEqual(paginate(items, { page: 99, pageSize: 2 }), {
    items: ['e'],
    pageCount: 3,
    currentPage: 2
  })
})

test(TITLES.empty, () => {
  assert.deepEqual(paginate([], { page: 9, pageSize: 3 }), {
    items: [],
    pageCount: 1,
    currentPage: 0
  })
})

test(TITLES.exactMultiple, () => {
  assert.deepEqual(paginate([1, 2, 3, 4], { page: 2, pageSize: 2 }), {
    items: [3, 4],
    pageCount: 2,
    currentPage: 1
  })
})

test(TITLES.safeIntegerBoundaries, () => {
  const items = ['a', 'b', 'c']

  assert.deepEqual(paginate(items, { page: Number.MIN_SAFE_INTEGER, pageSize: 2 }), {
    items: ['a', 'b'],
    pageCount: 2,
    currentPage: 0
  })
  assert.deepEqual(paginate(items, { page: Number.MAX_SAFE_INTEGER, pageSize: 2 }), {
    items: ['c'],
    pageCount: 2,
    currentPage: 1
  })
  assert.deepEqual(
    paginate(items, { page: Number.MAX_SAFE_INTEGER, pageSize: Number.MAX_SAFE_INTEGER }),
    { items: ['a', 'b', 'c'], pageCount: 1, currentPage: 0 }
  )
  assert.deepEqual(paginate(items, { page: -0, pageSize: 1 }), {
    items: ['a'],
    pageCount: 3,
    currentPage: 0
  })
})

test(TITLES.independentResults, () => {
  const items = Object.freeze([Object.freeze({ id: 'a' }), Object.freeze({ id: 'b' })])
  const first = paginate(items, { page: 0, pageSize: 2 })
  const second = paginate(items, { page: 0, pageSize: 2 })

  assert.notEqual(first.items, second.items)
  assert.notEqual(first.items, items)
  first.items.reverse()
  assert.deepEqual(first.items, [items[1], items[0]])
  assert.deepEqual(second.items, [items[0], items[1]])
  assert.deepEqual(
    items.map(({ id }) => id),
    ['a', 'b']
  )
  assert.equal(second.items[0], items[0])
  assert.equal(second.items[1], items[1])
})

test(TITLES.generatedPartitions, () => {
  for (let length = 0; length <= 17; length++) {
    const items = Object.freeze(Array.from({ length }, (_, id) => Object.freeze({ id })))
    for (let pageSize = 1; pageSize <= 9; pageSize++) {
      const label = `항목 ${length}개, 페이지 크기 ${pageSize}`
      const first = paginate(items, { page: 0, pageSize })
      const collected = []
      let last = first

      assert.ok(first.pageCount >= 1 && first.pageCount <= Math.max(1, length), label)
      for (let page = 0; page < first.pageCount; page++) {
        const result = paginate(items, { page, pageSize })
        assert.equal(result.pageCount, first.pageCount, `${label}: 페이지 수`)
        assert.equal(result.currentPage, page, `${label}: 페이지 ${page}`)
        assert.notEqual(result.items, items, `${label}: 입력 배열과 분리`)
        assert.ok(result.items.length <= pageSize, `${label}: 페이지 최대 크기`)
        if (page < first.pageCount - 1) {
          assert.equal(result.items.length, pageSize, `${label}: 마지막 이전 페이지는 가득 참`)
        }

        if (length > 0) {
          assert.ok(result.items.length > 0, `${label}: 불필요한 빈 페이지 없음`)
        }
        for (const item of result.items) {
          assert.equal(item, items[collected.length], `${label}: 항목 ${collected.length}의 참조`)
          collected.push(item)
        }
        last = result
      }
      assert.deepEqual(collected, items, `${label}: 누락, 중복, 순서 변경 없음`)
      assert.deepEqual(
        paginate(items, { page: Number.MIN_SAFE_INTEGER, pageSize }),
        first,
        `${label}: 첫 페이지 보정`
      )
      assert.deepEqual(
        paginate(items, { page: Number.MAX_SAFE_INTEGER, pageSize }),
        last,
        `${label}: 마지막 페이지 보정`
      )
    }
  }
})

test(TITLES.invalidPage, () => {
  for (const page of [
    0.5,
    -0.5,
    Number.MIN_VALUE,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
    '0',
    null,
    undefined,
    true,
    false,
    0n,
    Symbol('page'),
    [],
    {}
  ]) {
    for (const items of [[], ['item']]) {
      assert.throws(
        () => paginate(items, { page, pageSize: 2 }),
        RangeError,
        `${typeof page} ${String(page)}, 항목 ${items.length}개`
      )
    }
  }
})

test(TITLES.invalidPageSize, () => {
  for (const pageSize of [
    0,
    -0,
    -1,
    0.5,
    Number.MIN_VALUE,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER,
    '2',
    null,
    undefined,
    true,
    false,
    2n,
    Symbol('pageSize'),
    [],
    {}
  ]) {
    for (const items of [[], ['item']]) {
      assert.throws(
        () => paginate(items, { page: 0, pageSize }),
        RangeError,
        `${typeof pageSize} ${String(pageSize)}, 항목 ${items.length}개`
      )
    }
  }
})
