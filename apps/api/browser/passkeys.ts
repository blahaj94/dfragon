import '@seed-design/css/base.css'
import '../../../packages/ui/foundation.css'
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

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
for (const button of document.querySelectorAll('button, a.action')) {
  button.classList.add(
    ...actionButton({
      variant:
        button.classList.contains('primary') || button.classList.contains('action')
          ? 'neutralSolid'
          : 'neutralOutline',
      size: 'large'
    }).split(' ')
  )
}
const requestId = document.querySelector('main')!.dataset.requestId!
const status = element('status')
let busy = false
let ended = false

async function api(action: string, values: Record<string, unknown> = {}) {
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

async function showKeys() {
  const result = (await api('list')) as {
    keys: { id: string; createdAt: string; lastUsedAt: string | null; current: boolean }[]
  }
  element('entry').hidden = true
  element('management').hidden = false
  const list = element('keys')
  list.replaceChildren()
  for (const [index, key] of result.keys.entries()) {
    const item = document.createElement('li')
    const title = document.createElement('strong')
    title.textContent = `패스키 ${index + 1}${key.current ? ' · 지금 사용 중' : ''}`
    const detail = document.createElement('p')
    detail.textContent = `등록: ${new Date(key.createdAt).toLocaleString()} · 최근 사용: ${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : '아직 없음'}`
    const remove = document.createElement('button')
    remove.className = actionButton({ variant: 'neutralOutline', size: 'medium' })
    remove.textContent = result.keys.length === 1 ? '마지막 패스키는 삭제할 수 없습니다' : '삭제'
    remove.dataset.permanentlyDisabled = String(result.keys.length === 1)
    remove.disabled = result.keys.length === 1
    remove.onclick = () =>
      run(async () => {
        if (
          !window.confirm('이 패스키의 로그인 권한을 삭제할까요? 이미 로그인한 기기는 유지됩니다.')
        ) {
          return
        }
        const outcome = await api('remove', { credentialId: key.id })
        if (outcome.ended) {
          finish(
            '현재 인증에 사용한 패스키를 삭제했습니다. 관리하려면 다른 패스키로 다시 인증해 주세요.'
          )
        } else {
          await showKeys()
          status.textContent = '패스키를 삭제했습니다.'
        }
      })
    item.append(title, detail, remove)
    list.append(item)
  }
}

function finish(message: string) {
  ended = true
  element('entry').hidden = true
  element('management').hidden = true
  status.textContent = message
}

async function run(operation: () => Promise<void>) {
  if (busy || ended) {
    return
  }
  busy = true
  document.querySelectorAll('button').forEach((button) => {
    button.disabled = true
  })
  status.textContent = '기기의 인증 안내를 확인해 주세요.'
  try {
    await operation()
  } catch (error) {
    status.textContent =
      error instanceof Error && error.name === 'NotAllowedError'
        ? '인증이 취소되었거나 시간이 지났습니다. 다시 시도해 주세요.'
        : error instanceof Error
          ? error.message
          : '인증을 완료하지 못했습니다. 다시 시도해 주세요.'
  } finally {
    busy = false
    document.querySelectorAll('button').forEach((button) => {
      button.disabled = ended || button.dataset.permanentlyDisabled === 'true'
    })
  }
}

async function authenticate(operation: 'register' | 'authenticate' | 'add') {
  const options = await api('options', { operation })
  const response =
    operation === 'authenticate'
      ? await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON })
      : await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON })
  const result = await api('verify', { response })
  if (result.managed) {
    await showKeys()
    status.textContent =
      operation === 'add' ? '예비 패스키를 추가했습니다.' : '관리할 패스키를 선택해 주세요.'
  } else {
    const url = new URL(result.returnUrl)
    if (
      !['ldb:', 'ldb.dev:'].includes(url.protocol) ||
      url.host !== 'auth' ||
      url.pathname !== '/callback'
    ) {
      throw new Error('앱 복귀 주소를 확인하지 못했습니다.')
    }
    element<HTMLAnchorElement>('return').href = url.href
    element('entry').hidden = true
    element('complete').hidden = false
    status.textContent = '앱으로 돌아가 로그인을 완료해 주세요.'
    ended = true
  }
}

if (!browserSupportsWebAuthn()) {
  finish('이 브라우저는 패스키를 지원하지 않습니다. 최신 Chrome, Safari 또는 Edge를 사용해 주세요.')
}
for (const operation of ['authenticate', 'register', 'add'] as const) {
  const button = document.getElementById(operation)
  if (button) {
    button.onclick = () => run(() => authenticate(operation))
  }
}
element('end').onclick = () =>
  run(async () => {
    await api('end')
    finish('패스키 관리를 마쳤습니다. 이 창을 닫아도 됩니다.')
  })
