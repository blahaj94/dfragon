import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import type { BrowserWindow } from 'electron'
import type { AuthCoordinator } from '../../src/backend/auth/types'
import { installObservation } from './observe'
import type { CaptureObservation } from './capture-observation'
import { createCaptureActions, until, type Observation } from './actions'

export const sandboxInspectionSource = `(() => {
  const hasNoElectron = typeof window.electron === "undefined";
  if (!hasNoElectron) {
    return false;
  }
  const hasNoRequire = typeof window.require === "undefined";
  return hasNoRequire;
})()`

const unselectedMediaRequest = `navigator.mediaDevices
  .getDisplayMedia({ video: true, audio: false })
  .then(
  stream => {
    stream.getTracks()
      .forEach(track => track.stop());
    return false;
  },
  () => true
)`

function createDisplayInspectionSource(): string {
  const displayInspectionSource = `(() => {
      let matchedSlots = 0;
      for (let slot = 0; slot < 4; slot += 1) {
        const name = document.querySelector('input[aria-label="' + (slot + 1) + '번 캐릭터 이름"]');
        if (name?.value === 'ALICE') {
          matchedSlots |= 1 << slot;
        }
      }
      return matchedSlots;
    })()`
  return displayInspectionSource
}

export async function smoke(
  window: BrowserWindow,
  coordinator: AuthCoordinator,
  completeLogin: () => Promise<void>,
  mainObservation: CaptureObservation
): Promise<void> {
  const { evaluate, hasText, observe, click, login } = createCaptureActions({
    window,
    coordinator,
    completeLogin
  })

  async function clickSelector(selector: string): Promise<void> {
    const ready = `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      return element != null && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
    })()`
    await until(async () => (await evaluate(ready)) as boolean)
    assert.equal(
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click(); true`, true),
      true
    )
  }
  async function selectSyntheticSource(): Promise<void> {
    await clickSelector('[role="dialog"] button[aria-haspopup="menu"]')
    await clickSelector('[role="menuitemradio"][aria-label="LDB Synthetic Capture Source"]')
  }

  console.log('Capture fixture step: current-app-and-sandbox')
  await until(
    async () =>
      (await evaluate(
        'document.querySelector(\'button[aria-label="화면 캡처"]\') !== null'
      )) as boolean
  )
  assert.equal(await evaluate(sandboxInspectionSource), true)
  assert.equal(await evaluate(installObservation), true)
  assert.equal((await observe()).requests, 0)
  await clickSelector('button[aria-label="화면 캡처"]')

  console.log('Capture fixture step: custom-select-auto-capture')
  await selectSyntheticSource()
  await until(async () => {
    const state = await observe()
    const isMediaReady = state.streams === 1
    return isMediaReady
  }, 20_000)
  console.log('Capture fixture actual stream acquired')
  await until(() => hasText('캡처 중 · 1920×1080'), 30_000)
  console.log('Capture fixture actual OCR worker ready')
  let displayMatchedSlots = 0
  try {
    await until(async () => {
      const displayInspectionSource = createDisplayInspectionSource()
      displayMatchedSlots = (await evaluate(displayInspectionSource)) as number
      const hasAllDisplays = displayMatchedSlots === 0b1111
      const hasAllNotifications = mainObservation.nicknameMatchedSlots === 0b1111
      const hasAllSyntheticMatches = hasAllDisplays && hasAllNotifications
      return hasAllSyntheticMatches
    }, 30_000)
  } finally {
    console.log(
      `Capture fixture synthetic matches: ${JSON.stringify({ displayMatchedSlots, nicknameMatchedSlots: mainObservation.nicknameMatchedSlots })}`
    )
  }

  const active = await observe()
  assert.equal(mainObservation.displayRequests, 1)
  assert.equal(mainObservation.displayAllowed, 1)
  const isSafeWidth = Number.isSafeInteger(active.width)
  const isPositiveWidth = active.width > 0
  const hasPositiveWidth = isSafeWidth && isPositiveWidth
  assert.ok(hasPositiveWidth)
  const isSafeHeight = Number.isSafeInteger(active.height)
  const isPositiveHeight = active.height > 0
  const hasPositiveHeight = isSafeHeight && isPositiveHeight
  assert.ok(hasPositiveHeight)
  // 제품이 지원하는 기존 video frame geometry를 확인한다. Native track 크기는 별도 관측값이다.
  assert.equal(active.frameWidth, 1920)
  assert.equal(active.frameHeight, 1080)
  assert.equal(active.allSlotsPresent, true)
  console.log(
    `Capture fixture geometry: ${JSON.stringify({ trackWidth: active.width, trackHeight: active.height, frameWidth: active.frameWidth, frameHeight: active.frameHeight, allSlotsPresent: active.allSlotsPresent })}`
  )
  assert.equal(active.workers, 1)
  assert.equal(active.terminated, 0)
  assert.equal(active.ended, false)
  console.log('Capture fixture real media/OCR PASS')

  console.log('Capture fixture step: login-and-logout-preserve-capture')
  await click('닫기')
  await login()
  assert.equal((await coordinator.logout()).ok, true)
  await until(
    async () =>
      (await evaluate(
        'document.querySelector(\'button[aria-label="로그인"]\')?.disabled === false'
      )) as boolean
  )
  assert.equal((await observe()).ended, false)
  assert.equal((await observe()).terminated, 0)
  assert.equal(await evaluate(createDisplayInspectionSource()), 0b1111)
  await clickSelector('button[aria-label="화면 캡처"]')
  assert.equal((await observe()).streams, 1)

  console.log('Capture fixture step: stop-cleanup')
  await click('캡처 중지')
  await until(async () => {
    const state = await observe()
    const hasOneStop = state.stops === 1
    const hasEnded = state.ended
    const hasStopped = hasOneStop && hasEnded
    const hasTerminated = state.terminated === 1
    const hasCompletedCleanup = hasStopped && hasTerminated
    return hasCompletedCleanup
  })
  assert.equal((await observe()).clearedVideos, 1)
  assert.equal(await evaluate(createDisplayInspectionSource()), 0)

  const stopped = await observe()
  const stoppedInvokes = mainObservation.nicknameInvokes
  await delay(3_200)
  assert.equal((await observe()).recognitionRequests, stopped.recognitionRequests)
  assert.equal(mainObservation.nicknameInvokes, stoppedInvokes)
  console.log('Capture fixture stopped OCR/IPC quiet interval PASS')

  console.log('Capture fixture step: stopped-requires-new-selection')
  assert.equal(
    await evaluate(
      'document.querySelector(\'[role="dialog"] button[aria-haspopup="menu"]\').textContent.includes("캡처할 프로세스 선택")'
    ),
    true
  )
  assert.equal((await observe()).requests, 1)
  assert.equal((await observe()).workers, 1)
  // Stop 이후에는 창을 다시 선택해 새 캡처를 시작하기 전까지 media를 허용하지 않는다.
  assert.equal(await evaluate(unselectedMediaRequest, true), true)
  assert.equal((await observe()).streams, 1)
  assert.equal(mainObservation.displayRequests, 2)
  assert.equal(mainObservation.displayAllowed, 1)

  console.log('Capture fixture step: reselect-and-stop')
  await selectSyntheticSource()
  await until(async () => (await observe()).workers === 2, 30_000)
  await until(() => hasText('캡처 중 · 1920×1080'), 30_000)
  assert.equal((await observe()).streams, 2)
  assert.equal(mainObservation.displayAllowed, 2)
  await click('캡처 중지')
  await until(async () => {
    const state = await observe()
    return state.ended && state.stops === 2 && state.terminated === 2 && state.clearedVideos === 2
  })
}

export async function smokeStandaloneOcr(window: BrowserWindow): Promise<void> {
  console.log('Capture fixture step: standalone-real-ocr')
  const evaluate = (source: string): Promise<unknown> =>
    window.webContents.executeJavaScript(source)
  assert.equal(await evaluate(installObservation), true)
  assert.equal(await evaluate(sandboxInspectionSource), true)
  const result = await evaluate('window.runFixtureOcr()')
  assert.deepEqual(result, { matched: true, terminated: true })
  const observation = (await evaluate('window.captureObservation()')) as Observation
  assert.equal(observation.workers, 1)
  assert.equal(observation.terminated, 1)
  assert.equal(observation.streams, 0)
  assert.equal(observation.requests, 0)
}

export { smokeCharacterSearch } from './search-smoke'
