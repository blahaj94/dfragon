import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { test } from 'node:test'
import { stopOwnedProcessGroup } from '../scripts/consumer-process-lifecycle.mjs'

// RED의 무제한 await도 assertion 결과로 반환하고, 실패한 작업은 finally에서 해제한다.
async function settleWithin({ operation, deadlineMs }) {
  let timer
  const settled = operation.then(
    () => ({ status: 'fulfilled' }),
    (error) => ({ status: 'rejected', error })
  )
  try {
    return await Promise.race([
      settled,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: 'deadline' }), deadlineMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

function createControlledGroup(mode) {
  const child = { pid: 424242, exitCode: null, signalCode: null }
  const { promise: exited, resolve: release } = Promise.withResolvers()
  const signals = []
  const sleeps = []
  const permissionError = Object.assign(new Error('Group inspection denied'), { code: 'EPERM' })
  const cleanupError = new Error('Owned group signal failed')
  let groupExists = true
  let elapsedMs = 0

  function exit() {
    child.exitCode = 0
    release()
  }
  const hasExitedChild = ['absent', 'orphan', 'permission'].includes(mode)
  if (hasExitedChild) {
    exit()
  }
  const isInitiallyAbsent = mode === 'absent'
  if (isInitiallyAbsent) {
    groupExists = false
  }

  function kill(pid, signal) {
    assert.equal(pid, -child.pid, 'Only the supplied owned group may be addressed')
    const isProbe = signal === 0
    if (isProbe) {
      const isDenied = mode === 'permission'
      if (isDenied) {
        throw permissionError
      }
    } else {
      signals.push({ signal, elapsedMs })
      const hasSignalError = mode === 'cleanup-error'
      if (hasSignalError) {
        throw cleanupError
      }
      const isExitRace = mode === 'esrch'
      const isNormalTerm = mode === 'normal' && signal === 'SIGTERM'
      const canKill = mode !== 'persistent' && signal === 'SIGKILL'
      const shouldExit = isExitRace || isNormalTerm || canKill
      if (shouldExit) {
        groupExists = false
        exit()
      }
      const hasSuccessfulSignal = !isExitRace && shouldExit
      if (hasSuccessfulSignal) {
        return true
      }
    }

    if (!groupExists) {
      throw Object.assign(new Error('Owned group is absent'), { code: 'ESRCH' })
    }

    return true
  }

  return {
    child,
    exited,
    kill,
    now: () => elapsedMs,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds)
      elapsedMs += milliseconds
    },
    release,
    signals,
    sleeps,
    permissionError,
    cleanupError
  }
}

const unitCases = [
  { name: 'TERM으로 정상 종료하고 group이 사라지면 성공한다', mode: 'normal', status: 'fulfilled' },
  {
    name: '이미 종료한 child의 group이 없으면 신호를 보내지 않는다',
    mode: 'absent',
    status: 'fulfilled'
  },
  {
    name: 'TERM을 거부하면 KILL로 정리한 뒤에도 실패를 보존한다',
    mode: 'stubborn',
    status: 'rejected'
  },
  {
    name: 'child가 종료했어도 descendant group이 남으면 실패한다',
    mode: 'orphan',
    status: 'rejected'
  },
  {
    name: 'KILL 후에도 group이 남으면 정리 제한 안에서 실패한다',
    mode: 'persistent',
    status: 'rejected'
  },
  {
    name: 'group 확인 권한 오류를 group 부재로 처리하지 않는다',
    mode: 'permission',
    status: 'rejected'
  },
  {
    name: '신호 전송 중 ESRCH가 발생해도 child 종료와 group 부재를 확인하면 성공한다',
    mode: 'esrch',
    status: 'fulfilled'
  },
  {
    name: '원래 검사 오류와 정리 오류를 cause와 errors에 함께 보존한다',
    mode: 'cleanup-error',
    status: 'rejected'
  }
]

for (const { name, mode, status } of unitCases) {
  test(name, async () => {
    const group = createControlledGroup(mode)
    const originalError = new Error('HTTP inspection failed')
    const hasOriginalError = mode === 'cleanup-error'
    const options = hasOriginalError ? { ...group, originalError } : group
    const operation = stopOwnedProcessGroup(options)
    try {
      const outcome = await settleWithin({ operation, deadlineMs: 250 })
      assert.equal(outcome.status, status, 'Must settle from lifecycle handling, not test deadline')

      const needsEscalation = ['stubborn', 'orphan', 'persistent'].includes(mode)
      if (needsEscalation) {
        assert.deepEqual(group.signals, [
          { signal: 'SIGTERM', elapsedMs: 0 },
          { signal: 'SIGKILL', elapsedMs: 5000 }
        ])
        const isWithinCleanupBound = group.now() <= 7000
        assert.ok(isWithinCleanupBound, 'TERM plus KILL cleanup must be bounded at 7 seconds')
        const usesFiftyMillisecondPoll = group.sleeps.every((milliseconds) => {
          const isFiftyMilliseconds = milliseconds === 50

          return isFiftyMilliseconds
        })
        assert.ok(usesFiftyMillisecondPoll, 'Absence polling uses the approved 50ms interval')
        const isStillPresent = mode === 'persistent'
        const expectedFailure = isStillPresent
          ? /could not confirm child exit and group absence/
          : /exceeded the SIGTERM grace period; cleanup required escalation/
        assert.match(outcome.error.message, expectedFailure)
      }
      const isAlreadyAbsent = mode === 'absent'
      if (isAlreadyAbsent) {
        assert.deepEqual(group.signals, [])
      }

      if (mode === 'permission') {
        assert.equal(outcome.error, group.permissionError)
        assert.deepEqual(group.signals, [])
        assert.deepEqual(group.sleeps, [])
      }

      if (hasOriginalError) {
        const isAggregate = outcome.error instanceof AggregateError
        assert.ok(isAggregate, 'Both failures must remain inspectable')
        assert.deepEqual(outcome.error.errors, [originalError, group.cleanupError])
        assert.equal(outcome.error.cause, originalError)
      }
    } finally {
      group.release()
      await operation.catch(() => {})
    }
  })
}

