import { beforeEach, expect, it, vi } from 'vitest'
import * as auth from './auth'
import type { AuthSnapshot } from '../common/types/auth'

const renderer = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  const events = new EventEmitter()
  const invoke = vi.fn()
  const on = vi.fn(events.on.bind(events))
  const removeListener = vi.fn(events.removeListener.bind(events))

  return { invoke, on, removeListener, events }
})
vi.mock('electron', () => ({ ipcRenderer: renderer }))
beforeEach(() => {
  vi.clearAllMocks()
  renderer.events.removeAllListeners()
})

it('feature API는 6 invoke와 단일 event subscription만 노출한다', async () => {
  expect(Object.keys(auth).sort()).toEqual([
    'beginLogin',
    'cancelLogin',
    'getAuthState',
    'logout',
    'managePasskeys',
    'onAuthStateChanged',
    'retryAuth'
  ])
  const attemptId = '00000000-0000-4000-8000-000000000002'
  await auth.getAuthState()
  await auth.beginLogin({ provider: 'passkey' })
  await auth.cancelLogin({ attemptId })
  await auth.retryAuth()
  await auth.managePasskeys()
  await auth.logout()

  expect(renderer.invoke.mock.calls).toEqual([
    ['getAuthState'],
    ['beginLogin', { provider: 'passkey' }],
    ['cancelLogin', { attemptId }],
    ['retryAuth'],
    ['managePasskeys'],
    ['logout']
  ])
})

it('인증 구독 해제 뒤에는 해당 listener만 멈추고 남은 구독은 새 상태를 받는다', () => {
  const first = vi.fn()
  const second = vi.fn()
  const unsubscribe = auth.onAuthStateChanged(first)
  const unsubscribeSecond = auth.onAuthStateChanged(second)
  const [[channel, firstWrapper], [, secondWrapper]] = renderer.on.mock.calls
  const snapshot: AuthSnapshot = {
    runId: '00000000-0000-4000-8000-000000000001',
    revision: 1,
    phase: 'signedOut',
    providers: ['passkey'],
    login: null,
    user: null,
    entry: null,
    notice: null
  }
  const rawEvent = { sender: 'must-not-cross-bridge' }

  renderer.events.emit('authStateChanged', rawEvent, snapshot)
  unsubscribe()
  const nextSnapshot = { ...snapshot, revision: 2 }
  renderer.events.emit('authStateChanged', rawEvent, nextSnapshot)

  expect(channel).toBe('authStateChanged')
  expect(first).toHaveBeenCalledExactlyOnceWith(snapshot)
  expect(second.mock.calls).toEqual([[snapshot], [nextSnapshot]])
  expect(renderer.removeListener).toHaveBeenCalledExactlyOnceWith('authStateChanged', firstWrapper)
  expect(firstWrapper).not.toBe(secondWrapper)
  unsubscribeSecond()
  expect(renderer.events.listenerCount(channel)).toBe(0)
})
