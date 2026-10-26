import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './StatLine.style'
import { MISSING_VALUE } from '../constants/cards'
import { type ScoreView, formatApproximateScore } from '../lib/card-score'
import type { CharacterTier } from '../types/cards'

const integer = new Intl.NumberFormat('ko-KR')

type StatTone = NonNullable<ScoreView['tone']> | CharacterTier

// 점수 라벨은 두 글자로 줄여 보인다.
const shortScoreLabels: Readonly<Record<ScoreView['label'], string>> = {
  '장비 점수': '장비',
  '버프 점수': '버프'
}

/**
 * 캐릭터 카드의 `명성 125,850 | 장비 414,806` 한 줄. 라벨과 값은 같은 색이고, 명성은 기본 글자색, 점수는
 * 역할 색(딜러 파랑, 버퍼 초록)이다. 상위, 랭커 단계 카드는 둘 다 단계 색으로 그린다. 값이 없으면 `-`를
 * 흐리게 둔다(빈 자리는 더 흐리게). 숫자는 한글과 같은 12px 글꼴이라 세어 올리지 않는다. 점수의 근사값 `≈`와 계산하지 못한
 * 사유는 `score`가 전한 대로 보조 기술에 덧붙인다.
 */
export function StatLine({
  fame,
  score,
  vacant,
  tier
}: {
  /** 명성. 찾은 캐릭터가 없으면 null */
  fame: number | null
  /** `toScoreView` 결과 */
  score: ScoreView
  /** 아무것도 인식하지 못한 빈 자리. 값이 없을 때 `-`를 더 흐리게 둔다. */
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

// 명성과 점수 값. 0과 알 수 없음을 구분하고 알 수 없으면 `-`를 흐리게 둔다. 설명은 값 옆 `title`과 보조 기술에 전한다.
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
