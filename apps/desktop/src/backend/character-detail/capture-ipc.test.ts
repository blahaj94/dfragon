import { PNG } from 'pngjs'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { CharacterDetails } from '../../preload/common/types/character'
import type { CharacterSelectionReference } from '../../preload/common/types/character-detail'
import type { openSelectedCharacterDetail } from './windows'
import { candidate, createSearchFixture, jsonResponse } from '../search/search-test-fixture'

const portrait = {
  image: { width: 2, height: 1, rgba: new Uint8Array([30, 60, 90, 255, 40, 70, 100, 255]) },
  rasterScale: 1
}
const policy = { maxMeanChannelError: 0, minCoverage: 1, minComparedPixels: 1 }

async function selectedFixture(): Promise<
  Awaited<ReturnType<typeof createSearchFixture>> & {
    reference: CharacterSelectionReference
    details: CharacterDetails
    openSelected: Mock<typeof openSelectedCharacterDetail>
  }
> {
  const openSelected = vi.fn<typeof openSelectedCharacterDetail>().mockResolvedValue(true)
  const fixture = await createSearchFixture(false, 'capture', policy, { openSelected })
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-10-07T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
  }
  const sections = Object.fromEntries(
    [
      'basic',
      'status',
      'equipment',
      'avatar',
      'creature',
      'oath',
      'mist_assimilation',
      'skill_style',
      'buff_equipment',
      'buff_avatar',
      'buff_creature'
    ].map((name) => [name, metadata])
  )
  const details: CharacterDetails = {
    character: { ...candidate, level: 110 },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections,
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
  const image = new PNG({ width: 2, height: 1 })
  image.data = Buffer.from(portrait.image.rgba)
  fixture.fetchSearch
    .mockResolvedValueOnce(
      jsonResponse({
        body: {
          rows: [
            {
              ...candidate,
              imageUrl:
                'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1'
            }
          ]
        }
      })
    )
    .mockResolvedValueOnce(
      new Response(new Uint8Array(PNG.sync.write(image)), {
        headers: { 'Content-Type': 'image/png' }
      })
    )
    .mockResolvedValueOnce(jsonResponse({ body: details }))
  await fixture.invoke('notifyOcrCandidatesDetected', {
    captureId: fixture.captureId,
    slot: 0,
    observationRevision: 1,
    nickname: '가나',
    candidateNicknames: ['가나'],
    portrait
  })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
  const requestId = (await fixture.read()).slots[0].requestId!
  const reference = { captureId: fixture.captureId, slot: 0, requestId }

  return { ...fixture, reference, details, openSelected }
}

describe('현재 선택으로만 여는 상세 창 IPC', () => {
  it('선택한 실제 상세를 main에서 전달하고 HTTP를 추가 실행하지 않는다', async () => {
    const fixture = await selectedFixture()
    fixture.fetchSearch.mockClear()

    expect(await fixture.invoke('openCharacterDetails', fixture.reference)).toEqual({ ok: true })
    expect(fixture.openSelected).toHaveBeenCalledWith(
      expect.objectContaining({ webContents: fixture.event.sender }),
      fixture.details,
      expect.any(Function)
    )
    expect(fixture.openSelected.mock.calls[0][2]()).toBe(true)
    expect(fixture.fetchSearch).not.toHaveBeenCalled()
  })

  it.each(['request', 'slot', 'url', 'extra', 'detached'] as const)(
    '%s 변조로 다른 캐릭터나 문서의 창을 열 수 없다',
    async (kind) => {
      const fixture = await selectedFixture()
      const input = { ...fixture.reference }
      if (kind === 'request') {
        input.requestId = '00000000-0000-4000-8000-000000000099'
      }

      if (kind === 'slot') {
        input.slot = 1
      }

      if (kind === 'url') {
        Object.assign(input, { url: 'https://untrusted.example/' })
      }

      if (kind === 'detached') {
        Object.assign(fixture.event.senderFrame!, { detached: true })
      }
      const args = kind === 'extra' ? [input, 'extra'] : [input]

      expect(await fixture.invoke('openCharacterDetails', ...args)).toEqual({ ok: false })
      expect(fixture.openSelected).not.toHaveBeenCalled()
    }
  )

  it.each(['clear', 'end', 'document'] as const)(
    '창 로딩 중 %s 발생은 현재 선택 검사를 무효화한다',
    async (action) => {
      const fixture = await selectedFixture()
      const pending = Promise.withResolvers<boolean>()
      fixture.openSelected.mockReturnValueOnce(pending.promise)
      const opening = fixture.invoke('openCharacterDetails', fixture.reference)
      const isCurrent = fixture.openSelected.mock.calls[0][2]
      if (action === 'clear') {
        await fixture.invoke('controlCharacterSearch', {
          action: 'clear',
          captureId: fixture.captureId,
          slot: 0,
          observationRevision: 2
        })
      } else if (action === 'end') {
        await fixture.invoke('controlCharacterSearch', {
          action: 'end',
          captureId: fixture.captureId
        })
      } else {
        fixture.replaceDocument()
      }
      expect(isCurrent()).toBe(false)
      pending.resolve(true)
      expect(await opening).toEqual({ ok: false })
    }
  )

  it('잘못된 sender는 현재 선택 여부도 전달받지 못한다', async () => {
    const fixture = await selectedFixture()
    Object.assign(fixture.event, { sender: {} })
    await expect(fixture.invoke('openCharacterDetails', fixture.reference)).rejects.toThrow(
      'SEARCH_NOT_ALLOWED'
    )
    expect(fixture.openSelected).not.toHaveBeenCalled()
  })
})
