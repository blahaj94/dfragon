import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

// 이름 입력과 서버 칩을 감싼 높이 20의 칸. 테두리 1px이 카드 상태를 따른다.
export const styles = stylex.create({
  field: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: space.s4,
    minWidth: 0,
    height: 20,
    paddingInlineStart: space.s4,
    paddingInlineEnd: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent'
  },
  fieldSelected: { borderColor: colors.cardSignal, backgroundColor: colors.bgWell },
  fieldFailure: { borderColor: colors.cardFailure },
  fieldWaiting: { borderColor: colors.cardBorder, backgroundColor: colors.bgWell },
  fieldVacant: {
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgWell
  },
  name: {
    flex: '1 1 0',
    minWidth: 0,
    height: '100%',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: { default: colors.cardFg, ':disabled': colors.cardFgMuted },
    fontFamily: 'inherit',
    fontWeight: 700,
    outlineStyle: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }
})
