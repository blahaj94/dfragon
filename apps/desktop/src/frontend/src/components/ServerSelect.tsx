import { Select } from '@dfragon/ui'
import { useRef } from 'react'

type ServerSelectProps = {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onValueChange: (id: string) => void
}

export function ServerSelect({
  label,
  value,
  options,
  open,
  onOpenChange,
  onValueChange
}: ServerSelectProps): React.JSX.Element {
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleValueChange(next: string | null): void {
    if (next != null) {
      onValueChange(next)
    }
  }

  return (
    <Select.Root
      open={open}
      onOpenChange={onOpenChange}
      value={value || null}
      onValueChange={handleValueChange}
      items={options.map((option) => ({ value: option.id, label: option.label }))}
    >
      <Select.Trigger ref={triggerRef} size="2xs" surface="card" aria-label={label}>
        <Select.Value placeholder="서버" />
      </Select.Trigger>
      {/* 이름 칸 Tab으로 열었어도 닫으면 칩으로 돌아가, 다음 Tab이 목록을 다시 열지 않고 다음 요소로 간다. */}
      <Select.Popup surface="card" aria-label={label} columns={4} finalFocus={triggerRef}>
        {options.map((option) => (
          <Select.Item key={option.id} value={option.id}>
            <Select.ItemText>{option.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}
