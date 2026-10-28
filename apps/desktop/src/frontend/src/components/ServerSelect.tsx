import { Select } from '@dfragon/ui'
import { useRef } from 'react'

type ServerSelectProps = {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  disabled?: boolean
  variant?: 'chip' | 'field'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onValueChange: (id: string) => void
}

export function ServerSelect({
  label,
  value,
  options,
  disabled = false,
  variant = 'chip',
  open,
  onOpenChange,
  onValueChange
}: ServerSelectProps): React.JSX.Element {
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <Select.Root
      open={open}
      onOpenChange={(next: boolean) => onOpenChange?.(next)}
      value={value || null}
      onValueChange={(next: string | null) => {
        if (next != null) {
          onValueChange(next)
        }
      }}
      items={options.map((option) => ({ value: option.id, label: option.label }))}
      disabled={disabled}
    >
      <Select.Trigger
        ref={triggerRef}
        size={variant === 'field' ? '2xs' : 'xs'}
        surface="card"
        aria-label={label}
      >
        <Select.Value placeholder="서버" />
      </Select.Trigger>
      {/* 이름 칸 Tab으로 열었어도 닫으면 칩으로 돌아가, 다음 Tab이 목록을 다시 열지 않고 다음 요소로 간다. */}
      <Select.Popup
        surface="card"
        aria-label={label}
        columns={variant === 'field' ? 4 : undefined}
        finalFocus={triggerRef}
      >
        {options.map((option) => (
          <Select.Item key={option.id} value={option.id}>
            <Select.ItemText>{option.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}
