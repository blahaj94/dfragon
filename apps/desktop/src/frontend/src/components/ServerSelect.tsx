import { Select } from '@dfragon/ui'

type ServerSelectProps = {
  label: string
  value: string
  options: readonly { id: string; label: string }[]
  disabled?: boolean
  onValueChange: (id: string) => void
}

// 캐릭터 카드 머리의 서버 칩. 카드는 라이트 모드에서도 다크라서 칩과 목록을 카드 면으로 그린다.
export function ServerSelect({
  label,
  value,
  options,
  disabled = false,
  onValueChange
}: ServerSelectProps): React.JSX.Element {
  return (
    <Select.Root
      value={value || null}
      onValueChange={(next: string | null) => {
        if (next != null) {
          onValueChange(next)
        }
      }}
      items={options.map((option) => ({ value: option.id, label: option.label }))}
      disabled={disabled}
    >
      <Select.Trigger size="xs" surface="card" aria-label={label}>
        <Select.Value placeholder="서버" />
      </Select.Trigger>
      <Select.Popup surface="card" aria-label={label}>
        {options.map((option) => (
          <Select.Item key={option.id} value={option.id}>
            <Select.ItemText>{option.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}
