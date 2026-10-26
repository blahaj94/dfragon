import type { MonotonicClock } from './monotonic-clock'

type ScheduledTask = {
  readonly at: number
  readonly callback: () => void
  cancelled: boolean
}

/** 테스트가 시간을 직접 진행하는 시계. `advance`만 만료된 timer를 실행한다. */
export class FakeMonotonicClock implements MonotonicClock {
  monotonicMs = 1_000
  readonly scheduled: ScheduledTask[] = []

  read(): Readonly<{ monotonicMs: number }> {
    return { monotonicMs: this.monotonicMs }
  }

  schedule(delayMs: number, callback: () => void): () => void {
    const task = { at: this.monotonicMs + delayMs, callback, cancelled: false }
    this.scheduled.push(task)

    return () => {
      task.cancelled = true
    }
  }

  advance(milliseconds: number): void {
    this.monotonicMs += milliseconds
    const dueTasks = this.scheduled.filter((task) => !task.cancelled && task.at <= this.monotonicMs)
    for (const task of dueTasks) {
      task.cancelled = true
      task.callback()
    }
  }

  elapseWithoutTimers(milliseconds: number): void {
    this.monotonicMs += milliseconds
  }
}
