import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 숨김 기준은 OS 창 버튼 자리를 뺀 상단 바 내용 폭이다. Windows 최소 창 1024에서 내용 폭은 846px(왼쪽
// 여백 24, 창 버튼 138과 간격 16)이고 제품 이름은 900px 이하에서 숨긴다. 게임 연결 상태 칩은 캡처할 창을
// 고르는 대화상자를 여는 유일한 길이라 숨기지 않는다.
const HIDE_NAME = '@container (max-width: 900px)'

export const styles = stylex.create({
  header: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: space.s16,
    width: '100%',
    // 축소 시안은 상단 바와 화면 머리를 높이 44 한 줄로 합친다. 공용 size.topbar(56)는 쓰지 않는다.
    height: 44,
    boxSizing: 'border-box',
    paddingLeft: 'calc(env(titlebar-area-x, 0px) + 24px)',
    paddingRight:
      'max(24px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 16px))',
    containerType: 'inline-size',
    backgroundColor: colors.bgBar,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault,
    color: colors.fgDefault,
    position: 'relative'
  },
  // 상단 바 전체를 덮는 빈 요소만 끌기 영역이다. 자식이 없어 다른 요소가 drag를 상속하지 않는다.
  dragArea: { position: 'absolute', inset: 0, WebkitAppRegion: 'drag' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  // 로고 마크는 오른쪽 위를 자른 24px brand.logo 면이다. brand.logo는 로고 마크에만 쓴다.
  mark: { width: 24, height: 24, flexShrink: 0, backgroundColor: colors.brandLogo },
  name: { display: { default: 'inline', [HIDE_NAME]: 'none' }, whiteSpace: 'nowrap' },
  divider: { width: 1, height: 24, flexShrink: 0, backgroundColor: colors.borderDefault },
  // 화면 머리 자리는 남는 폭을 채워 게임 연결 상태를 오른쪽 끝(창 버튼 앞)에 붙인다.
  board: { display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexShrink: 0
  }
})
