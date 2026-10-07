// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailSnapshot } from '../../../../preload/common/types/character-detail'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'
import { CharacterSnapshotPage } from './CharacterSnapshotPage'

const snapshot: CharacterDetailSnapshot = {
  character: {
    serverId: 'cain',
    characterId: 'matched-id',
    characterName: '선택한캐릭터',
    serverName: '카인',
    adventureName: '함께하는모험단',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    level: 115,
    fame: 78000,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/matched-id?zoom=1'
  },
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T01:00:00.000Z',
    expiresAt: '2026-10-07T02:00:00.000Z'
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'characterDetail')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function installRead(read: () => Promise<CharacterDetailSnapshot>): void {
  Object.defineProperty(window, 'characterDetail', {
    configurable: true,
    value: { read }
  })
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(
      <ColorThemeProvider initialTheme="dark">
        <CharacterSnapshotPage />
      </ColorThemeProvider>
    )
  })
}

function field(label: string): string | null | undefined {
  const term = [...container.querySelectorAll('dt')].find((item) => item.textContent === label)

  return term?.nextElementSibling?.textContent
}

it('창에 전달된 캐릭터의 실제 기본 정보와 조회 시각을 표시한다', async () => {
  installRead(async () => snapshot)

  await render()

  expect(container.querySelector('h2')?.textContent).toBe('선택한캐릭터')
  expect(field('서버')).toBe('카인')
  expect(field('모험단')).toBe('함께하는모험단')
  expect(field('직업')).toBe('귀검사(남)')
  expect(field('전직')).toBe('眞 웨펀마스터')
  expect(field('레벨')).toBe('115')
  expect(field('명성')).toBe('78,000')
  expect(container.querySelector('img')?.getAttribute('src')).toBe(snapshot.character.imageUrl)
  expect([...container.querySelectorAll('time')].map((time) => time.dateTime)).toEqual([
    '2026-10-07T01:00:00.000Z',
    '2026-10-07T02:00:00.000Z'
  ])
  expect(container.textContent).toContain('창을 열 때의 정보를 표시합니다.')
  expect(container.textContent).not.toContain('합성 데이터')
  expect(container.textContent).not.toContain('마법부여')
})

it('없는 정보는 정보 없음으로 표시하며 명성 0은 보존한다', async () => {
  installRead(async () => ({
    ...snapshot,
    character: {
      ...snapshot.character,
      adventureName: null,
      jobName: null,
      jobGrowName: null,
      level: null,
      fame: 0
    }
  }))

  await render()

  expect(field('모험단')).toBe('정보 없음')
  expect(field('직업')).toBe('정보 없음')
  expect(field('전직')).toBe('정보 없음')
  expect(field('레벨')).toBe('정보 없음')
  expect(field('명성')).toBe('0')
})

it('명성 null을 숫자로 바꾸지 않고 정보 없음으로 표시한다', async () => {
  installRead(async () => ({
    ...snapshot,
    character: { ...snapshot.character, fame: null }
  }))

  await render()

  expect(field('명성')).toBe('정보 없음')
})

it('스냅샷 수신을 기다린 뒤 재렌더링해도 처음 열린 캐릭터를 유지한다', async () => {
  let resolve!: (value: CharacterDetailSnapshot) => void
  const pending = new Promise<CharacterDetailSnapshot>((accept) => {
    resolve = accept
  })
  const read = vi.fn<() => Promise<CharacterDetailSnapshot>>().mockReturnValue(pending)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  installRead(read)
  await render()
  expect(container.querySelector('[role="status"]')?.textContent).toContain('불러오는 중')

  await act(async () => resolve(snapshot))
  read.mockResolvedValue({
    ...snapshot,
    character: { ...snapshot.character, characterName: '다음캐릭터' }
  })
  await render()

  expect(container.querySelector('h2')?.textContent).toBe('선택한캐릭터')
  expect(read).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})

it('조회 실패는 내부 오류를 노출하지 않는 안내를 표시하고 창을 닫을 수 있다', async () => {
  installRead(async () => {
    throw new Error('internal sensitive failure')
  })
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})

  await render()

  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    '캐릭터 정보를 불러오지 못했습니다.'
  )
  expect(container.textContent).not.toContain('internal sensitive failure')
  expect(container.querySelector('img')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(close).toHaveBeenCalledOnce()
})

it('전용 preload가 없는 경우에도 오류 안내를 표시한다', async () => {
  await render()

  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    '캐릭터 정보를 불러오지 못했습니다.'
  )
})
