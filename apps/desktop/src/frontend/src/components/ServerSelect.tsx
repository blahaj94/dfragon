import { Select } from '@dfragon/ui'
import { useRef } from 'react'

type ServerSelectProps = {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  disabled?: boolean
  /** `field`는 이름 입력 칸 안에 넣는 높이 16의 작은 칩이다. @default 'chip' */
  variant?: 'chip' | 'field'
  /** 목록 열림을 밖에서 정할 때 쓴다. 넘기지 않으면 칩을 눌러 열고 닫는다. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onValueChange: (id: string) => void
}

// 캐릭터 카드 머리의 서버 칩. 카드는 라이트 모드에서도 다크라서 칩과 목록을 카드 면으로 그린다.
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
      {/* 이름 칸 안 칩은 낮은 창(파티 163)에서 열리므로 서버 8개를 4열 2줄로 늘어놓아 다 보이게 한다. */}
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
