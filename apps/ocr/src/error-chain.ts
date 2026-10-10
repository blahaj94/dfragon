/** 5xx 원인 확인용으로 정제한 오류 하나다. 접근 로그에 그대로 JSON으로 쓴다. */
export type ErrorChainEntry = { name: string; code?: string; frames?: string[] }

// 남길 오류 수, 오류마다 남길 stack frame 수와 frame 한 줄의 길이 상한이다.
const MAX_ERROR_CHAIN_LENGTH = 5
const MAX_STACK_FRAMES = 5
const MAX_STACK_FRAME_LENGTH = 300
const STACK_FRAME_PREFIX = '    at '
const ERROR_NAME_PATTERN = /^[A-Za-z_$][\w$]{0,79}$/
// SQLSTATE, Node system error처럼 라이브러리가 정한 식별자 형식만 남긴다.
const ERROR_CODE_PATTERN = /^\w{1,64}$/
const UNNAMED_ERROR = '<unnamed>'
const NON_ERROR = '<non-error>'

/** 응답용 failure를 만들 때 넘기는 option이다. 모양은 표준 `ErrorOptions`와 같다. */
export type FailureOptions = { cause?: unknown }

/**
 * DB, Neople, 인증 서버 오류를 바꾼 응답용 failure의 base class다. `{ cause }`는 표준 ErrorOptions처럼
 * 받지만 원래 오류 object와 message는 보관하지 않고, 그 자리에서 정제한 chain만 `sanitizedCause`에 둔다.
 * 그래서 failure의 `cause`는 비어 있고, failure를 그대로 출력해도 SQL이나 요청 값이 나오지 않는다.
 */
export class SanitizedFailure extends Error {
  readonly sanitizedCause: readonly ErrorChainEntry[] | undefined

  constructor(message: string, options?: FailureOptions) {
    super(message)
    const hasCause = options !== undefined && 'cause' in options
    this.sanitizedCause = hasCause ? sanitizeCause(options.cause) : undefined
  }
}

function sanitizeCause(cause: unknown): readonly ErrorChainEntry[] | undefined {
  try {
    return describeErrorChain(cause)
  } catch {
    // getter가 예외를 던지는 등 정제 결과를 믿을 수 없는 오류는 원인 없이 failure만 남긴다.
    return undefined
  }
}

/**
 * 오류와 그 원인을 바깥쪽부터 정제한다. 오류마다 class 이름, 식별자 형식의 `code`, message를 뺀
 * stack frame만 읽는다. 원인은 `SanitizedFailure`가 정제해 둔 chain과 라이브러리가 붙인 `cause`를 따른다.
 * Getter가 던진 예외는 호출자에게 전달한다.
 */
export function describeErrorChain(error: unknown): ErrorChainEntry[] {
  const chain: ErrorChainEntry[] = []
  let current = error
  while (current != null && chain.length < MAX_ERROR_CHAIN_LENGTH) {
    if (!(current instanceof Error)) {
      // Error가 아닌 값은 문자열, object 원문이 credential을 담을 수 있어 종류 표시만 남긴다.
      chain.push({ name: NON_ERROR })
      break
    }
    chain.push(describeError(current))
    const sanitized = current instanceof SanitizedFailure ? current.sanitizedCause : undefined
    if (sanitized !== undefined) {
      chain.push(...sanitized)
      break
    }
    current = current.cause
  }

  return chain.slice(0, MAX_ERROR_CHAIN_LENGTH)
}

function describeError(error: Error): ErrorChainEntry {
  const { name } = error
  const hasSafeName = typeof name === 'string' && ERROR_NAME_PATTERN.test(name)
  const safeName = hasSafeName ? name : UNNAMED_ERROR
  const entry: ErrorChainEntry = { name: safeName }
  const code: unknown = 'code' in error ? error.code : undefined
  if (typeof code === 'string' && ERROR_CODE_PATTERN.test(code)) {
    entry.code = code
  }
  const frames = readStackFrames(error)
  if (frames.length > 0) {
    entry.frames = frames
  }

  return entry
}

/**
 * Stack은 `name: message` 뒤에 frame이 온다. Message에는 요청 값이 들어갈 수 있으므로 stack 앞부분이
 * 지금의 name, message로 만든 문자열과 정확히 같을 때만 그 뒤의 frame을 읽는다. Stack을 만든 뒤
 * name이나 message가 바뀌어 경계를 알 수 없으면 frame을 남기지 않는다.
 */
function readStackFrames(error: Error): string[] {
  const { name, message, stack } = error
  const canCompare =
    typeof name === 'string' && typeof message === 'string' && typeof stack === 'string'
  if (!canCompare) {
    return []
  }

  const header = formatStackHeader(name, message)
  if (!stack.startsWith(`${header}\n`)) {
    return []
  }

  const frames: string[] = []
  for (const line of stack.slice(header.length + 1).split('\n')) {
    if (!line.startsWith(STACK_FRAME_PREFIX) || frames.length === MAX_STACK_FRAMES) {
      break
    }
    frames.push(
      line.slice(STACK_FRAME_PREFIX.length, STACK_FRAME_PREFIX.length + MAX_STACK_FRAME_LENGTH)
    )
  }

  return frames
}

// V8이 stack 첫 부분을 만드는 규칙과 같다. 빈 name이나 빈 message는 구분자 없이 남는다.
function formatStackHeader(name: string, message: string): string {
  if (name === '') {
    return message
  }

  if (message === '') {
    return name
  }

  return `${name}: ${message}`
}
