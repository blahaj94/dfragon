/** Split a readonly list into zero-based pages while preserving item order and references. */
export function paginate<T>(
  items: readonly T[],
  { page, pageSize }: { page: number; pageSize: number }
): { items: T[]; pageCount: number; currentPage: number } {
  if (!Number.isSafeInteger(page)) {
    throw new RangeError('page must be a safe integer')
  }

  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive safe integer')
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.max(0, Math.min(page, pageCount - 1))
  const start = currentPage * pageSize
  const end = start + pageSize
  const pageItems = items.slice(start, end)

  return { items: pageItems, pageCount, currentPage }
}
