import { Typo } from '@dfragon/ui/typo'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@dfragon/ui/tokens.css'
import '../../../packages/ui/foundation.css'
import * as stylex from '@stylexjs/stylex'
import { styles } from './passkeys.style'
import { parseReturnTarget } from './return-target'
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn
} from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser'

const root = document.querySelector<HTMLElement>('main')!
const requestId = root.dataset.requestId!
const management = root.dataset.purpose === 'manage'
// 앱에서 다시 시작하라는 안내는 Desktop 로그인에만 맞다. OCR과 관리 화면은 앱 로그인이 아니다.
const isDesktopLogin = !management && (root.dataset.webReturnUrl ?? '') === ''
const supportsPasskeys = browserSupportsWebAuthn()
const LOGIN_RESTART_MESSAGE = '앱에서 새 로그인을 시작하세요.'
const LOGIN_REQUEST_INVALID_CODE = 'LOGIN_REQUEST_INVALID'

class PasskeyRequestError extends Error {
  readonly code: string | undefined

  constructor(message: string, code: unknown) {
    super(message)
    this.code = typeof code === 'string' ? code : undefined
  }
}

type Status = { message: string; code?: string }

type Passkey = {
  id: string
  rpId: string
  createdAt: string
  lastUsedAt: string | null
  current: boolean
}
type Verification = { managed: true } | { returnUrl: string }
type Screen =
  | { kind: 'entry' }
  | { kind: 'management'; keys: Passkey[] }
  | { kind: 'complete'; returnUrl: string }
  | { kind: 'ended' }

