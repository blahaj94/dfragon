import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './StatLine.style'
import { MISSING_VALUE } from '../constants/cards'
import { type ScoreView, formatApproximateScore } from '../lib/card-score'
import type { CharacterTier } from '../types/cards'

const integer = new Intl.NumberFormat('ko-KR')

type StatTone = NonNullable<ScoreView['tone']> | CharacterTier

const shortScoreLabels: Readonly<Record<ScoreView['label'], string>> = {
  '장비 점수': '장비',
  '버프 점수': '버프'
}

export function StatLine({
  fame,
  score,
  vacant,
  tier
}: {
  fame: number | null
  score: ScoreView
  vacant: boolean
  tier?: CharacterTier
}): React.JSX.Element {
  const scoreTone = tier ?? score.tone

  return (
    <div {...stylex.props(styles.line)}>
      <dl {...stylex.props(styles.stat)}>
        <dt {...stylex.props(styles.label, tier !== undefined && styles[tier])}>명성</dt>
        <StatValue value={fame} vacant={vacant} tone={tier} />
      </dl>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      <dl {...stylex.props(styles.stat)}>
        <dt {...stylex.props(styles.label, scoreTone !== null && styles[scoreTone])}>
          {shortScoreLabels[score.label]}
        </dt>
        <StatValue
          value={score.value}
          vacant={vacant}
          tone={scoreTone}
          approximate={score.approximate}
          description={score.description}
        />
      </dl>
    </div>
  )
}

function StatValue({
  value,
  vacant,
  tone,
  approximate = false,
  description
}: {
  value: number | null
  vacant: boolean
  tone?: StatTone | null
  approximate?: boolean
  description?: string
}): React.JSX.Element {
  const note = description !== undefined && (
    <span {...stylex.props(shapes.srOnly)}>{description}</span>
  )
  if (value == null) {
    return (
      <dd {...stylex.props(styles.value, styles.missing, vacant && styles.vacant)}>
        {MISSING_VALUE}
        {note}
      </dd>
    )
  }

  return (
    <dd title={description} {...stylex.props(styles.value, tone != null && styles[tone])}>
      {approximate ? formatApproximateScore(value) : integer.format(value)}
      {note}
    </dd>
  )
}
