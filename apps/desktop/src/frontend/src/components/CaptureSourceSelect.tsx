import { useState, type RefObject } from 'react'
import { Menu } from '@seed-design/react'
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from '../constants/theme.stylex'
import { captureSelectLightTheme } from '../constants/capture-select.stylex'
import { styles } from './CaptureSourceSelect.style'

type Source = { id: string; name: string }

type CaptureSourceSelectProps = {
  portalContainer: RefObject<HTMLElement | null>
  light: boolean
  detected: Source[]
  others: Source[]
  value: string
  loading: boolean
  failed: boolean
  ready: boolean
  onSelect: (id: string) => void
  onRefresh: () => void
}

const monitorIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...stylex.props(styles.icon)}
  >
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8m-4-4v4" />
  </svg>
)

export function CaptureSourceSelect({
  portalContainer,
  light,
  detected,
  others,
  value,
  loading,
  failed,
  ready,
  onSelect,
  onRefresh
}: CaptureSourceSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = [...detected, ...others].find((source) => source.id === value)
  const label = value ? (selected?.name ?? '선택한 창 · 목록에서 사라짐') : '캡처할 프로세스 선택'

  // 창 선택과 새로고침 명령이 함께 있으므로 radio menu 항목으로 선택 상태를 알린다.
  return (
    <Menu.Root
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      strategy="fixed"
      gutter={8}
      matchReferenceWidth
    >
      <Menu.Trigger
        disabled={loading || !ready}
        aria-label={`캡처할 프로세스 선택${value ? `: ${label}` : ''}`}
        {...stylex.props(
          styles.trigger,
          !value && styles.muted,
          open && styles.open,
          light && captureSelectLightTheme
        )}
      >
        {monitorIcon}
        <span {...stylex.props(styles.value)} title={label}>
          {loading ? '창 목록 확인 중…' : label}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...stylex.props(styles.chevron, open && styles.rotated)}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Menu.Trigger>
      {open && (
        <Menu.Positioner
          container={portalContainer}
          {...stylex.props(
            styles.positioner,
            light && lightTheme,
            light && captureSelectLightTheme
          )}
        >
          <Menu.Content aria-label="캡처할 창" {...stylex.props(styles.content)}>
            <Menu.ScrollArea {...stylex.props(styles.scroll)}>
              {(failed || detected.length === 0) && (
                <div role="status" {...stylex.props(styles.notice)}>
                  <p {...stylex.props(styles.noticeTitle)}>
                    {failed ? '창 목록을 불러오지 못했어요' : '던파 창을 찾지 못했어요'}
                  </p>
                  {failed
                    ? '잠시 후 창 목록을 새로고침해 주세요.'
                    : others.length
                      ? '게임 실행 후 새로고침하거나 다른 창을 선택하세요.'
                      : '게임을 실행한 뒤 창 목록을 새로고침해 주세요.'}
                </div>
              )}
              {[
                { label: '감지된 게임', sources: detected, detected: true },
                { label: '다른 창 직접 선택', sources: others, detected: false }
              ].map(
                (group) =>
                  group.sources.length > 0 && (
                    <Menu.Group key={group.label} {...stylex.props(styles.group)}>
                      <Menu.GroupLabel {...stylex.props(styles.groupLabel)}>
                        {group.label}
                      </Menu.GroupLabel>
                      {group.sources.map((source) => (
                        <Menu.Item
                          key={source.id}
                          role="menuitemradio"
                          aria-checked={source.id === value}
                          aria-label={source.name}
                          typeaheadLabel={source.name}
                          disabled={loading || failed || !ready}
                          onClick={() => onSelect(source.id)}
                          {...stylex.props(styles.option, source.id === value && styles.selected)}
                        >
                          <span
                            {...stylex.props(
                              styles.iconTile,
                              source.id === value && styles.selectedTile
                            )}
                          >
                            {monitorIcon}
                          </span>
                          <Menu.ItemBody {...stylex.props(styles.itemBody)}>
                            <Menu.ItemLabel title={source.name} {...stylex.props(styles.itemLabel)}>
                              {source.name}
                            </Menu.ItemLabel>
                            <Menu.ItemDescription {...stylex.props(styles.description)}>
                              {group.detected ? '게임 창 · 감지됨' : '열려 있는 창'}
                            </Menu.ItemDescription>
                          </Menu.ItemBody>
                          {source.id === value && (
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              {...stylex.props(styles.check)}
                            >
                              <path d="m5 12 4 4L19 6" />
                            </svg>
                          )}
                        </Menu.Item>
                      ))}
                    </Menu.Group>
                  )
              )}
              <div role="separator" {...stylex.props(styles.divider)} />
              <Menu.Item
                disabled={loading}
                onClick={onRefresh}
                {...stylex.props(styles.option, styles.refresh)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  {...stylex.props(styles.icon)}
                >
                  <path d="M20 7v5h-5M4 17v-5h5" />
                  <path d="M6 7a7 7 0 0 1 11.6-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17" />
                </svg>
                창 목록 새로고침
              </Menu.Item>
            </Menu.ScrollArea>
          </Menu.Content>
        </Menu.Positioner>
      )}
    </Menu.Root>
  )
}
