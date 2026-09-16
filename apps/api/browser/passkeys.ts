/*!
 * QR rendering: qrcode 1.5.4 (https://github.com/soldair/node-qrcode)
The MIT License (MIT)

Copyright (c) 2012 Ryan Day

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 * QR path optimization: dijkstrajs 1.0.3 (https://github.com/andrewhayward/dijkstra)
Dijkstra path-finding functions. Adapted from the Dijkstar Python project.

Copyright (C) 2008
  Wyatt Baldwin <self@wyattbaldwin.com>
  All rights reserved

Licensed under the MIT license.

  http://www.opensource.org/licenses/mit-license.php

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */
import QRCode from 'qrcode'
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
const main = document.querySelector('main')!
const requestId = main.dataset.requestId!
const phone = main.dataset.view === 'phone'
const management = main.dataset.purpose === 'manage'
let polling: ReturnType<typeof setTimeout> | undefined
let qrExpiry = 0
let qrGeneration = 0
let qrActive = false
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
  element('qr-entry').hidden = true
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
  stopQr()
  for (const id of ['qr-entry', 'phone-consent', 'cancel']) {
    const section = document.getElementById(id)
    if (section) {
      section.hidden = true
    }
  }
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
  if (!phone && !management) {
    stopQr()
    await api('direct')
  }
  const options = await api(phone ? 'phone-options' : 'options', { operation })
  const response =
    operation === 'authenticate'
      ? await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON })
      : await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON })
  const result = await api(phone ? 'phone-verify' : 'verify', { response })
  if (result.phoneVerified) {
    element('entry').hidden = true
    element('phone-consent').hidden = false
    element('phone-account').textContent = `로그인할 계정: ${result.nickname}`
    status.textContent =
      '아직 PC에 로그인되지 않았습니다. 직접 시작한 요청인지 확인하고 승인하세요.'
  } else if (result.managed) {
    await showKeys()
    status.textContent =
      operation === 'add' ? '예비 패스키를 추가했습니다.' : '관리할 패스키를 선택해 주세요.'
  } else {
    showReturn(result.returnUrl)
  }
}

function showReturn(returnUrl: string) {
  stopQr()
  const url = new URL(returnUrl)
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
  element('cancel').hidden = true
  element('qr-entry').hidden = true
  status.textContent = '앱으로 돌아가 로그인을 완료해 주세요.'
  ended = true
}

if (!browserSupportsWebAuthn()) {
  for (const id of ['authenticate', 'register', 'add']) {
    const button = document.getElementById(id) as HTMLButtonElement | null
    if (button) {
      button.disabled = true
      button.dataset.permanentlyDisabled = 'true'
    }
  }
  status.textContent = phone
    ? '패스키를 지원하는 Safari 또는 Chrome에서 열어 주세요.'
    : '휴대폰 QR을 이용해 주세요.'
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

function stopQr() {
  clearTimeout(polling)
  qrGeneration += 1
  qrActive = false
  for (const id of ['qr-panel', 'pc-consent', 'direct']) {
    const section = document.getElementById(id)
    if (section) {
      section.hidden = true
    }
  }
}

async function pollQr(generation: number) {
  if (!qrActive || ended || generation !== qrGeneration) {
    return
  }
  if (Date.now() >= qrExpiry) {
    stopQr()
    status.textContent = '로그인 시간이 지났습니다. LDB 앱에서 다시 로그인해 주세요.'
    return
  }
  try {
    if (!document.hidden && !busy) {
      const result = await api('status')
      if (generation !== qrGeneration || ended) {
        return
      }
      if (result.approved) {
        element('qr-panel').hidden = true
        element('entry').hidden = true
        element('pc-consent').hidden = false
        element('account').textContent =
          `휴대폰에서 승인한 계정: ${result.nickname}. 본인 계정인지 확인하세요.`
        status.textContent = '이 계정으로 PC에 로그인할까요?'
        return
      }
    }
    polling = setTimeout(() => void pollQr(generation), 5000)
  } catch (error) {
    if (generation !== qrGeneration) {
      return
    }
    stopQr()
    status.textContent =
      error instanceof Error ? error.message : '연결을 확인하고 QR을 다시 생성해 주세요.'
  }
}

const qrButton = document.getElementById('qr-start')
if (qrButton) {
  qrButton.onclick = () =>
    run(async () => {
      stopQr()
      let phoneUrl: string
      if (management) {
        phoneUrl = new URL('/auth/passkeys/manage', location.origin).href
        element('qr-help').textContent =
          '휴대폰 카메라로 스캔하고 패스키로 인증하세요. 키 관리는 휴대폰에서 완료됩니다.'
      } else {
        const result = await api('qr')
        phoneUrl = result.phoneUrl
        qrExpiry = Date.parse(result.expiresAt)
        element('confirmation').textContent = result.confirmationCode
        element('qr-expiry').textContent =
          `${new Date(qrExpiry).toLocaleTimeString()}까지 유효 · 새 QR을 만들면 이전 QR은 취소됩니다.`
        element('qr-help').textContent =
          '휴대폰 카메라로 스캔한 뒤 두 화면의 확인 번호를 비교하세요.'
        qrActive = true
      }
      const url = new URL(phoneUrl)
      if (url.origin !== location.origin || url.protocol !== 'https:') {
        throw new Error('QR 주소를 확인하지 못했습니다.')
      }
      await QRCode.toCanvas(element<HTMLCanvasElement>('qr'), phoneUrl, { width: 280, margin: 4 })
      element('qr-panel').hidden = false
      element('entry').hidden = true
      element('direct').hidden = false
      qrButton.textContent = management ? '관리 QR 다시 표시' : '새 QR 코드 만들기'
      status.textContent = '휴대폰에서 계속해 주세요.'
      if (!management) {
        polling = setTimeout(() => void pollQr(qrGeneration), 5000)
      }
    })
}
const claim = document.getElementById('claim')
if (claim) {
  claim.onclick = () =>
    run(async () => {
      const result = await api('claim')
      showReturn(result.returnUrl)
    })
}
const approve = document.getElementById('approve')
if (approve) {
  approve.onclick = () =>
    run(async () => {
      await api('phone-approve')
      finish(
        '승인했습니다. PC의 LDB 창에서 계정을 확인하고 로그인을 완료하세요. 이 창은 닫아도 됩니다.'
      )
    })
}
const cancel = document.getElementById('cancel')
if (cancel) {
  cancel.onclick = () =>
    run(async () => {
      await api(phone ? 'phone-cancel' : 'cancel')
      finish('로그인을 취소했습니다. 이 창을 닫아 주세요.')
    })
}
// A closed window cannot retain a usable PC grant. This best-effort request also
// invalidates the phone flow; expiry and the desktop verifier remain authoritative.
window.addEventListener('pagehide', () => {
  if (ended || management || phone) {
    return
  }
  void fetch('/auth/passkeys/cancel', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId })
  }).catch(() => {})
})

const direct = document.getElementById('direct')
if (direct) {
  direct.onclick = () =>
    run(async () => {
      if (!management) {
        await api('direct')
      }
      stopQr()
      element('entry').hidden = false
      status.textContent = '이 기기의 패스키 또는 보안 키로 인증해 주세요.'
    })
}
