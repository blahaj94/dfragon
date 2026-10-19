import * as stylex from '@stylexjs/stylex'
import { colors, size, space } from '@dfragon/ui/tokens.stylex'

// 숨김 기준은 OS 창 버튼 자리를 뺀 상단 바 내용 폭이다. Windows 최소 창 1024에서 내용 폭은 846px(왼쪽
// 여백 24, 창 버튼 138과 간격 16)이고 제품 이름은 900px 이하에서 숨긴다. 게임 연결 상태 칩은 캡처할 창을
// 고르는 대화상자를 여는 유일한 길이라 숨기지 않는다. 카메라 버튼이 빠져 로고 마크, 내비 312px, 칩 묶음
// 약 123px, 테마와 설정 72px과 간격을 더해도 약 560px이라 846px 안에 들어간다. 로그인은 설정 대화상자에 있다.
const HIDE_NAME = '@container (max-width: 900px)'

export const styles = stylex.create({
  header: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    gap: space.s16,
    width: '100%',
    // main이 정한 OS 창 버튼 높이를 따르고, 창 버튼이 없는 미리보기에서는 시안 높이를 쓴다.
    height: `env(titlebar-area-height, ${size.topbar})`,
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
  // 남는 공간을 왼쪽에 두고 게임 연결 상태와 도구 버튼을 오른쪽 끝(창 버튼 앞)에 붙인다.
  end: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexShrink: 0,
    marginInlineStart: 'auto'
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: space.s16,
    flexShrink: 0
  },
  tools: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }
})
