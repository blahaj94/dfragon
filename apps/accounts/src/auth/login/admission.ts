import { LOGIN_ERRORS } from '../../constants/login.js'
import { LoginFailure } from '../../errors/login.js'

export const AUTH_ADMISSION = {
  concurrent: 32
} as const

/** Hold capacity until the service settles, including after an HTTP disconnect. */
export class AuthCapacity {
  private active = 0

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= AUTH_ADMISSION.concurrent) {
      throw new LoginFailure(LOGIN_ERRORS.RATE_LIMIT)
    }
    this.active++
    try {
      return await work()
    } finally {
      this.active--
    }
  }
}
