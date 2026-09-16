import { randomBytes } from 'node:crypto'
import type { LoginAuthorization } from '../../types/login.js'

export function passkeyPage(authorization: LoginAuthorization) {
  const nonce = randomBytes(24).toString('base64')
  // requestId is a server UUID, never HTML or user-provided content.
  const phone = authorization.view === 'phone'
  const management = authorization.purpose === 'manage'
  return {
    policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    html: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LDB · 패스키</title>
<link rel="stylesheet" href="/auth/passkeys/client.css"><style nonce="${nonce}">main{max-width:480px;margin:8vh auto;padding:32px}h1{font-size:var(--seed-font-size-t8);margin:20px 0}p{line-height:1.7;color:var(--seed-color-fg-neutral-muted);word-break:keep-all}canvas{display:block;margin:0 auto;max-width:100%;height:auto}#confirmation{font-variant-numeric:tabular-nums;letter-spacing:.2em}button,a.action{box-sizing:border-box;width:100%;margin:12px 0}li{padding:12px 0;border-bottom:1px solid var(--seed-color-stroke-neutral-muted)}ul{padding:0;list-style:none}#status{min-height:28px}small{line-height:1.6;word-break:keep-all} [hidden]{display:none!important}@media(max-width:560px){main{margin:24px 16px;padding:8px}}</style>
<script nonce="${nonce}" src="/auth/passkeys/client.js" defer></script></head>
<body><main data-request-id="${authorization.requestId}" data-purpose="${authorization.purpose}" data-view="${phone ? 'phone' : 'desktop'}"><small>LDB ACCOUNT</small><h1>${management ? '패스키 관리' : phone ? 'PC의 LDB에 로그인' : 'LDB 로그인'}</h1>
${phone ? `<p>직접 시작한 PC 로그인만 진행하세요. 메시지로 받은 QR이나 다른 사람이 보낸 QR은 승인하지 마세요.</p><p>PC와 같은 확인 번호인지 확인하세요.</p><h2 id="confirmation">${authorization.confirmationCode}</h2>` : `<section id="qr-entry"><button id="qr-start" class="primary">휴대폰으로 ${management ? '패스키 관리' : '로그인'}</button><div id="qr-panel" hidden><canvas id="qr" aria-label="휴대폰 카메라로 스캔할 QR 코드"></canvas><p id="qr-help"></p><h2 id="confirmation"></h2><p id="qr-expiry"></p><small>QR을 공유하지 마세요. 이 방식은 기기 간 거리를 확인하지 않습니다. QR 승인 전에 두 화면의 확인 번호를 비교하세요.</small></div><button id="direct" hidden>이 기기의 패스키 사용</button><div id="pc-consent" hidden><p id="account"></p><button id="claim" class="primary">이 계정으로 PC 로그인</button></div></section>`}
<section id="entry"><p>${management ? '관리할 계정의 패스키로 다시 인증해 주세요.' : phone ? '휴대폰의 패스키로 본인 계정을 확인하세요.' : '아이디와 비밀번호 없이 로그인하세요. 패스키가 없는 기기에서는 휴대폰을 사용할 수 있어요.'}</p>
<button id="authenticate" class="primary">패스키로 ${management ? '인증하기' : '로그인'}</button>
${management ? '' : '<button id="register">새 계정 만들기</button>'}
${phone ? '' : '<p>이 기기의 패스키나 보안 키로도 로그인할 수 있어요. 인증 창에서 기본 QR을 지원한다면 가까운 휴대폰과 Bluetooth를 이용할 수도 있어요.</p>'}
${management ? '' : '<small>새 계정을 만들면 기존 계정과 별개의 계정이 생깁니다. 기존 패스키가 있다면 로그인해 주세요. 모든 패스키를 잃으면 계정을 복구할 수 없습니다.</small>'}</section>
${phone ? '<section id="phone-consent" hidden><p>확인 번호가 같은 PC의 LDB 로그인을 승인할까요?</p><p id="phone-account"></p><button id="approve" class="primary">PC 로그인 승인</button></section>' : ''}
${management ? '' : '<button id="cancel">로그인 취소</button>'}
<section id="management" hidden><p>예비 패스키를 추가해 두세요. 모든 패스키를 잃으면 계정을 복구할 수 없습니다.</p><ul id="keys"></ul><button id="add" class="primary">예비 패스키 추가</button><p>여기서 삭제해도 이미 로그인한 기기는 로그아웃되지 않으며, 기기의 패스키 저장소에서도 별도로 삭제해야 합니다.</p><button id="end">관리 마치기</button></section>
<section id="complete" hidden><h2>인증을 완료했습니다</h2><a id="return" class="action">LDB 앱으로 돌아가기</a><p>앱 복귀 링크는 1분 이내에 사용해 주세요.</p><p>예비 패스키는 LDB 앱의 패스키 관리에서 추가할 수 있어요.</p></section>
<p id="status" role="status" aria-live="polite"></p><noscript>패스키 인증에는 JavaScript가 필요합니다.</noscript></main></body></html>`
  }
}
