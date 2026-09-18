import { getCaptureSourceNotice } from '../lib/capture-presentation'
import { RefreshIcon } from './RefreshIcon'
import { CheckIcon } from './CheckIcon'
import { ChevronDownIcon } from './ChevronDownIcon'
import { MonitorIcon } from './MonitorIcon'
import { useState, type RefObject } from 'react'
import { Menu } from '@seed-design/react'
import * as stylex from '@stylexjs/stylex'
import { lightTheme } from '../constants/theme.stylex'
import { selectLightTheme } from '../constants/select.stylex'
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

  const notice = getCaptureSourceNotice({ failed, hasOtherSources: others.length > 0 })

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
          light && selectLightTheme
        )}
      >
        <MonitorIcon {...stylex.props(styles.icon)} />
        <span {...stylex.props(styles.value)} title={label}>
          {loading ? '창 목록 확인 중…' : label}
        </span>
        <ChevronDownIcon {...stylex.props(styles.chevron, open && styles.rotated)} />
      </Menu.Trigger>
      {open && (
        <Menu.Positioner
          container={portalContainer}
          {...stylex.props(styles.positioner, light && lightTheme, light && selectLightTheme)}
        >
          <Menu.Content aria-label="캡처할 창" {...stylex.props(styles.content)}>
            <Menu.ScrollArea {...stylex.props(styles.scroll)}>
              {(failed || detected.length === 0) && (
                <div role="status" {...stylex.props(styles.notice)}>
                  <p {...stylex.props(styles.noticeTitle)}>{notice.title}</p>
                  {notice.description}
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
                            <MonitorIcon {...stylex.props(styles.icon)} />
                          </span>
                          <Menu.ItemBody {...stylex.props(styles.itemBody)}>
                            <Menu.ItemLabel title={source.name} {...stylex.props(styles.itemLabel)}>
                              {source.name}
                            </Menu.ItemLabel>
                            <Menu.ItemDescription {...stylex.props(styles.description)}>
                              {group.detected ? '게임 창 · 감지됨' : '열려 있는 창'}
                            </Menu.ItemDescription>
                          </Menu.ItemBody>
                          {source.id === value && <CheckIcon {...stylex.props(styles.check)} />}
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
                <RefreshIcon {...stylex.props(styles.icon)} />창 목록 새로고침
              </Menu.Item>
            </Menu.ScrollArea>
          </Menu.Content>
        </Menu.Positioner>
      )}
    </Menu.Root>
  )
}
