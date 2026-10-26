import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  // 제품 메인 창(App.style.ts)과 같은 상단 바와 콘텐츠 영역이다. 높이는 보이는 화면의 창 내용 높이이고,
  // 창 아래 끝은 높이를 바꾸지 않는 그림자 선으로 보인다.
  app: {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    boxShadow: `0 1px 0 ${colors.borderDefault}`
  },
  windowHeight: (height: number) => ({ height }),
  // OS 창 버튼은 창 위쪽에 고정되므로 상단 바도 고정하고 그 아래 내용만 스크롤한다. 여백은 제품 콘텐츠
  // 영역과 같다.
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBlock: space.s12,
    paddingInline: space.s16
  },
  // 제품 화면처럼 카드가 콘텐츠 영역 높이를 채운다.
  page: {
    display: { default: 'flex', ':is([hidden])': 'none' },
    flexDirection: 'column',
    minHeight: '100%',
    gap: space.s16
  },
  // 미리보기 조작부는 창 높이 밖, 창 아래에 둔다.
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    margin: '16px 16px 0',
    fontSize: 12,
    color: colors.fgMuted
  },
  select: {
    maxWidth: '100%',
    padding: 6,
    fontFamily: 'inherit',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.borderDefault,
    borderRadius: 6
  },
  notice: { fontSize: 12, lineHeight: 1.6, color: colors.fgMuted, margin: '12px 16px 0' }
})
