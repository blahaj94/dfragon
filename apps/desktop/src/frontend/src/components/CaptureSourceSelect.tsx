import { Menu, StepDots } from '@dfragon/ui'
import { CAPTURE_SOURCE_RETRY_INTERVAL_MS } from '../constants/capture'
import { RefreshIcon } from './RefreshIcon'
import { CheckIcon } from './CheckIcon'
import { ChevronDownIcon } from './ChevronDownIcon'
import { MonitorIcon } from './MonitorIcon'
import { useState } from 'react'
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
  /**
   * 마지막 창 목록 조회가 끝난 시각(`performance.now()` ms). 다음 자동 조회까지의 진행 막대가 이 시각부터
   * 찬다.
   */
  retryStartedAt: number
  onSelect: (id: string) => void
  onRefresh: () => void
}

export function CaptureSourceSelect({
  detected,
  others,
  value,
  loading,
  failed,
  ready,
  retryStartedAt,
  onSelect,
  onRefresh
}: CaptureSourceSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = [...detected, ...others].find((source) => source.id === value)
  let label = '게임 창 선택'
  if (value) {
    label = selected?.name ?? '선택한 창, 목록에서 사라짐'
  } else if (!failed && detected.length === 1) {
    label = `${detected[0].name}, 감지됨`
  } else if (!failed && detected.length > 1) {
    label = `던파 창 ${detected.length}개 감지됨`
  }
  const hasSourceLabel = value.length > 0 || (!failed && detected.length > 0)
  const searching = !failed && detected.length === 0
  const disabled = loading || failed || !ready

  // 창 선택과 새로고침 명령이 함께 있으므로 radio menu 항목으로 선택 상태를 알린다.

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        disabled={loading || !ready}
        aria-label={`게임 창 선택${hasSourceLabel ? `: ${label}` : ''}`}
        {...stylex.props(styles.trigger, open && styles.open)}
      >
        <MonitorIcon {...stylex.props(styles.icon, open && styles.openIcon)} />
        <span title={label} {...stylex.props(styles.value, !hasSourceLabel && styles.placeholder)}>
          {loading ? '창 목록 확인 중…' : label}
        </span>
        <ChevronDownIcon {...stylex.props(styles.chevron, open && styles.rotated)} />
      </Menu.Trigger>
      <Menu.Popup sideOffset={8} aria-label="캡처할 창" {...stylex.props(styles.popup)}>
        {failed && (
          <div role="status" {...stylex.props(styles.notice)}>
            <span {...stylex.props(styles.failureTitle)}>창 목록을 불러오지 못했습니다</span>
            <span {...stylex.props(styles.failureDescription)}>
              15초마다 다시 확인합니다. 직접 새로고침할 수도 있습니다.
            </span>
          </div>
        )}
        {searching && (
          <div {...stylex.props(styles.notice)}>
            <span role="status" {...stylex.props(styles.searching)}>
              던전앤파이터 찾는 중
              <StepDots size={5} />
            </span>
            <RetryProgress key={retryStartedAt} startedAt={retryStartedAt} />
          </div>
        )}
        <Menu.RadioGroup value={value} onValueChange={(id: string) => onSelect(id)}>
          {[
            { label: '감지된 게임', sources: detected },
            { label: '다른 창 직접 선택', sources: others }
          ].map((group) => {
            const hasSources = group.sources.length > 0
            if (!hasSources) {
              return false
            }

            return (
              <Menu.Group key={group.label}>
                <Menu.GroupLabel {...stylex.props(styles.groupLabel)}>
                  <span {...stylex.props(styles.groupLabelText)}>{group.label}</span>
                </Menu.GroupLabel>
                {group.sources.map((source) => (
                  <Menu.RadioItem
                    key={source.id}
                    value={source.id}
                    aria-label={source.name}
                    label={source.name}
                    disabled={disabled}
                    closeOnClick
                    {...stylex.props(styles.option, source.id === value && styles.currentOption)}
                  >
                    <span
                      {...stylex.props(styles.iconTile, source.id === value && styles.selectedTile)}
                    >
                      <MonitorIcon {...stylex.props(styles.itemIcon)} />
                    </span>
                    <span
                      title={source.name}
                      {...stylex.props(
                        styles.itemLabel,
                        source.id === value && styles.currentLabel,
                        disabled && styles.disabledLabel
                      )}
                    >
                      {source.name}
                    </span>
                    {source.id === value && <CheckIcon {...stylex.props(styles.check)} />}
                  </Menu.RadioItem>
                ))}
              </Menu.Group>
            )
          })}
        </Menu.RadioGroup>
        <Menu.Separator />
        <Menu.Item disabled={loading} onClick={onRefresh} {...stylex.props(styles.refresh)}>
          <RefreshIcon {...stylex.props(styles.refreshIcon)} />
          <span {...stylex.props(styles.refreshLabel)}>창 목록 새로고침</span>
        </Menu.Item>
      </Menu.Popup>
    </Menu.Root>
  )
}

// 다음 자동 조회까지 남은 시간을 채워 가는 2px 막대. 목록을 연 순간 이미 지난 시간만큼 음수 지연으로
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
