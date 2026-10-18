// 첫 페인트 전에 시스템 색 모드를 tokens.css가 읽는 data-theme으로 옮기고, 이후 변경도 따른다.
// module script는 지연 실행되므로 index.html head에서 일반 script로 불러온다.
// 일반 script의 최상위 선언은 전역이 되므로 block 안에 둔다.
{
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
  const applyColorTheme = () => {
    document.documentElement.dataset.theme = prefersDark.matches ? 'dark' : 'light'
  }

  applyColorTheme()
  prefersDark.addEventListener('change', applyColorTheme)
}
