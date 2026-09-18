import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import '@seed-design/css/base.css'
import '../../../packages/ui/foundation.css'
import './passkeys.css'
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
const phone = root.dataset.view === 'phone'
const management = root.dataset.purpose === 'manage'
const confirmationCode = root.dataset.confirmationCode
const supportsPasskeys = browserSupportsWebAuthn()
const primaryButton = actionButton({ variant: 'neutralSolid', size: 'large' })
const secondaryButton = actionButton({ variant: 'neutralOutline', size: 'large' })
const removeButton = actionButton({ variant: 'neutralOutline', size: 'medium' })

type Passkey = { id: string; createdAt: string; lastUsedAt: string | null; current: boolean }
type Qr = { phoneUrl: string; confirmationCode?: string; expiresAt?: string }
type Verification =
  { phoneVerified: true; nickname: string } | { managed: true } | { returnUrl: string }
type Screen =
  | { kind: 'entry' }
  | { kind: 'signup' }
  | { kind: 'qr'; qr: Qr; signup: boolean }
  | { kind: 'pc-consent'; nickname: string }
  | { kind: 'phone-consent'; nickname: string }
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

function QrCode({ url, onError }: { url: string; onError: (message: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let active = true
    void QRCode.toCanvas(canvas.current!, url, { width: 280, margin: 4 }).catch(() => {
      if (active) {
        onError('QR 코드를 표시하지 못했습니다. 다시 생성해 주세요.')
      }
    })
    return () => {
      active = false
    }
  }, [url, onError])
  return <canvas id="qr" ref={canvas} aria-label="휴대폰 카메라로 스캔할 QR 코드" />
}

