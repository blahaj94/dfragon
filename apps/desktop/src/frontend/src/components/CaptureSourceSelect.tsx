import { StepDots } from '@dfragon/ui'
import { CAPTURE_SOURCE_RETRY_INTERVAL_MS } from '../constants/capture'
import { CheckIcon } from './CheckIcon'
import { useId, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './CaptureSourceSelect.style'

type Source = { id: string; name: string }

type CaptureSourceSelectProps = {
  detected: Source[]
  others: Source[]
  value: string
  loading: boolean
  failed: boolean
  ready: boolean
  retryStartedAt: number
  onSelect: (id: string) => void
}

export function CaptureSourceSelect({
  detected,
  others,
  value,
  loading,
  failed,
  ready,
  retryStartedAt,
  onSelect
}: CaptureSourceSelectProps): React.JSX.Element {
  const groupName = useId()
  const sources = [
    ...detected.map((source) => ({ ...source, group: '감지된 게임' })),
    ...others.map((source) => ({ ...source, group: '다른 창' }))
  ]
  const hasSelected = sources.some((source) => source.id === value)
  const searching = !failed && detected.length === 0
  const disabled = loading || failed || !ready

  return (
    <div {...stylex.props(styles.row)}>
      {failed && (
        <div role="status" {...stylex.props(styles.tile, styles.failureTile)}>
          <span {...stylex.props(styles.failureTitle)}>창 목록을 불러오지 못했습니다</span>
          <span {...stylex.props(styles.line)}>15초마다 다시 확인합니다</span>
        </div>
      )}
      {searching && (
        <div {...stylex.props(styles.tile, styles.searchingTile)}>
          <span role="status" {...stylex.props(styles.searching)}>
            던전앤파이터 찾는 중
            <StepDots size={5} />
          </span>
          <RetryProgress key={retryStartedAt} startedAt={retryStartedAt} />
        </div>
      )}
      <div role="radiogroup" aria-label="캡처할 창" {...stylex.props(styles.group)}>
        {value.length > 0 && !hasSelected && (
          <SourceTile
            groupName={groupName}
            id={value}
            name="선택한 창"
            group="목록에서 사라짐"
            checked
            disabled={disabled}
            onSelect={onSelect}
          />
        )}
        {sources.map((source) => (
          <SourceTile
            key={source.id}
            groupName={groupName}
            id={source.id}
            name={source.name}
            group={source.group}
            checked={source.id === value}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

type SourceTileProps = {
  groupName: string
  id: string
  name: string
  group: string
  checked: boolean
  disabled: boolean
  onSelect: (id: string) => void
}

function SourceTile({
  groupName,
  id,
  name,
  group,
  checked,
  disabled,
  onSelect
}: SourceTileProps): React.JSX.Element {
  return (
    <div
      title={name}
      {...stylex.props(
        styles.tile,
        styles.sourceTile,
        checked && styles.selectedTile,
        disabled && styles.disabledTile
      )}
    >
      <input
        type="radio"
        name={groupName}
        value={id}
        checked={checked}
        disabled={disabled}
        aria-label={name}
        onChange={() => onSelect(id)}
        {...stylex.props(styles.radio)}
      />
      <span {...stylex.props(styles.text)}>
        <span {...stylex.props(styles.name, checked && styles.selectedName)}>{name}</span>
        <span {...stylex.props(styles.line)}>{group}</span>
      </span>
      {checked && <CheckIcon {...stylex.props(styles.check)} />}
    </div>
  )
}

// 다음 자동 조회까지 남은 시간을 채워 가는 2px 막대. 대화상자를 연 순간 이미 지난 시간만큼 음수 지연으로
// 앞당겨 시작하므로 실제 재조회 타이머와 같은 순간에 찬다. 조회가 끝나 시작 시각이 바뀌면 key로 새로
// 그려 처음부터 다시 찬다. 동작 줄이기에서는 연 순간의 위치에서 멈춘다.
function RetryProgress({ startedAt }: { startedAt: number }): React.JSX.Element {
  const [shownAt] = useState(() => performance.now())

  return (
    <span aria-hidden="true" {...stylex.props(styles.retryTrack)}>
      <span
        data-retry-progress=""
        {...stylex.props(
          styles.retryBar,
          styles.retryTiming(`${CAPTURE_SOURCE_RETRY_INTERVAL_MS}ms`, `${startedAt - shownAt}ms`)
        )}
      />
    </span>
  )
}
