import { Select as BaseSelect } from '@base-ui/react/select'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { ChevronDownIcon } from './icons'
import { listboxStyles } from './listbox.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './select.style'

export type SelectTriggerProps = PublicProps<typeof BaseSelect.Trigger> & {
  /** xs 24, sm 32, md 40px 높이. @default 'sm' */
  size?: 'xs' | 'sm' | 'md'
}

function SelectTriggerImpl({
  size = 'sm',
  children,
  className,
  style,
  ...props
}: SelectTriggerProps & ForwardedStyle) {
  return (
    <BaseSelect.Trigger
      {...props}
      {...withForwardedStyle(
        stylex.props(
          styles.trigger,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles[size]
        ),
        { className, style }
      )}
    >
      {children}
      <BaseSelect.Icon {...stylex.props(styles.icon)}>
        <ChevronDownIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
}

const SelectTrigger: ComponentType<SelectTriggerProps> = SelectTriggerImpl

export type SelectValueProps = PublicProps<typeof BaseSelect.Value>

function SelectValueImpl({ className, style, ...props }: SelectValueProps & ForwardedStyle) {
  return (
    <BaseSelect.Value
      {...props}
      {...withForwardedStyle(stylex.props(styles.value), { className, style })}
    />
  )
}

const SelectValue: ComponentType<SelectValueProps> = SelectValueImpl

export type SelectPopupProps = PublicProps<typeof BaseSelect.Popup> &
  Pick<BaseSelect.Portal.Props, 'container'> &
  Pick<BaseSelect.Positioner.Props, 'side' | 'align' | 'sideOffset'>

// Portal, Positioner, Popup, List를 묶은 목록. trigger 바로 아래에서 위쪽을 기준으로 펼친다.
function SelectPopupImpl({
  container,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  children,
  className,
  style,
  'aria-label': label,
  'aria-labelledby': labelledBy,
  ...props
}: SelectPopupProps & ForwardedStyle) {
  return (
    <BaseSelect.Portal container={container}>
      <BaseSelect.Positioner
        alignItemWithTrigger={false}
        side={side}
        align={align}
        sideOffset={sideOffset}
        {...stylex.props(listboxStyles.positioner)}
      >
        <BaseSelect.Popup
          {...props}
          {...withForwardedStyle(stylex.props(listboxStyles.popup), { className, style })}
        >
          {/* Popup은 presentation이고 listbox 역할은 List가 가지므로 이름은 List에 붙인다. */}
          <BaseSelect.List aria-label={label} aria-labelledby={labelledBy}>
            {children}
          </BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
}

const SelectPopup: ComponentType<SelectPopupProps> = SelectPopupImpl

export type SelectItemProps = PublicProps<typeof BaseSelect.Item>

function SelectItemImpl({
  children,
  className,
  style,
  ...props
}: SelectItemProps & ForwardedStyle) {
  return (
    <BaseSelect.Item
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.item, styles.item), { className, style })}
    >
      {/* 기본 글자(체크 이모지) 대신 빈 막대로 그린다. */}
      <BaseSelect.ItemIndicator {...stylex.props(listboxStyles.marker)}>
        {null}
      </BaseSelect.ItemIndicator>
      {children}
    </BaseSelect.Item>
  )
}

const SelectItem: ComponentType<SelectItemProps> = SelectItemImpl

export type SelectGroupLabelProps = PublicProps<typeof BaseSelect.GroupLabel>

function SelectGroupLabelImpl({
  className,
  style,
  ...props
}: SelectGroupLabelProps & ForwardedStyle) {
  return (
    <BaseSelect.GroupLabel
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.groupLabel), { className, style })}
    />
  )
}

const SelectGroupLabel: ComponentType<SelectGroupLabelProps> = SelectGroupLabelImpl

export type SelectSeparatorProps = PublicProps<typeof BaseSelect.Separator>

function SelectSeparatorImpl({
  className,
  style,
  ...props
}: SelectSeparatorProps & ForwardedStyle) {
  return (
    <BaseSelect.Separator
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.separator), { className, style })}
    />
  )
}

const SelectSeparator: ComponentType<SelectSeparatorProps> = SelectSeparatorImpl

/**
 * Base UI Select 부품. Root, ItemText, Group은 Base UI 그대로이고 나머지는 외형만 그린다.
 * 항목 글자는 `Select.ItemText`로 감싸야 trigger의 `Select.Value`에 같은 글자가 보인다.
 */
export const Select = {
  Root: BaseSelect.Root,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Popup: SelectPopup,
  Item: SelectItem,
  ItemText: BaseSelect.ItemText,
  Group: BaseSelect.Group,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator
}