const invalidPidCases = [
  {
    name: '정수가 아닌 PID는 신호, 대기, 시계 확인 전에 거부한다',
    pid: 1.5
  },
  {
    name: 'PID 1은 신호, 대기, 시계 확인 전에 거부한다',
    pid: 1
  }
]

for (const { name, pid } of invalidPidCases) {
  test(name, async () => {
    const group = createControlledGroup('absent')
    let nowCalls = 0
    let killCalls = 0
    let sleepCalls = 0
    group.child.pid = pid
    const operation = stopOwnedProcessGroup({
      ...group,
      now: () => {
        nowCalls += 1

        return group.now()
      },
      kill: (...args) => {
        killCalls += 1

        return group.kill(...args)
      },
      sleep: async (milliseconds) => {
        sleepCalls += 1

        return group.sleep(milliseconds)
      }
    })
    try {
      const outcome = await settleWithin({ operation, deadlineMs: 250 })
      assert.equal(outcome.status, 'rejected')
      assert.equal(outcome.error.message, 'Cannot identify the owned detached process group')
      assert.equal(killCalls, 0)
      assert.equal(nowCalls, 0)
      assert.equal(sleepCalls, 0)
    } finally {
      group.release()
      await operation.catch(() => {})
    }
  })
}

function createChildSource(ignoresTerm) {
  const termHandler = ignoresTerm ? "process.on('SIGTERM', () => {})" : ''
  // 소유 detached group의 독립 안전장치: test runner가 강제 종료돼도 12초 내 정리된다.
  const source = `
${termHandler}
setTimeout(() => process.kill(-process.pid, 'SIGKILL'), 12000)
setInterval(() => {}, 1000)
process.send('ready')
`

  return source
}

function isGroupAbsent(pid) {
  try {
    process.kill(-pid, 0)

    return false
  } catch (error) {
    const isAbsent = error.code === 'ESRCH'
    if (isAbsent) {
      return true
    }
    throw error
  }
}

for (const ignoresTerm of [false, true]) {
  const behavior = ignoresTerm
    ? 'TERM을 거부하면 KILL로 정리한 뒤 실패한다'
    : 'TERM으로 정상 종료한다'
  test(`실제 Node detached child가 ${behavior}`, async (context) => {
    const source = createChildSource(ignoresTerm)
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
      detached: true,
      stdio: ['ignore', 'ignore', 'inherit', 'ipc']
    })
    const exited = once(child, 'exit')
    const ready = once(child, 'message')
    try {
      const startup = await settleWithin({ operation: ready, deadlineMs: 2000 })
      assert.equal(startup.status, 'fulfilled', 'Synthetic child must install its handler first')
      const outcome = await settleWithin({
        operation: stopOwnedProcessGroup({ child, exited }),
        deadlineMs: 8000
      })
      const expectedStatus = ignoresTerm ? 'rejected' : 'fulfilled'
      assert.equal(
        outcome.status,
        expectedStatus,
        'Real Node termination must settle before safety cleanup'
      )
      const expectedSignal = ignoresTerm ? 'SIGKILL' : 'SIGTERM'
      assert.equal(child.signalCode, expectedSignal)
      if (ignoresTerm) {
        assert.match(outcome.error.message, /exceeded the SIGTERM grace period/)
      }
      const hasNoGroup = isGroupAbsent(child.pid)
      assert.ok(hasNoGroup, 'Child exit alone is not group cleanup')
    } finally {
      const hasGroup = !isGroupAbsent(child.pid)
      if (hasGroup) {
        process.kill(-child.pid, 'SIGKILL')
      }
      const cleanup = await settleWithin({ operation: exited, deadlineMs: 2000 })
      assert.equal(cleanup.status, 'fulfilled', 'Safety cleanup must reap the owned child')
      const hasNoGroup = isGroupAbsent(child.pid)
      assert.ok(hasNoGroup, 'Safety cleanup must leave no owned group')
      context.diagnostic(`owned group ${child.pid}: absent; safety KILL: ${hasGroup}`)
    }
  })
}
