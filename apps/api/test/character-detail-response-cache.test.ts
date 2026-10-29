import assert from 'node:assert/strict'
import { type IncomingHttpHeaders, request as sendHttpRequest } from 'node:http'
import test, { type TestContext } from 'node:test'
import { type CatalogService, createCatalogService } from '../src/characters/catalog/service.js'
import type { FetchCatalog } from '../src/characters/catalog/neople.js'
import type { NeopleStageTimings } from '../src/characters/details/neople-stages.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { createApiHttpApp } from '../src/http.js'

const identity = { serverId: 'siroco', characterId: 'fixture-character' }
const signal = new AbortController().signal
const ignoredTimings: NeopleStageTimings = { record: () => undefined, markShared: () => undefined }
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

function payloadsNamed(characterName: string): CharacterPayloads {
  const common = { ...identity, characterName, jobId: 'job' }

  return {
    basic: { ...common },
    status: { ...common, status: [], buff: [] },
    equipment: { ...common, equipment: [{ itemId: 'fixture-item' }], setItemInfo: [] },
    avatar: { ...common, avatar: [] },
    creature: { ...common, creature: null },
    oath: { ...common, oath: null },
    mist_assimilation: { ...common, mistAssimilation: null },
    skill_style: { ...common, skill: { style: { active: [] } } },
    buff_equipment: { ...common, skill: { buff: null } },
    buff_avatar: { ...common, skill: { buff: null } },
    buff_creature: { ...common, skill: { buff: null } }
  }
}

const foundItems: FetchCatalog = async (itemIds) => {
  return new Map(itemIds.map((itemId) => [itemId, { itemId, itemName: '합성 아이템' }]))
}

function countingCatalog(fetchCatalog: FetchCatalog) {
  const inner = createCatalogService(fetchCatalog)
  const counter = { loads: 0 }
  const catalog: CatalogService = {
    load: (itemIds, loadSignal) => {
      counter.loads++

      return inner.load(itemIds, loadSignal)
    },
    close: () => inner.close()
  }

  return { counter, catalog }
}

interface RawResponse {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}

// node:http neither adds Accept-Encoding nor decodes the body, so the test sees the bytes the API sent.
function sendRaw(method: string, url: string, headers: Record<string, string>) {
  return new Promise<RawResponse>((resolve, reject) => {
    const outgoing = sendHttpRequest(url, { method, headers }, (incoming) => {
      const chunks: Buffer[] = []
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
      incoming.on('end', () => {
        resolve({
          status: incoming.statusCode!,
          headers: incoming.headers,
          body: Buffer.concat(chunks)
        })
      })
      incoming.on('error', reject)
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}

async function startApp(
  t: TestContext,
  fetchDetails: () => Promise<CharacterPayloads>,
  fetchCatalog: FetchCatalog
) {
  const app = await createApiHttpApp({
    search: {
      searchCharacters: async () => {
        throw new Error('response cache test must not search')
      }
    },
    details: { fetchDetails, catalog: createCatalogService(fetchCatalog) },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return `${await app.getUrl()}/characters/${identity.serverId}/${identity.characterId}`
}

test('캐릭터 캐시가 맞은 GET은 공용 아이템을 다시 붙이지 않고 처음 만든 본문 바이트를 그대로 돌려준다', async (t) => {
  const { counter, catalog } = countingCatalog(foundItems)
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => payloadsNamed('합성 캐릭터')
  })
  t.after(() => service.onModuleDestroy())

  const built = await service.get(identity, signal, ignoredTimings)
  const reused = await service.get(identity, signal, ignoredTimings)

  assert.equal(counter.loads, 1)
  assert.equal(built.reused, false)
  assert.equal(reused.reused, true)
  assert.deepEqual(reused.body, built.body)
})

test('공용 아이템이 unavailable인 응답은 저장하지 않아 다음 요청이 그 아이템을 다시 조회한다', async (t) => {
  let catalogCalls = 0
  const { counter, catalog } = countingCatalog(async (itemIds, catalogSignal) => {
    catalogCalls++
    if (catalogCalls === 1) {
      throw new Error('synthetic catalog failure')
    }

    return foundItems(itemIds, catalogSignal)
  })
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => payloadsNamed('합성 캐릭터')
  })
  t.after(() => service.onModuleDestroy())
  const itemStatus = (body: Buffer) => {
    const detail = JSON.parse(body.toString()) as {
      equipment: { equipment: { itemDetail: { status: string } }[] }
    }

    return detail.equipment.equipment[0]!.itemDetail.status
  }

  const unavailable = await service.get(identity, signal, ignoredTimings)
  const retried = await service.get(identity, signal, ignoredTimings)
  const reused = await service.get(identity, signal, ignoredTimings)

  assert.equal(itemStatus(unavailable.body), 'unavailable')
  assert.equal(itemStatus(retried.body), 'fresh')
  assert.deepEqual([unavailable.reused, retried.reused, reused.reused], [false, false, true])
  assert.equal(catalogCalls, 2)
  assert.equal(counter.loads, 2)
})

test('저장한 본문은 Express json과 같은 바이트, Content-Type으로 압축 없이 나간다', async (t) => {
  // Express `json` escapes <, > and & only when the app turns on `json escape`, so the name checks it stays off.
  const url = await startApp(t, async () => payloadsNamed('합성 <캐릭터> & 이름'), foundItems)

  const built = await sendRaw('GET', url, { 'Accept-Encoding': 'br, gzip' })
  const reused = await sendRaw('GET', url, { 'Accept-Encoding': 'br, gzip' })

  for (const response of [built, reused]) {
    assert.equal(response.status, 200)
    assert.equal(response.headers['content-type'], JSON_CONTENT_TYPE)
    assert.equal(response.headers['content-encoding'], undefined)
  }
  const text = built.body.toString()
  assert.equal(text, JSON.stringify(JSON.parse(text)))
  assert.match(text, /"characterName":"합성 <캐릭터> & 이름"/)
  assert.deepEqual(reused.body, built.body)
})

test('강제 갱신 뒤에는 이전 본문 대신 새로 만든 본문을 보낸다', async (t) => {
  let fetches = 0
  const url = await startApp(
    t,
    async () => {
      fetches++

      return payloadsNamed(`조회 ${fetches}`)
    },
    foundItems
  )
  const characterName = (response: RawResponse) => {
    const detail = JSON.parse(response.body.toString()) as {
      character: { characterName: string }
    }

    return detail.character.characterName
  }
  await sendRaw('GET', url, {})
  await sendRaw('GET', url, {})

  const refreshed = await sendRaw('POST', `${url}/refresh`, {})
  const afterRefresh = await sendRaw('GET', url, {})

  assert.equal(refreshed.status, 200)
  assert.equal(characterName(refreshed), '조회 2')
  assert.equal(characterName(afterRefresh), '조회 2')
  assert.deepEqual(afterRefresh.body, refreshed.body)
  assert.equal(fetches, 2)
})
