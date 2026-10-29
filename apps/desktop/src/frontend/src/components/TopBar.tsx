import { Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { GRADE_RARITY_NAMES, gradeRarity } from '../lib/today-grade'
import { styles } from './TopBar.style'

const TOP_BAR_NAME = '던삐삐'

function GradePercent({ percent }: { percent: number | null }): React.JSX.Element {
  if (percent == null) {
    return (
      <Typo.txtM
        as="span"
        role="img"
        aria-label="등급 정보 없음"
        weight={700}
        {...stylex.props(styles.percent, styles.unknown)}
      >
        -%
      </Typo.txtM>
    )
  }
  const rarity = gradeRarity(percent)

  return (
    <Typo.txtM
      as="span"
      role="img"
      aria-label={`등급 ${percent}퍼센트, ${GRADE_RARITY_NAMES[rarity]}`}
      weight={700}
      {...stylex.props(styles.percent, styles[rarity])}
    >
      {percent}%
    </Typo.txtM>
  )
}

export function TopBar({
  grade,
  start,
  center,
  end
}: {
  grade: number | null
  start: ReactNode
  center: ReactNode
  end: ReactNode
}): React.JSX.Element {
  return (
    <header {...stylex.props(styles.header)}>
      <div aria-hidden="true" {...stylex.props(styles.dragArea)} />
      <div {...stylex.props(styles.brand)}>
        <GradePercent percent={grade} />
        <Typo.caption as="span" weight={700} {...stylex.props(styles.name)}>
          {TOP_BAR_NAME}
        </Typo.caption>
      </div>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      {start}
      {center}
      <span {...stylex.props(styles.status)}>{end}</span>
    </header>
  )
}
