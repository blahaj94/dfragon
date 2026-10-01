import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import type { CatalogStore } from '../src/characters/catalog/store.js'
import type { CatalogKey } from '../src/characters/catalog/types.js'

test('refreshes mixed references in item, set and single-skill groups with the last duplicate object', async () => {
  const items: CatalogKey[] = Array.from({ length: 17 }, (_, index) => ({
    kind: 'item',
    itemId: 'item-' + index
  }))
  const sets: CatalogKey[] = Array.from({ length: 16 }, (_, index) => ({
    kind: 'set',
    setItemId: 'set-' + index
  }))
  const skills: CatalogKey[] = [
    { kind: 'skill', jobId: 'job', skillId: 'skill-a' },
    { kind: 'skill', jobId: 'job', skillId: 'skill-b' }
  ]
  const replacement: CatalogKey = { kind: 'item', itemId: 'item-0' }
  const now = new Date()
  const requestedAt = now.toISOString()
  const store: CatalogStore = {
    read: async () => ({ entries: [], now, requestedAt }),
    saveAndRead: async () => ({ entries: [], now })
  }
  const calls: CatalogKey[][] = []
  const service = createCatalogService(store, async (keys) => {
    calls.push(keys)

    return []
  })

  await service.load(
    [skills[0]!, sets[0]!, ...items, ...sets.slice(1), skills[1]!, replacement],
    new AbortController().signal
  )

  assert.deepEqual(calls, [
    [replacement, ...items.slice(1, 15)],
    items.slice(15),
    sets.slice(0, 15),
    sets.slice(15),
    [skills[0]!],
    [skills[1]!]
  ])
  assert.equal(calls[0]![0], replacement)
})
