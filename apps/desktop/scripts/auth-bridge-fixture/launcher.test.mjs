import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runAuthBridgeFixture } from '../auth-bridge-fixture.mjs'

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')

const fixture = vi.hoisted(() => {
  const spawn = vi.fn()
  const remove = vi.fn()
  const inspect = vi.fn()
  const create = vi.fn()

  return { spawn, remove, inspect, create }
})
vi.mock('node:child_process', () => ({ spawn: fixture.spawn }))
vi.mock('node:fs/promises', () => ({
  mkdtemp: fixture.create,
  rm: fixture.remove,
  lstat: fixture.inspect
}))
vi.mock('node:timers/promises', () => {
  // Group 종료 polling도 테스트에서 제어하는 같은 시계를 사용한다.
  /** @param {number} milliseconds @returns {Promise<void>} */
  function delay(milliseconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds)
    })
  }

  return { setTimeout: delay }
})

beforeEach(() => {
  Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'darwin' })
  vi.resetAllMocks()
  fixture.create.mockResolvedValue('/synthetic/owned-profile')
  fixture.remove.mockResolvedValue(undefined)
  fixture.inspect.mockRejectedValue(
    Object.assign(new Error('SYNTHETIC_FILE_FAILURE'), { code: 'ENOENT' })
  )
  fixture.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { pid: 424242 })
    queueMicrotask(() => child.emit('close', 0))

    return child
  })
  vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('Gone'), { code: 'ESRCH' })
  })
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatformDescriptor)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('child 종료와 owned process group 부재 확인 뒤 profile을 삭제하고 부재를 확인한다', async () => {
  expect(await runAuthBridgeFixture(['--smoke'])).toBe(0)
  expect(process.kill).toHaveBeenCalledWith(-424242, 0)
  expect(fixture.remove).toHaveBeenCalledExactlyOnceWith('/synthetic/owned-profile', {
    recursive: true,
    force: true,
    maxRetries: 3
  })
  expect(fixture.inspect).toHaveBeenCalledWith('/synthetic/owned-profile')
  expect(console.log).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup PASS')
  expect(console.error).not.toHaveBeenCalled()
})

it('child 실패는 cleanup 성공 뒤에도 실패로 반환한다', async () => {
  fixture.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { pid: 424242 })
    queueMicrotask(() => child.emit('close', 1))

    return child
  })

  expect(await runAuthBridgeFixture(['--smoke'])).toBe(1)
  expect(console.log).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup PASS')
})

it('smoke 제한 시간이 지나면 TERM에 응답하지 않는 owned group을 KILL로 종료하고 실패를 유지한다', async () => {
  vi.useFakeTimers()
  const child = Object.assign(new EventEmitter(), { pid: 424242 })
  const spawned = Promise.withResolvers()
  const signalListeners = {
    SIGINT: process.listenerCount('SIGINT'),
    SIGTERM: process.listenerCount('SIGTERM')
  }
  let groupAlive = true
  const observations = []
  fixture.spawn.mockImplementation(() => {
    spawned.resolve()

    return child
  })
  vi.mocked(process.kill).mockImplementation((_pid, signal) => {
    if (signal === 0) {
      if (!groupAlive) {
        observations.push('group absent')
        throw Object.assign(new Error('Gone'), { code: 'ESRCH' })
      }

      return true
    }

    observations.push(signal)
    if (signal === 'SIGKILL') {
      groupAlive = false
      child.emit('close', null, 'SIGKILL')
    }

    return true
  })
  fixture.remove.mockImplementation(async () => {
    observations.push(groupAlive ? 'profile removed while group alive' : 'profile removed')
  })
  fixture.inspect.mockImplementation(async () => {
    observations.push('profile absent')
    throw Object.assign(new Error('Absent'), { code: 'ENOENT' })
  })
  const execution = runAuthBridgeFixture(['--smoke'])
  await spawned.promise

  await vi.advanceTimersByTimeAsync(119_999)
  expect(process.kill).not.toHaveBeenCalled()
  expect(fixture.remove).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(1)
  expect(process.kill).toHaveBeenCalledWith(-424242, 'SIGTERM')
  expect(fixture.remove).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(1_999)
  expect(process.kill).not.toHaveBeenCalledWith(-424242, 'SIGKILL')
  await vi.advanceTimersByTimeAsync(1)

  expect(await execution).toBe(1)
  expect(process.kill).toHaveBeenCalledWith(-424242, 'SIGKILL')
  expect(observations).toEqual([
    'SIGTERM',
    'SIGKILL',
    'group absent',
    'profile removed',
    'profile absent'
  ])
  expect(console.log).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup PASS')
  expect(console.error).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  expect(process.listenerCount('SIGINT')).toBe(signalListeners.SIGINT)
  expect(process.listenerCount('SIGTERM')).toBe(signalListeners.SIGTERM)
})

