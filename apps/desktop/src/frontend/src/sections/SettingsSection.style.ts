import * as stylex from '@stylexjs/stylex'
import { colors, font, motion, radius } from '@dfragon/ui/tokens.stylex'

const NARROW = '@media (max-width: 600px)'

// 값은 DFragon 디자인 캔버스의 설정과 라이선스 보드(메인 위 설정, 라이선스 사용고지, 고지 상세, 개발자 모드
// 켜짐과 꺼짐)를 따른다.
export const styles = stylex.create({
  // 대화상자가 열린 동안 상단 바의 설정 아이콘이 신호색이 된다. Base UI가 열린 trigger에 붙이는 속성을 쓴다.
  trigger: {
    color: { default: null, ':is([data-popup-open])': colors.signal }
  },
  // 머리와 본문이 각자 여백을 가진다. 꺾쇠가 테두리 1px 바깥까지 걸치므로 넘침을 보인다. 같은 우선순위의
  // 속성끼리는 어느 쪽이 이길지 정해지지 않으므로, 공용 대화상자의 padding, gap, overflow 단축 속성보다
  // 우선하는 개별 속성으로 덮는다.
  dialog: {
    // OS 창 버튼 띠 아래에서 가운데에 놓는다. 창 버튼은 웹 내용보다 먼저 클릭을 받는다.
    marginTop: 'env(titlebar-area-height, 0px)',
    maxHeight: 'calc(100dvh - env(titlebar-area-height, 0px) - 24px)',
    rowGap: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    overflowX: 'visible',
    overflowY: 'visible'
  },
  // 네 모서리 꺾쇠(12px, 두께 2)는 테두리 1px 바깥까지 걸친다.
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderStyle: 'solid',
    borderWidth: 0,
    borderColor: colors.borderStrong,
    pointerEvents: 'none'
  },
  topLeft: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  // 보드처럼 높이 64 아래에 1px 선을 더한다.
  header: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    height: 64,
    paddingLeft: 24,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  title: { flexGrow: 1, margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 700 },
  closeIcon: { width: 18, height: 18 },
  body: {
    display: 'flex',
    flexDirection: { default: 'row', [NARROW]: 'column' },
    flexGrow: 1,
    minHeight: 0
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flexShrink: 0,
    boxSizing: 'border-box',
    width: { default: 200, [NARROW]: 'auto' },
    paddingBlock: { default: 16, [NARROW]: 8 },
    paddingInline: 12,
    backgroundColor: colors.bgBar
  },
  menu: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    margin: 0,
    paddingBlock: 0,
    paddingInline: 12,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: colors.fgSubtle, ':hover': colors.fgDefault },
    font: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    transitionProperty: 'color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease,
    // 현재 항목은 오른쪽 위를 잘라 바깥 outline이 가려지므로 포커스 선을 면 안쪽에 그린다.
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: -2
  },
  // 현재 항목은 bg.inset 면에 왼쪽 2px 신호색 막대를 두고 오른쪽 위를 자른다(shapes.cutTopRight와 함께).
  menuCurrent: {
    backgroundColor: colors.bgInset,
    color: colors.fgDefault,
    fontWeight: 700,
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 2,
      backgroundColor: colors.signal
    }
  },
  // 로그인 버튼과 앱 이름을 메뉴 아래쪽으로 밀어 붙인다. 좁은 창에서도 로그인 버튼은 남기고 앱 이름만 숨긴다.
  sidebarEnd: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginTop: 'auto'
  },
  appName: {
    display: { default: 'flex', [NARROW]: 'none' },
    alignItems: 'center',
    gap: 8,
    paddingInline: 12,
    color: colors.fgSubtle,
    fontSize: 12,
    lineHeight: '18px',
    fontWeight: 700
  },
  // 로고 마크는 오른쪽 위를 자른 10px brand.logo 면이다. brand.logo는 로고 마크에만 쓴다.
  appMark: { width: 10, height: 10, flexShrink: 0, backgroundColor: colors.brandLogo },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    boxSizing: 'border-box',
    overflowY: 'auto',
    padding: { default: 24, [NARROW]: 16 }
  },
  // 줄 전체가 스위치 라벨이라 글자와 스위치를 함께 눌러 바꾼다.
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    height: 56,
    boxSizing: 'border-box',
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: radius.panel,
    backgroundColor: colors.bgBar,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer'
  },
  developerActions: { display: 'flex', paddingTop: 16 },
  developerOpen: { paddingLeft: 20, paddingRight: 20 },
  error: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  // 원인을 알아야 하는 오류는 `!` 칸 뒤 한 줄로만 보인다. 카드의 검색 실패 칸과 같은 모양이다.
  errorText: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    fontSize: 13,
    lineHeight: '20px',
    color: colors.fgMuted,
    overflowWrap: 'anywhere'
  },
  errorMark: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 18,
    height: 18,
    backgroundColor: colors.bgDangerWeak,
    color: colors.fgDanger,
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 700
  }
})