function PasskeyPage() {
  const [screen, setScreen] = useState<Screen>({ kind: 'entry' })
  const [status, setStatus] = useState(
    supportsPasskeys
      ? ''
      : phone
        ? '패스키를 지원하는 Safari 또는 Chrome에서 열어 주세요.'
        : '휴대폰 QR을 이용해 주세요.'
  )
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [qrCreated, setQrCreated] = useState(false)
  // Refs guard events and in-flight responses before React commits the next render.
  const busyRef = useRef(false)
  const endedRef = useRef(false)
  const qrGeneration = useRef(0)
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

  useEffect(() => {
    if (screen.kind !== 'qr' || management) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen.kind !== 'qr' || !screen.qr.expiresAt) {
      return
    }
    const expiresAt = Date.parse(screen.qr.expiresAt)
    const generation = qrGeneration.current
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const isCurrent = () => active && generation === qrGeneration.current && !endedRef.current
    async function poll() {
      if (!isCurrent()) {
        return
      }
      if (Date.now() >= expiresAt) {
        setNow(Date.now())
        setStatus('인증 시간이 만료됐어요. 창을 닫고 LDB 앱에서 다시 로그인해 주세요.')
        return
      }
      try {
        if (!document.hidden && !busyRef.current) {
          const result = await api<{ approved: false } | { approved: true; nickname: string }>(
            'status'
          )
          if (!isCurrent()) {
            return
          }
          if (result.approved) {
            setScreen({ kind: 'pc-consent', nickname: result.nickname })
            setStatus('이 계정으로 PC에 로그인할까요?')
            return
          }
        }
        timer = setTimeout(() => void poll(), 5000)
      } catch (error) {
        if (!isCurrent()) {
          return
        }
        setScreen({ kind: 'entry' })
        setStatus(
          error instanceof Error ? error.message : '연결을 확인하고 QR을 다시 생성해 주세요.'
        )
      }
    }
    timer = setTimeout(() => void poll(), 5000)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [screen])

  useEffect(() => {
    // Best-effort cancellation on close; expiry and the desktop verifier remain authoritative.
    function cancelOnClose() {
      if (endedRef.current || management || phone) {
        return
      }
      void fetch('/auth/passkeys/cancel', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      }).catch(() => {})
    }
    window.addEventListener('pagehide', cancelOnClose)
    return () => window.removeEventListener('pagehide', cancelOnClose)
  }, [])

  function stopQr() {
    qrGeneration.current += 1
    setScreen({ kind: 'entry' })
  }

  function finish(message: string) {
    endedRef.current = true
    qrGeneration.current += 1
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
      setStatus(
        error instanceof Error && error.name === 'NotAllowedError'
          ? '인증이 취소되었거나 시간이 지났습니다. 다시 시도해 주세요.'
          : error instanceof Error
            ? error.message
            : '인증을 완료하지 못했습니다. 다시 시도해 주세요.'
      )
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
    if (
      !['ldb:', 'ldb.dev:'].includes(url.protocol) ||
      url.host !== 'auth' ||
      url.pathname !== '/callback'
    ) {
      throw new Error('앱 복귀 주소를 확인하지 못했습니다.')
    }
    endedRef.current = true
    qrGeneration.current += 1
    setScreen({ kind: 'complete', returnUrl: url.href })
    setStatus('앱으로 돌아가 로그인을 완료해 주세요.')
  }

  async function authenticate(operation: 'register' | 'authenticate' | 'add') {
    if (!phone && !management) {
      qrGeneration.current += 1
      await api('direct')
    }
    const action = phone ? 'phone-options' : 'options'
    const response =
      operation === 'authenticate'
        ? await startAuthentication({
            optionsJSON: await api<PublicKeyCredentialRequestOptionsJSON>(action, { operation })
          })
        : await startRegistration({
            optionsJSON: await api<PublicKeyCredentialCreationOptionsJSON>(action, { operation })
          })
    const result = await api<Verification>(phone ? 'phone-verify' : 'verify', { response })
    if ('phoneVerified' in result) {
      setScreen({ kind: 'phone-consent', nickname: result.nickname })
      setStatus('아직 PC에 로그인되지 않았습니다. 직접 시작한 요청인지 확인하고 승인하세요.')
    } else if ('managed' in result) {
      await showKeys()
      setStatus(
        operation === 'add' ? '예비 패스키를 추가했습니다.' : '관리할 패스키를 선택해 주세요.'
      )
    } else {
      showReturn(result.returnUrl)
    }
  }

  async function generateQr(signup = false) {
    if (screen.kind === 'qr' || screen.kind === 'pc-consent') {
      stopQr()
    } else {
      qrGeneration.current += 1
    }
    const qr = management
      ? { phoneUrl: new URL('/auth/passkeys/manage', location.origin).href }
      : await api<Qr>('qr')
    const url = new URL(qr.phoneUrl)
    if (url.origin !== location.origin || url.protocol !== 'https:') {
      throw new Error('QR 주소를 확인하지 못했습니다.')
    }
    setNow(Date.now())
    setScreen({ kind: 'qr', qr, signup })
    setQrCreated(true)
    setStatus('')
  }

  async function removeKey(key: Passkey) {
    if (!window.confirm('이 패스키의 로그인 권한을 삭제할까요? 이미 로그인한 기기는 유지됩니다.')) {
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

  const ended = screen.kind === 'ended' || screen.kind === 'complete'
  const signup = screen.kind === 'signup'
  const desktop = !phone && !management
  const showQrEntry = management && !ended && screen.kind !== 'management'
  const remaining =
    screen.kind === 'qr' && screen.qr.expiresAt
      ? Math.max(0, Math.ceil((Date.parse(screen.qr.expiresAt) - now) / 1000))
      : null
  const expired = remaining === 0
  return (
    <div className={desktop ? 'auth-screen' : undefined} data-screen={screen.kind}>
      {!signup && (
        <>
          {!desktop && <small>LDB ACCOUNT</small>}
          <h1>{management ? '패스키 관리' : phone ? 'PC의 LDB에 로그인' : '로그인'}</h1>
        </>
      )}
      {signup && (
        <section id="signup" aria-labelledby="signup-heading">
          <h1 id="signup-heading" ref={signupHeading} tabIndex={-1}>
            회원가입
          </h1>
          <p className="signup-intro">
            아이디와 비밀번호 없이 가입해요.
            <br />
            기기의 인증 안내에 따라 패스키를 만들어 주세요.
          </p>
          <div className="signup-notice">
            <h2>이미 계정이 있나요?</h2>
            <p>
              기존 패스키로 로그인해 주세요.
              <br />
              새로 가입하면 새로운 계정이 만들어져요.
            </p>
          </div>
          <div className="signup-actions">
            {!phone && (
              <button
                id="signup-phone"
                className={primaryButton}
                disabled={busy}
                onClick={() => void run(() => generateQr(true))}
              >
                휴대폰으로 회원가입
              </button>
            )}
            <button
              id="signup-passkey"
              className={primaryButton}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('register'))}
            >
              패스키로 회원가입
            </button>
          </div>
          <p className="signup-recovery">
            모든 패스키를 잃으면 계정을 복구할 수 없어요.
            <br />
            가입 후 패스키 관리에서 예비 패스키를 추가해 주세요.
          </p>
        </section>
      )}
      {phone && (
        <section>
          <p>
            직접 시작한 PC 로그인만 진행하세요. 메시지로 받은 QR이나 다른 사람이 보낸 QR은 승인하지
            마세요.
          </p>
          <p>PC와 같은 확인 번호인지 확인하세요.</p>
          <h2 id="phone-confirmation" className="confirmation">
            {confirmationCode}
          </h2>
        </section>
      )}
      {desktop && screen.kind === 'qr' && (
        <section id="qr-panel" aria-label="휴대폰으로 인증">
          <QrCode url={screen.qr.phoneUrl} onError={setStatus} />
          <h2 id="confirmation" className="confirmation">
            {screen.qr.confirmationCode}
          </h2>
          <p id="qr-expiry" className={expired ? 'expired' : undefined} role="timer">
            {expired
              ? '0분 0초 · 인증 시간이 만료됐어요'
              : `${Math.floor((remaining ?? 0) / 60)}분 ${(remaining ?? 0) % 60}초까지 인증 가능해요`}
          </p>
          <p className="qr-warning">이 QR코드를 절대 공유하지 마세요.</p>
          {screen.signup && (
            <p className="qr-signup-help">휴대폰에서 ‘새 계정 만들기’를 선택해 가입해 주세요.</p>
          )}
          <button
            id="qr-start"
            className={primaryButton}
            disabled={busy || expired}
            onClick={() => void run(() => generateQr(screen.signup))}
          >
            새 QR 코드 만들기
          </button>
        </section>
      )}
      {desktop && screen.kind === 'pc-consent' && (
        <section id="pc-consent">
          <p id="account">휴대폰에서 승인한 계정: {screen.nickname}. 본인 계정인지 확인하세요.</p>
          <button
            id="claim"
            className={primaryButton}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await api<{ returnUrl: string }>('claim')
                showReturn(result.returnUrl)
              })
            }
          >
            이 계정으로 PC 로그인
          </button>
        </section>
      )}
      {showQrEntry && (
        <section id="qr-entry">
          <button
            id="qr-start"
            className={primaryButton}
            disabled={busy}
            onClick={() => void run(() => generateQr())}
          >
            {qrCreated ? '관리 QR 다시 표시' : '휴대폰으로 패스키 관리'}
          </button>
          {screen.kind === 'qr' && (
            <div id="qr-panel">
              <QrCode url={screen.qr.phoneUrl} onError={setStatus} />
              <p id="qr-help">
                휴대폰 카메라로 스캔하고 패스키로 인증하세요. 키 관리는 휴대폰에서 완료됩니다.
              </p>
              <small>QR을 공유하지 마세요.</small>
              <button
                id="direct"
                className={secondaryButton}
                disabled={busy}
                onClick={() => {
                  stopQr()
                  setStatus('이 기기의 패스키 또는 보안 키로 인증해 주세요.')
                }}
              >
                이 기기의 패스키 사용
              </button>
            </div>
          )}
        </section>
      )}
      {screen.kind === 'entry' && (
        <section id="entry">
          <p>
            {management ? (
              '관리할 계정의 패스키로 다시 인증해 주세요.'
            ) : phone ? (
              '휴대폰의 패스키로 본인 계정을 확인하세요.'
            ) : (
              <>
                아이디와 비밀번호 없이 로그인해요.
                <br />
                패스키가 없으면 휴대폰을 사용할 수 있어요.
              </>
            )}
          </p>
          <div className={desktop ? 'login-actions' : undefined}>
            {desktop && (
              <button
                id="qr-start"
                className={primaryButton}
                disabled={busy}
                onClick={() => void run(() => generateQr())}
              >
                휴대폰으로 로그인
              </button>
            )}
            <button
              id="authenticate"
              className={primaryButton}
              disabled={busy || !supportsPasskeys}
              onClick={() => void run(() => authenticate('authenticate'))}
            >
              {management ? '패스키로 인증하기' : '패스키로 로그인'}
            </button>
          </div>
          {!management && (
            <button
              id="register"
              className={secondaryButton}
              disabled={busy}
              onClick={() => {
                setStatus(
                  supportsPasskeys
                    ? ''
                    : phone
                      ? '패스키를 지원하는 Safari 또는 Chrome에서 열어 주세요.'
                      : '휴대폰 QR을 이용해 주세요.'
                )
                setScreen({ kind: 'signup' })
              }}
            >
              새 계정 만들기
            </button>
          )}
        </section>
      )}
      {screen.kind === 'phone-consent' && (
        <section id="phone-consent">
          <p>확인 번호가 같은 PC의 LDB 로그인을 승인할까요?</p>
          <p id="phone-account">로그인할 계정: {screen.nickname}</p>
          <button
            id="approve"
            className={primaryButton}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api('phone-approve')
                finish(
                  '승인했습니다. PC의 LDB 창에서 계정을 확인하고 로그인을 완료하세요. 이 창은 닫아도 됩니다.'
                )
              })
            }
          >
            PC 로그인 승인
          </button>
        </section>
      )}
      {!management && !ended && (
        <button
          id="cancel"
          className={desktop || signup ? removeButton : secondaryButton}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              qrGeneration.current += 1
              try {
                await api(phone ? 'phone-cancel' : 'cancel')
                finish('로그인을 취소했습니다. 이 창을 닫아 주세요.')
              } catch {
                finish('인증을 중단했습니다. 이 창을 닫아 주세요.')
              }
              if (desktop || signup) {
                window.close()
              }
            })
          }
        >
          {desktop || signup ? '닫기' : '로그인 취소'}
        </button>
      )}
      {screen.kind === 'management' && (
        <section id="management">
          <p>예비 패스키를 추가해 두세요. 모든 패스키를 잃으면 계정을 복구할 수 없습니다.</p>
          <ul id="keys">
            {screen.keys.map((key, index) => (
              <li key={key.id}>
                <strong>
                  패스키 {index + 1}
                  {key.current ? ' · 지금 사용 중' : ''}
                </strong>
                <p>
                  등록: {new Date(key.createdAt).toLocaleString()} · 최근 사용:{' '}
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : '아직 없음'}
                </p>
                <button
                  className={removeButton}
                  disabled={busy || screen.keys.length === 1}
                  onClick={() => void run(() => removeKey(key))}
                >
                  {screen.keys.length === 1 ? '마지막 패스키는 삭제할 수 없습니다' : '삭제'}
                </button>
              </li>
            ))}
          </ul>
          <button
            id="add"
            className={primaryButton}
            disabled={busy || !supportsPasskeys}
            onClick={() => void run(() => authenticate('add'))}
          >
            예비 패스키 추가
          </button>
          <p>
            여기서 삭제해도 이미 로그인한 기기는 로그아웃되지 않으며, 기기의 패스키 저장소에서도
            별도로 삭제해야 합니다.
          </p>
          <button
            id="end"
            className={secondaryButton}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api('end')
                finish('패스키 관리를 마쳤습니다. 이 창을 닫아도 됩니다.')
              })
            }
          >
            관리 마치기
          </button>
        </section>
      )}
      {screen.kind === 'complete' && (
        <section id="complete">
          <h2>인증을 완료했습니다</h2>
          <a id="return" className={`action ${primaryButton}`} href={screen.returnUrl}>
            LDB 앱으로 돌아가기
          </a>
          <p>앱 복귀 링크는 1분 이내에 사용해 주세요.</p>
          <p>예비 패스키는 LDB 앱의 패스키 관리에서 추가할 수 있어요.</p>
        </section>
      )}
      <p id="status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  )
}

createRoot(root).render(<PasskeyPage />)