async function api<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`/auth/passkeys/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, ...values }),
    redirect: 'error'
  })
  const body = await response.json()
  if (!response.ok) {
    const message = body.error?.message ?? '요청을 처리하지 못했습니다.'
    const failureMessage =
      isDesktopLogin && body.error?.code === LOGIN_REQUEST_INVALID_CODE
        ? `${message}\n${LOGIN_RESTART_MESSAGE}`
        : message
    throw new PasskeyRequestError(failureMessage, body.error?.code)
  }

  return body
}

type PanelTone = 'default' | 'danger' | 'success'

const CLOSE_COUNTDOWN_SECONDS = 5
const PANEL_CORNERS = [
  styles.cornerTopLeft,
  styles.cornerTopRight,
  styles.cornerBottomLeft,
  styles.cornerBottomRight
]
const CORNER_TONE_STYLES = {
  default: null,
  danger: styles.cornerDanger,
  success: styles.cornerSuccess
} satisfies Record<PanelTone, unknown>

function PanelCorners({ tone }: { tone: PanelTone }) {
  const toneStyle = CORNER_TONE_STYLES[tone]

  return PANEL_CORNERS.map((position, index) => (
    <span key={index} aria-hidden="true" {...stylex.props(styles.corner, position, toneStyle)} />
  ))
}

/** 숫자는 1초마다 줄이고 막대는 같은 5초 CSS 애니메이션으로 줄인다. 둘 다 화면에 들어올 때 시작한다. */
function CloseCountdown() {
  const [remaining, setRemaining] = useState(CLOSE_COUNTDOWN_SECONDS)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(value - 1, 0))
    }, 1000)
    const stop = window.setTimeout(
      () => window.clearInterval(timer),
      CLOSE_COUNTDOWN_SECONDS * 1000
    )

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(stop)
    }
  }, [])

  return (
    <>
      <p
        role="timer"
        aria-label={`${CLOSE_COUNTDOWN_SECONDS}초 뒤에 페이지가 닫힙니다`}
        {...stylex.props(styles.countdown)}
      >
        <span aria-hidden="true" {...stylex.props(styles.countdownNumber)}>
          {remaining}
        </span>
        초 뒤에 페이지가 닫힙니다.
      </p>
      <div aria-hidden="true" {...stylex.props(styles.closeBar)}>
        <i {...stylex.props(styles.closeBarFill)} />
      </div>
    </>
  )
}

function PasskeyPage() {
  const [screen, setScreen] = useState<Screen>({
    kind: 'entry'
  })
  const unsupportedMessage = '패스키를 지원하는 브라우저에서 열어 주세요.'
  const [status, setStatus] = useState<Status>({
    message: supportsPasskeys ? '' : unsupportedMessage
  })
  const [busy, setBusy] = useState(false)
  // Refs guard events and in-flight responses before React commits the next render.
  const busyRef = useRef(false)
  const endedRef = useRef(false)

  useEffect(() => {
    if (screen.kind === 'complete') {
      location.assign(screen.returnUrl)
    }
  }, [screen])

  function finish(message: string) {
    endedRef.current = true
    setScreen({ kind: 'ended' })
    setStatus({ message })
  }

  async function run(operation: () => Promise<void>) {
    if (busyRef.current || endedRef.current) {
      return
    }
    busyRef.current = true
    setBusy(true)
    setStatus({ message: '기기의 인증 안내를 확인해 주세요.' })
    try {
      await operation()
    } catch (error) {
      let message: string
      if (error instanceof Error && error.name === 'NotAllowedError') {
        message = '인증이 취소되었거나 시간이 지났습니다. 다시 시도해 주세요.'
      } else if (error instanceof Error) {
        message = error.message
      } else {
        message = '인증을 완료하지 못했습니다. 다시 시도해 주세요.'
      }
      const code = error instanceof PasskeyRequestError ? error.code : undefined
      setStatus({ message, code })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function showKeys() {
    const result = await api<{ keys: Passkey[] }>('list')
    setScreen({ kind: 'management', keys: result.keys })
  }

  function showReturn(returnUrl: string) {
    const target = parseReturnTarget(returnUrl, root.dataset.webReturnUrl)
    if (target.kind === 'web') {
      endedRef.current = true
      location.assign(target.href)

      return
    }
    endedRef.current = true
    setScreen({ kind: 'complete', returnUrl: target.href })
    setStatus({ message: '' })
  }

  async function authenticate(operation: 'register' | 'authenticate' | 'add') {
    const response =
      operation === 'authenticate'
        ? await startAuthentication({
            optionsJSON: await api<PublicKeyCredentialRequestOptionsJSON>('options', { operation })
          })
        : await startRegistration({
            optionsJSON: await api<PublicKeyCredentialCreationOptionsJSON>('options', { operation })
          })
    const result = await api<Verification>('verify', { response })
    if ('managed' in result) {
      await showKeys()
      const message =
        operation === 'add' ? '예비 패스키를 추가했습니다.' : '관리할 패스키를 선택해 주세요.'
      setStatus({ message })
    } else {
      showReturn(result.returnUrl)
    }
  }

  async function removeKey(key: Passkey) {
    if (
      !window.confirm(
        '이 패스키의 로그인 권한을 삭제하시겠습니까? 이미 로그인한 기기는 유지됩니다.'
      )
    ) {
      return
    }
    const outcome = await api<{ ended?: boolean }>('remove', { credentialId: key.id })
    if (outcome.ended) {
      finish(
        '현재 인증에 사용한 패스키를 삭제했습니다. 관리하려면 다른 패스키로 다시 인증해 주세요.'
      )
    } else {
      await showKeys()
      setStatus({ message: '패스키를 삭제했습니다.' })
    }
  }

  const expired = status.code === LOGIN_REQUEST_INVALID_CODE
  let tone: PanelTone = 'default'
  if (screen.kind === 'complete') {
    tone = 'success'
  } else if (expired) {
    tone = 'danger'
  }

  return (
    <div {...stylex.props(styles.page)} data-screen={screen.kind}>
      <section {...stylex.props(styles.panel, !management && styles.centered)}>
        <PanelCorners tone={tone} />
        {management ? (
          <>
            <div {...stylex.props(styles.brand)}>
              <img
                {...stylex.props(styles.icon)}
                src="/auth/passkeys/icon.png"
                width="20"
                height="20"
                alt=""
              />
              <Typo.caption as="small" {...stylex.props(styles.keepWords)}>
                DFragon Account
              </Typo.caption>
            </div>
            <Typo.h3 as="h1" {...stylex.props(styles.heading)}>
              패스키 관리
            </Typo.h3>
          </>
        ) : (
          <>
            <div {...stylex.props(styles.mark)}>
              <i aria-hidden="true" {...stylex.props(styles.markSquare)} />
              DFragon
            </div>
            <h1 {...stylex.props(styles.title)}>로그인</h1>
          </>
        )}
        {screen.kind === 'entry' && management && (
          <section id="entry">
            <Typo.txtM {...stylex.props(styles.paragraph)}>
              관리할 계정의 패스키로 다시 인증해 주세요.
            </Typo.txtM>
            <button
              id="authenticate"
              {...stylex.props(styles.button, styles.control, styles.large, styles.primary)}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('authenticate'))}
            >
              <Typo.txtM as="span" weight={700}>
                패스키로 인증하기
              </Typo.txtM>
            </button>
          </section>
        )}
        {screen.kind === 'entry' && !management && (
          <section id="entry" {...stylex.props(styles.loginActions)}>
            <button
              id="authenticate"
              {...stylex.props(styles.control, styles.loginButton, styles.primary)}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('authenticate'))}
            >
              패스키로 로그인
            </button>
            <button
              id="register"
              {...stylex.props(styles.control, styles.loginButton, styles.filled)}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('register'))}
            >
              새 계정 만들기
            </button>
          </section>
        )}
        {screen.kind === 'management' && (
          <section id="management">
            <Typo.txtM {...stylex.props(styles.paragraph)}>
              예비 패스키를 추가해 두세요. 모든 패스키를 잃으면 계정을 복구할 수 없습니다.
            </Typo.txtM>
            <ul id="keys" {...stylex.props(styles.keys)}>
              {screen.keys.map((key, index) => (
                <li key={key.id} {...stylex.props(styles.key)}>
                  <Typo.txtM as="strong" weight={700}>
                    패스키 {index + 1}
                    {key.current ? ' · 지금 사용 중' : ''}
                  </Typo.txtM>
                  <Typo.txtM {...stylex.props(styles.paragraph)}>
                    주소: {key.rpId} · 등록: {new Date(key.createdAt).toLocaleString()} · 최근 사용:{' '}
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : '아직 없음'}
                  </Typo.txtM>
                  <button
                    {...stylex.props(
                      styles.button,
                      styles.control,
                      styles.medium,
                      styles.secondary
                    )}
                    disabled={busy || screen.keys.length === 1}
                    onClick={() => void run(() => removeKey(key))}
                  >
                    <Typo.txtM as="span" weight={700}>
                      {screen.keys.length === 1 ? '마지막 패스키는 삭제할 수 없습니다' : '삭제'}
                    </Typo.txtM>
                  </button>
                </li>
              ))}
            </ul>
            <button
              id="add"
              {...stylex.props(styles.button, styles.control, styles.large, styles.primary)}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('add'))}
            >
              <Typo.txtM as="span" weight={700}>
                예비 패스키 추가
              </Typo.txtM>
            </button>
            <Typo.txtM {...stylex.props(styles.paragraph)}>
              여기서 삭제해도 이미 로그인한 기기는 로그아웃되지 않으며, 기기의 패스키 저장소에서도
              별도로 삭제해야 합니다.
            </Typo.txtM>
            <button
              id="end"
              {...stylex.props(styles.button, styles.control, styles.large, styles.secondary)}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api('end')
                  finish('패스키 관리를 마쳤습니다. 이 창을 닫아도 됩니다.')
                })
              }
            >
              <Typo.txtM as="span" weight={700}>
                관리 마치기
              </Typo.txtM>
            </button>
          </section>
        )}
        {screen.kind === 'complete' && (
          <section id="complete" {...stylex.props(styles.completeContent)}>
            <p {...stylex.props(styles.completeStatus)}>
              <span aria-hidden="true" {...stylex.props(styles.completeDot)} />
              인증 완료
            </p>
            <CloseCountdown />
          </section>
        )}
        {management ? (
          <Typo.txtM
            id="status"
            role="status"
            aria-live="polite"
            {...stylex.props(styles.paragraph, styles.status)}
          >
            {status.message}
          </Typo.txtM>
        ) : (
          <div
            {...stylex.props(styles.loginStatusRow, status.message === '' && styles.emptyStatusRow)}
          >
            {expired && (
              <span aria-hidden="true" {...stylex.props(styles.alertMark)}>
                !
              </span>
            )}
            <p
              id="status"
              role="status"
              aria-live="polite"
              {...stylex.props(styles.loginStatus, expired && styles.expiredStatus)}
            >
              {status.message}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

createRoot(root).render(<PasskeyPage />)
