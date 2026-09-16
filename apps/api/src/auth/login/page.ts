import { randomBytes } from 'node:crypto'
import type { LoginAuthorization } from '../../types/login.js'

export function passkeyPage(authorization: LoginAuthorization) {
  const nonce = randomBytes(24).toString('base64')
  // requestId is a server UUID, never HTML or user-provided content.
  const management = authorization.purpose === 'manage'
  return {
    policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    html: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LDB · 패스키</title>
<link rel="stylesheet" href="/auth/passkeys/client.css"><style nonce="${nonce}">main{max-width:480px;margin:8vh auto;padding:32px}h1{font-size:var(--seed-font-size-t8);margin:20px 0}p{line-height:1.7;color:var(--seed-color-fg-neutral-muted);word-break:keep-all}button,a.action{box-sizing:border-box;width:100%;margin:12px 0}li{padding:12px 0;border-bottom:1px solid var(--seed-color-stroke-neutral-muted)}ul{padding:0;list-style:none}#status{min-height:28px}small{line-height:1.6;word-break:keep-all} [hidden]{display:none!important}@media(max-width:560px){main{margin:24px 16px;padding:8px}}</style>
<script nonce="${nonce}" src="/auth/passkeys/client.js" defer></script></head>
<body><main data-request-id="${authorization.requestId}" data-purpose="${authorization.purpose}"><small>LDB ACCOUNT</small><h1>${management ? '패스키 관리' : '패스키로 계속하기'}</h1>
<section id="entry"><p>${management ? '관리할 계정의 패스키로 다시 인증해 주세요.' : '아이디와 비밀번호 없이 로그인하세요. 패스키가 없는 기기에서는 휴대폰을 사용할 수 있어요.'}</p>
<button id="authenticate" class="primary">패스키로 ${management ? '인증하기' : '로그인'}</button>
${management ? '' : '<button id="register">새 계정 만들기</button>'}
<p>휴대폰으로 로그인하려면 인증 창에서 ‘다른 기기’ 또는 QR 코드를 선택하세요. 가까이 있는 두 기기의 Bluetooth를 켜 주세요.</p>
${management ? '' : '<small>새 계정을 만들면 기존 계정과 별개의 계정이 생깁니다. 기존 패스키가 있다면 로그인해 주세요. 모든 패스키를 잃으면 계정을 복구할 수 없습니다.</small>'}</section>
<section id="management" hidden><p>예비 패스키를 추가해 두세요. 모든 패스키를 잃으면 계정을 복구할 수 없습니다.</p><ul id="keys"></ul><button id="add" class="primary">예비 패스키 추가</button><p>여기서 삭제해도 이미 로그인한 기기는 로그아웃되지 않으며, 기기의 패스키 저장소에서도 별도로 삭제해야 합니다.</p><button id="end">관리 마치기</button></section>
<section id="complete" hidden><h2>인증을 완료했습니다</h2><a id="return" class="action">LDB 앱으로 돌아가기</a><p>앱 복귀 링크는 1분 이내에 사용해 주세요.</p><a href="/auth/passkeys/manage" target="_blank" rel="noopener noreferrer">예비 패스키 관리</a></section>
<p id="status" role="status" aria-live="polite"></p><noscript>패스키 인증에는 JavaScript가 필요합니다.</noscript></main></body></html>`
  }
}
