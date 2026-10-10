import { Typo } from '@dfragon/ui/typo'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@seed-design/css/base.css'
import '../../../packages/ui/foundation.css'
import * as stylex from '@stylexjs/stylex'
import { styles } from './passkeys.style'
import { parseReturnTarget } from './return-target'
import { actionButton } from '@seed-design/css/recipes/action-button'
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
const supportsPasskeys = browserSupportsWebAuthn()
const primaryButton = actionButton({ variant: 'neutralSolid', size: 'large' })
const secondaryButton = actionButton({ variant: 'neutralOutline', size: 'large' })
const removeButton = actionButton({ variant: 'neutralOutline', size: 'medium' })

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
  | { kind: 'signup' }
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
    throw new Error(body.error?.message ?? '요청을 처리하지 못했습니다.')
  }

  return body
}

function entryDescription() {
  if (management) {
    return '관리할 계정의 패스키로 다시 인증해 주세요.'
  }

  return (
    <>
      아이디, 비밀번호 없이 패스키로 로그인합니다.
      <br />
      휴대폰 패스키는 브라우저 안내에서 휴대폰을 선택하세요.
    </>
  )
}

function PasskeyPage() {
  const [screen, setScreen] = useState<Screen>({
    kind: 'entry'
  })
  const unsupportedMessage = '패스키를 지원하는 브라우저에서 열어 주세요.'
  const [status, setStatus] = useState(supportsPasskeys ? '' : unsupportedMessage)
  const [busy, setBusy] = useState(false)
  // Refs guard events and in-flight responses before React commits the next render.
  const busyRef = useRef(false)
  const endedRef = useRef(false)
  const signupHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => {
      document.documentElement.dataset.seedColorMode = 'system'
      document.documentElement.dataset.seedUserColorScheme = preference.matches ? 'dark' : 'light'
    }
    updateTheme()
    preference.addEventListener('change', updateTheme)

    return () => preference.removeEventListener('change', updateTheme)
  }, [])

  useEffect(() => {
    if (screen.kind === 'signup') {
      signupHeading.current?.focus()
    }
  }, [screen.kind])

  function finish(message: string) {
    endedRef.current = true
    setScreen({ kind: 'ended' })
    setStatus(message)
  }

  async function run(operation: () => Promise<void>) {
    if (busyRef.current || endedRef.current) {
      return
    }
    busyRef.current = true
    setBusy(true)
    setStatus('기기의 인증 안내를 확인해 주세요.')
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
      setStatus(message)
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
    const url = new URL(returnUrl)
    const target = parseReturnTarget(url, root.dataset.webReturnUrl)
    if (target.kind === 'web') {
      endedRef.current = true
      location.assign(target.href)

      return
    }
    endedRef.current = true
    setScreen({ kind: 'complete', returnUrl: target.href })
    setStatus('')
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
      setStatus(
        operation === 'add' ? '예비 패스키를 추가했습니다.' : '관리할 패스키를 선택해 주세요.'
      )
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
      setStatus('패스키를 삭제했습니다.')
    }
  }

  const signup = screen.kind === 'signup'

  return (
    <div {...stylex.props(styles.page, !management && styles.authPage)} data-screen={screen.kind}>
      {!signup && (
        <>
          {management && (
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
          )}
          <Typo.h3 as="h1" {...stylex.props(styles.heading, !management && styles.authHeading)}>
            {management ? '패스키 관리' : '로그인'}
          </Typo.h3>
        </>
      )}
      {signup && (
        <section id="signup" aria-labelledby="signup-heading">
          <Typo.h3
            as="h1"
            id="signup-heading"
            {...stylex.props(styles.authHeading)}
            ref={signupHeading}
            tabIndex={-1}
          >
            회원가입
          </Typo.h3>
          <Typo.txtM {...stylex.props(styles.paragraph, styles.signupIntro)}>
            아이디, 비밀번호 없이 가입합니다.
            <br />
            브라우저 안내에 따라 패스키를 만드세요.
          </Typo.txtM>
          <div {...stylex.props(styles.signupNotice)}>
            <Typo.txtM as="h2" weight={700} {...stylex.props(styles.noticeHeading)}>
              이미 계정이 있다면
            </Typo.txtM>
            <Typo.txtS {...stylex.props(styles.paragraph, styles.noPadding)}>
              기존 패스키로 로그인하세요.
              <br />
              새로 가입하면 별도 계정이 됩니다.
            </Typo.txtS>
          </div>
          <div {...stylex.props(styles.actions, styles.signupActions)}>
            <button
              id="signup-passkey"
              className={`${primaryButton} ${stylex.props(styles.button, styles.action).className}`}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('register'))}
            >
              <Typo.txtM as="span" weight={700}>
                패스키로 회원가입
              </Typo.txtM>
            </button>
          </div>
          <Typo.txtS {...stylex.props(styles.paragraph, styles.signupRecovery)}>
            패스키를 모두 잃으면 복구할 수 없습니다.
            <br />
            가입 후 예비 패스키를 추가하세요.
          </Typo.txtS>
        </section>
      )}
      {screen.kind === 'entry' && (
        <section id="entry">
          <Typo.txtM {...stylex.props(styles.paragraph, !management && styles.entryDescription)}>
            {entryDescription()}
          </Typo.txtM>
          <div {...stylex.props(!management && styles.actions)}>
            <button
              id="authenticate"
              className={`${primaryButton} ${stylex.props(styles.button, !management && styles.action).className}`}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('authenticate'))}
            >
              <Typo.txtM as="span" weight={700}>
                {management ? '패스키로 인증하기' : '패스키로 로그인'}
              </Typo.txtM>
            </button>
          </div>
          {!management && (
            <button
              id="register"
              className={`${secondaryButton} ${stylex.props(styles.button, styles.register).className}`}
              disabled={busy}
              onClick={() => {
                setStatus(supportsPasskeys ? '' : unsupportedMessage)
                setScreen({ kind: 'signup' })
              }}
            >
              <Typo.txtM as="span" weight={700}>
                새 계정 만들기
              </Typo.txtM>
            </button>
          )}
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
                  className={`${removeButton} ${stylex.props(styles.button).className}`}
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
            className={`${primaryButton} ${stylex.props(styles.button).className}`}
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
            className={`${secondaryButton} ${stylex.props(styles.button).className}`}
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
        <section id="complete">
          <Typo.h6 as="h2" {...stylex.props(styles.completeHeading)}>
            인증 완료
          </Typo.h6>
          <a
            id="return"
            className={`${primaryButton} ${stylex.props(styles.button, styles.returnButton).className}`}
            href={screen.returnUrl}
          >
            <Typo.txtM as="span" weight={700}>
              돌아가기
            </Typo.txtM>
          </a>
        </section>
      )}
      <Typo.txtM
        id="status"
        role="status"
        aria-live="polite"
        {...stylex.props(
          styles.paragraph,
          styles.status,
          !management && status === '' && styles.emptyStatus
        )}
      >
        {status}
      </Typo.txtM>
    </div>
  )
}

createRoot(root).render(<PasskeyPage />)
