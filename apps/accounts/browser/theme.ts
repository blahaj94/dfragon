// build.mjs가 passkeys.html head에 nonce 인라인 script로 넣어 첫 페인트 전에 실행한다.
// tokens.css는 data-theme이 없으면 다크이므로, 라이트 시스템에서 다크 바탕이 잠깐 보이지 않게 한다.
const darkPreference = window.matchMedia('(prefers-color-scheme: dark)')

function applySystemTheme() {
  document.documentElement.dataset.theme = darkPreference.matches ? 'dark' : 'light'
}

applySystemTheme()
darkPreference.addEventListener('change', applySystemTheme)
