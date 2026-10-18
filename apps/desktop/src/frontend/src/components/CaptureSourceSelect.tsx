import { Menu, Typo } from '@dfragon/ui'
import { getCaptureSourceNotice } from '../lib/capture-presentation'
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
  onSelect,
  onRefresh
}: CaptureSourceSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = [...detected, ...others].find((source) => source.id === value)
  let label = '캡처할 프로세스 선택'
  if (value) {
    label = selected?.name ?? '선택한 창, 목록에서 사라짐'
  } else if (!failed && detected.length === 1) {
    label = `${detected[0].name}, 감지됨`
  } else if (!failed && detected.length > 1) {
    label = `던파 창 ${detected.length}개 감지됨`
  }
  const hasSourceLabel = value.length > 0 || (!failed && detected.length > 0)

  const notice = getCaptureSourceNotice({ failed, hasOtherSources: others.length > 0 })

  // 창 선택과 새로고침 명령이 함께 있으므로 radio menu 항목으로 선택 상태를 알린다.

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        disabled={loading || !ready}
        aria-label={`캡처할 프로세스 선택${hasSourceLabel ? `: ${label}` : ''}`}
        {...stylex.props(styles.trigger, !value && styles.muted, open && styles.open)}
      >
        <MonitorIcon {...stylex.props(styles.icon)} />
        <Typo.txtS as="span" {...stylex.props(styles.value)} title={label}>
          {loading ? '창 목록 확인 중…' : label}
        </Typo.txtS>
        <ChevronDownIcon {...stylex.props(styles.chevron, open && styles.rotated)} />
      </Menu.Trigger>
      <Menu.Popup sideOffset={8} aria-label="캡처할 창" {...stylex.props(styles.popup)}>
        {(failed || detected.length === 0) && (
          <div role="status" {...stylex.props(styles.notice)}>
            <Typo.txtS weight={700} {...stylex.props(styles.noticeTitle)}>
              {notice.title}
            </Typo.txtS>
            <Typo.caption as="p">{notice.description}</Typo.caption>
          </div>
        )}
        <Menu.RadioGroup value={value} onValueChange={(id: string) => onSelect(id)}>
          {[
            { label: '감지된 게임', sources: detected, detected: true },
            { label: '다른 창 직접 선택', sources: others, detected: false }
          ].map((group) => {
            const hasSources = group.sources.length > 0
            if (!hasSources) {
              return false
            }

            return (
              <Menu.Group key={group.label}>
                <Menu.GroupLabel>{group.label}</Menu.GroupLabel>
                {group.sources.map((source) => (
                  <Menu.RadioItem
                    key={source.id}
                    value={source.id}
                    aria-label={source.name}
                    label={source.name}
                    disabled={loading || failed || !ready}
                    closeOnClick
                    {...stylex.props(styles.option)}
                  >
                    <span
                      {...stylex.props(styles.iconTile, source.id === value && styles.selectedTile)}
                    >
                      <MonitorIcon {...stylex.props(styles.icon)} />
                    </span>
                    <span {...stylex.props(styles.itemBody)}>
                      <Typo.txtS
                        as="span"
                        weight={700}
                        title={source.name}
                        {...stylex.props(styles.itemLabel)}
                      >
                        {source.name}
                      </Typo.txtS>
                      <Typo.caption {...stylex.props(styles.description)}>
                        {group.detected ? '게임 창, 감지됨' : '열려 있는 창'}
                      </Typo.caption>
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
          <Typo.caption>창 목록 새로고침</Typo.caption>
        </Menu.Item>
      </Menu.Popup>
    </Menu.Root>
  )
}
