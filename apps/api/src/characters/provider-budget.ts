import { neopleSearchFailure } from '../errors/neople-search.js'

export const NEOPLE_BUDGET = { windowMs: 60_000, calls: 600, concurrent: 12 } as const

/** All provider endpoints share this process budget; capacity includes body consumption. */
export class NeopleBudget {
  private readonly starts: number[] = []
  private active = 0

  constructor(private readonly now: () => number = () => performance.now()) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    const now = this.now()
    while (this.starts.length && this.starts[0]! <= now - NEOPLE_BUDGET.windowMs) {
      this.starts.shift()
    }
    if (this.starts.length >= NEOPLE_BUDGET.calls) {
      throw neopleSearchFailure(
        'limited',
        Math.max(1, Math.ceil((this.starts[0]! + NEOPLE_BUDGET.windowMs - now) / 1000))
      )
    }
    if (this.active >= NEOPLE_BUDGET.concurrent) {
      throw neopleSearchFailure('limited', 1)
    }
    this.starts.push(now)
    this.active++
    try {
      return await work()
    } finally {
      this.active--
    }
  }
}

// Runtime uses one Neople API key. Search, sections and catalog factories share this owner.
export const neopleBudget = new NeopleBudget()