it.each([
  {
    scenario: 'child 성공 뒤 KILL로 group이 종료되면 profile을 정리하고 성공을 보존한다',
    exitsOnKill: true,
    exitCode: 0
  },
  {
    scenario: 'child 성공 뒤 KILL에도 group이 살아 있으면 profile을 유지하고 실패한다',
    exitsOnKill: false,
    exitCode: 1
  }
])('$scenario', async ({ exitsOnKill, exitCode }) => {
  vi.useFakeTimers()
  const child = Object.assign(new EventEmitter(), { pid: 424242 })
  const spawned = Promise.withResolvers()
  let groupAlive = true
  const signals = []
  const profileRemovalStates = []
  fixture.spawn.mockImplementation(() => {
    spawned.resolve()

    return child
  })
  vi.mocked(process.kill).mockImplementation((pid, signal) => {
    if (signal === 0) {
      if (!groupAlive) {
        throw Object.assign(new Error('Gone'), { code: 'ESRCH' })
      }

      return true
    }

    signals.push({ pid, signal })
    if (signal === 'SIGKILL' && exitsOnKill) {
      groupAlive = false
    }

    return true
  })
  fixture.remove.mockImplementation(async () => {
    profileRemovalStates.push(groupAlive)
  })
  const execution = runAuthBridgeFixture(['--smoke'])
  await spawned.promise
  // child close는 모든 descendant의 종료를 뜻하지 않는다.
  child.emit('close', 0)

  await vi.advanceTimersByTimeAsync(499)
  expect(signals).toEqual([])
  expect(fixture.remove).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(1)
  expect(signals).toEqual([{ pid: -424242, signal: 'SIGTERM' }])
  expect(fixture.remove).not.toHaveBeenCalled()

  await vi.advanceTimersByTimeAsync(2_000)
  expect(signals).toEqual([
    { pid: -424242, signal: 'SIGTERM' },
    { pid: -424242, signal: 'SIGKILL' }
  ])
  await vi.advanceTimersByTimeAsync(1_000)

  expect(await execution).toBe(exitCode)
  if (exitsOnKill) {
    expect(profileRemovalStates).toEqual([false])
    expect(fixture.inspect).toHaveBeenCalledOnce()
    expect(console.log).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup PASS')
    expect(console.error).not.toHaveBeenCalled()
  } else {
    expect(profileRemovalStates).toEqual([])
    expect(fixture.inspect).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup FAIL')
    expect(console.log).not.toHaveBeenCalled()
  }
  expect(vi.getTimerCount()).toBe(0)
})

it('owned process group 종료를 확인하지 못하면 profile을 삭제하지 않고 실패한다', async () => {
  vi.mocked(process.kill).mockImplementation(() => {
    throw Object.assign(new Error('SYNTHETIC_GROUP_FAILURE'), { code: 'EPERM' })
  })

  expect(await runAuthBridgeFixture(['--smoke'])).toBe(1)
  expect(fixture.remove).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup FAIL')
  expect(console.log).not.toHaveBeenCalled()
})

it('profile 삭제 또는 부재 확인 실패를 성공으로 숨기지 않는다', async () => {
  fixture.remove.mockRejectedValue(new Error('SYNTHETIC_FILE_FAILURE'))

  expect(await runAuthBridgeFixture(['--smoke'])).toBe(1)
  expect(console.error).toHaveBeenCalledExactlyOnceWith('Auth bridge fixture cleanup FAIL')
  expect(console.log).not.toHaveBeenCalled()
})

it('Windows에서는 유효한 모드도 파일과 프로세스 작업 없이 설정 단계에서 거절한다', async () => {
  Object.defineProperty(process, 'platform', { ...originalPlatformDescriptor, value: 'win32' })

  expect(await runAuthBridgeFixture(['--smoke'])).toBe(1)
  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    'Auth bridge fixture launcher configuration FAIL'
  )
  expect(console.log).not.toHaveBeenCalled()
  expect(fixture.create).not.toHaveBeenCalled()
  expect(fixture.spawn).not.toHaveBeenCalled()
  expect(fixture.remove).not.toHaveBeenCalled()
  expect(fixture.inspect).not.toHaveBeenCalled()
  expect(process.kill).not.toHaveBeenCalled()
})
