import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, DialogRoot, DialogTrigger, DialogContent, DialogBody } from '@ldb/ui'
import { lightTheme } from '../constants/theme.stylex'
import { styles } from './CaptureControls.style'

export type CaptureControlsProps = {
  light: boolean
  sources: { id: string; name: string }[]
  selectedSourceId: string
  loading: boolean
  failed: boolean
  starting: boolean
  active: boolean
  ready: boolean
  status: string
  onSelect: (id: string) => void
  onRefresh: () => void
  onStop: () => void
}

export function CaptureControls({
  light,
  sources,
  selectedSourceId,
  loading,
  failed,
  starting,
  active,
  ready,
  status,
  onSelect,
  onRefresh,
  onStop
}: CaptureControlsProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const detected = sources.filter((source) =>
    /던전\s*앤\s*파이터|Dungeon.*Fighter|\bDNF\b/i.test(source.name)
  )
  const others = sources.filter((source) => !detected.includes(source))
  const state = starting
    ? '준비 중'
    : active
      ? '캡처 중'
      : loading
        ? '창 확인 중'
        : failed
          ? '조회 실패'
          : detected.length === 0
            ? '창 미감지'
            : '대기'
  const missingSelection =
    selectedSourceId !== '' && !sources.some((source) => source.id === selectedSourceId)

  return (
    <DialogRoot
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (open) {
          onRefresh()
        }
      }}
    >
      <DialogTrigger asChild>
        <ActionButton size="small" variant="ghost" aria-label="화면 캡처" aria-haspopup="dialog">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...stylex.props(styles.camera, (active || starting) && styles.active)}
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </ActionButton>
      </DialogTrigger>
      <DialogContent
        {...stylex.props(styles.dialog, light && lightTheme)}
        title={
          <span {...stylex.props(styles.heading)}>
            화면 캡처
            <span role="status" {...stylex.props(styles.state, active && styles.active)}>
              {state}
            </span>
          </span>
        }
      >
        <DialogBody>
          <select
            aria-label="캡처할 프로세스 선택"
            value={active || starting ? selectedSourceId : ''}
            disabled={loading || !ready}
            onChange={(event) => onSelect(event.target.value)}
            {...stylex.props(styles.select)}
          >
            <option value="">캡처할 프로세스 선택</option>
            {missingSelection && (
              <option value={active || starting ? selectedSourceId : ''} disabled>
                선택한 창 · 목록에서 사라짐
              </option>
            )}
            {detected.length > 0 && (
              <optgroup label="감지된 게임">
                {detected.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name} · 감지됨
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="다른 창 직접 선택">
                {others.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {(failed || (!loading && sources.length === 0)) && (
            <p {...stylex.props(styles.notice)}>게임을 실행한 뒤 창 목록을 새로고침해 주세요.</p>
          )}
          {status && (
            <p role="status" {...stylex.props(styles.notice)}>
              {status}
            </p>
          )}
        </DialogBody>
        <div {...stylex.props(styles.footer)}>
          <ActionButton size="small" variant="ghost" disabled={loading} onClick={onRefresh}>
            새로고침
          </ActionButton>
          <div {...stylex.props(styles.actions)}>
            {(active || starting) && (
              <ActionButton size="small" variant="neutralWeak" onClick={onStop}>
                캡처 중지
              </ActionButton>
            )}
            <ActionButton size="small" variant="neutralWeak" onClick={() => setOpen(false)}>
              닫기
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
