import assert from 'node:assert/strict'
import test from 'node:test'
import { paginate } from '@dfragon/lib/utils/pagination'

test('uses zero-based pages without changing item order, references, or the input list', () => {
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

test('clamps requests outside the available pages to the first or last page', () => {
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

test('keeps one empty page after all items are filtered out', () => {
  assert.deepEqual(paginate([], { page: 9, pageSize: 3 }), {
    items: [],
    pageCount: 1,
    currentPage: 0
  })
})

test('does not add an empty page when the item count is an exact multiple of the page size', () => {
  assert.deepEqual(paginate([1, 2, 3, 4], { page: 2, pageSize: 2 }), {
    items: [3, 4],
    pageCount: 2,
    currentPage: 1
  })
})

test('rejects page values that are not safe integers', () => {
  for (const page of [
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '0',
    null,
    undefined
  ]) {
    assert.throws(() => paginate(['item'], { page, pageSize: 2 }), RangeError)
  }
})

test('rejects page sizes that are not positive safe integers', () => {
  for (const pageSize of [
    0,
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
    undefined
  ]) {
    assert.throws(() => paginate(['item'], { page: 0, pageSize }), RangeError)
  }
})
