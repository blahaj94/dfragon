import type { IpcRenderer } from 'electron'
import { beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailApi, CharacterDetailSnapshot } from './common/types/character-detail'

const mocks = vi.hoisted(() => {
  const invoke = vi.fn<IpcRenderer['invoke']>()
  const expose = vi.fn<(name: string, api: CharacterDetailApi) => void>()

  return { invoke, expose }
})

vi.mock('electron', () => {
  const ipcRenderer = { invoke: mocks.invoke }
  const contextBridge = { exposeInMainWorld: mocks.expose }

  return { ipcRenderer, contextBridge }
})

const snapshot: CharacterDetailSnapshot = {
  character: {
    serverId: 'cain',
    characterId: 'character-1',
    characterName: '파티원',
    serverName: '카인',
    adventureName: '모험단',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    level: 115,
    fame: 70000,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1'
  },
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T01:00:00.000Z',
    expiresAt: '2026-10-07T02:00:00.000Z'
  }
}

let api: CharacterDetailApi

beforeEach(async () => {
  vi.resetModules()
  mocks.invoke.mockReset()
  mocks.expose.mockClear()
  await import('./character-detail')
  const exposure = mocks.expose.mock.calls.at(0)
  if (!exposure) {
    throw new Error('캐릭터 상세 API가 노출되지 않았습니다.')
  }
  api = exposure[1]
})

it('상세창에는 characterDetail.read만 노출한다', () => {
  expect(mocks.expose).toHaveBeenCalledExactlyOnceWith('characterDetail', api)
  expect(Object.keys(api)).toEqual(['read'])
  expect(mocks.invoke).not.toHaveBeenCalled()
})

it('인자 없이 지정된 상세 조회 채널을 호출하고 검증된 snapshot을 반환한다', async () => {
  mocks.invoke.mockResolvedValue(snapshot)

  await expect(api.read()).resolves.toEqual(snapshot)
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('readCharacterDetail')
})

it.each([
  { name: '빈 응답', value: null },
  { name: '허용되지 않은 추가 데이터', value: { ...snapshot, accessToken: 'private-token' } },
  {
    name: '외부 이미지 주소',
    value: {
      ...snapshot,
      character: { ...snapshot.character, imageUrl: 'https://untrusted.example/portrait.png' }
    }
  },
  {
    name: '잘못된 freshness',
    value: { ...snapshot, freshness: { ...snapshot.freshness, expiresAt: 'not-a-date' } }
  }
])('$name는 응답 내용을 노출하지 않고 거부한다', async ({ value }) => {
  mocks.invoke.mockResolvedValue(value)

  await expect(api.read()).rejects.toEqual(new Error('CHARACTER_DETAIL_UNAVAILABLE'))
})

it('IPC 실패의 원문과 원인을 renderer에 전달하지 않는다', async () => {
  const privateFailure = new Error('private upstream endpoint and token', {
    cause: { accessToken: 'private-token' }
  })
  mocks.invoke.mockRejectedValue(privateFailure)

  const result = await Promise.allSettled([api.read()])
  const failure = result[0]
  expect(failure.status).toBe('rejected')
  if (failure.status !== 'rejected') {
    throw new Error('IPC 실패가 성공으로 처리되었습니다.')
  }
  expect(failure.reason).not.toBe(privateFailure)
  expect(failure.reason).toEqual(new Error('CHARACTER_DETAIL_UNAVAILABLE'))
  expect(failure.reason).not.toHaveProperty('cause')
  expect(failure.reason.stack).not.toContain(privateFailure.message)
})
