import {
  NEOPLE_ORIGIN,
  NEOPLE_SEARCH_DEADLINE_MS
} from '../../constants/neople-character-search.js'
import {
  classifyNeopleUpstreamFailure,
  neopleStatusFailure,
  NeopleSearchFailure
} from '../../errors/neople-search.js'
import { CharacterDetailFailure, characterDetailFailure } from '../details/errors.js'
import { NeopleBudget, neopleBudget } from '../provider-budget.js'
import { searchClock } from '../search-admission.js'
import type { SearchClock } from '../types.js'
import type { CharacterIdentity } from '../identity.js'
import { projectCharacterAppearance, type CharacterAppearance } from './project.js'

const MAX_APPEARANCE_BODY_BYTES = 1024 * 1024

export type FetchCharacterAppearance = (
  identity: CharacterIdentity,
  signal: AbortSignal
) => Promise<CharacterAppearance>

interface TransportDependencies {
  fetch: typeof globalThis.fetch
  origin: string
  clock: SearchClock
  budget: NeopleBudget
}

/** body를 직접 읽어 HTTP 중단과 deadline이 합성 stream에도 취소를 전파하게 한다. */
async function readBody(response: Response, signal: AbortSignal): Promise<string> {
  if (response.body === null) {
    return ''
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  let text = ''
  let bytesRead = 0
  try {
    signal.throwIfAborted()
    while (true) {
      const chunk = await reader.read()
      signal.throwIfAborted()
      if (chunk.done) {
        text += decoder.decode()

        return text
      }
      bytesRead += chunk.value.byteLength
      if (bytesRead > MAX_APPEARANCE_BODY_BYTES) {
        throw new CharacterDetailFailure('api')
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}

function makeAdapter(apiKey: string, deps: TransportDependencies): FetchCharacterAppearance {
  return async (identity, requestSignal) => {
    if (requestSignal.aborted) {
      throw new CharacterDetailFailure('internal')
    }
    const controller = new AbortController()
    const expiresAt = deps.clock.now() + NEOPLE_SEARCH_DEADLINE_MS
    let interruption: CharacterDetailFailure | undefined
    let rejectInterrupted!: (failure: CharacterDetailFailure) => void
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectInterrupted = reject
    })
    void interrupted.catch(() => undefined)
    const stop = (failure: CharacterDetailFailure): void => {
      if (interruption !== undefined) {
        return
      }
      interruption = failure
      controller.abort()
      rejectInterrupted(failure)
    }
    const cancel = (): void => stop(new CharacterDetailFailure('internal'))
    const assertActive = (): void => {
      if (deps.clock.now() >= expiresAt) {
        stop(new CharacterDetailFailure('timeout'))
      } else if (requestSignal.aborted) {
        cancel()
      }

      if (interruption !== undefined) {
        throw interruption
      }
    }
    requestSignal.addEventListener('abort', cancel, { once: true })
    const timer = deps.clock.setTimer(
      () => stop(new CharacterDetailFailure('timeout')),
      NEOPLE_SEARCH_DEADLINE_MS
    )
    const load = async (): Promise<CharacterAppearance> => {
      assertActive()
      const path = `/df/servers/${encodeURIComponent(identity.serverId)}/characters/${encodeURIComponent(identity.characterId)}/equip/avatar`
      const response = await deps.fetch(new URL(path, deps.origin), {
        method: 'GET',
        headers: { apikey: apiKey },
        redirect: 'error',
        signal: controller.signal
      })
      try {
        assertActive()
        const text = await readBody(response, controller.signal)
        assertActive()
        let body: unknown
        try {
          body = JSON.parse(text)
        } catch {
          throw neopleStatusFailure(response.status)
        }
        const failure = classifyNeopleUpstreamFailure(body, response.status, response.ok)
        if (failure !== undefined) {
          throw failure
        }
        const appearance = projectCharacterAppearance(identity, body)
        assertActive()

        return appearance
      } finally {
        void response.body?.cancel().catch(() => undefined)
      }
    }
    try {
      assertActive()

      return await deps.budget.run(() => Promise.race([load(), interrupted]))
    } catch (error) {
      assertActive()
      if (error instanceof CharacterDetailFailure) {
        throw error
      }

      if (error instanceof NeopleSearchFailure) {
        throw characterDetailFailure(error)
      }
      throw new CharacterDetailFailure('api')
    } finally {
      deps.clock.clearTimer(timer)
      requestSignal.removeEventListener('abort', cancel)
    }
  }
}

export function createNeopleCharacterAppearance(
  apiKey: string,
  budget = neopleBudget
): FetchCharacterAppearance {
  return makeAdapter(apiKey, {
    fetch: globalThis.fetch,
    origin: NEOPLE_ORIGIN,
    clock: searchClock,
    budget
  })
}

export function createNeopleCharacterAppearanceForTest(
  apiKey: string,
  deps: Partial<TransportDependencies>
): FetchCharacterAppearance {
  return makeAdapter(apiKey, {
    fetch: globalThis.fetch,
    origin: NEOPLE_ORIGIN,
    clock: searchClock,
    budget: new NeopleBudget(),
    ...deps
  })
}
