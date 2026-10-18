// 첫 페인트 전에 시스템 설정으로 테마를 정한다. ColorThemeProvider의 'system' 초기값과 같은 규칙이며,
// 이후 전환은 Provider가 맡는다. CSP(script-src 'self')가 inline script를 막아 정적 파일로 둔다.
// 일반 script의 최상위 선언은 전역이 되므로 block 안에 둔다.
{
  const theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}
