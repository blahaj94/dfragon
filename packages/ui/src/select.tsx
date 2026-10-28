import { Select as BaseSelect } from '@base-ui/react/select'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { ChevronDownIcon } from './icons'
import { listboxStyles } from './listbox.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './select.style'
import { shapes } from './shapes'
import type { ControlSurface } from './surface'

export type SelectTriggerProps = PublicProps<typeof BaseSelect.Trigger> & {
  size?: '2xs' | 'xs' | 'sm' | 'md'
  surface?: ControlSurface
}

function SelectTriggerImpl({
  size = 'sm',
  surface = 'default',
  children,
  className,
  style,
  ...props
}: SelectTriggerProps & ForwardedStyle) {
  return (
    <BaseSelect.Trigger
      {...props}
      data-surface={surface}
      {...withForwardedStyle(
        stylex.props(
          styles.trigger,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles[size],
          size === '2xs' && shapes.cutTopRight,
          surface === 'card' && styles.cardTrigger
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
  Pick<BaseSelect.Positioner.Props, 'side' | 'align' | 'sideOffset'> & {
    surface?: ControlSurface
    columns?: number
  }

function SelectPopupImpl({
  container,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  surface = 'default',
  columns,
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
          data-surface={surface}
          {...withForwardedStyle(
            stylex.props(
              listboxStyles.popup,
              surface === 'card' && listboxStyles.cardPopup,
              stylex.defaultMarker()
            ),
            { className, style }
          )}
        >
          {/* Popup은 presentation이고 listbox 역할은 List가 가지므로 이름은 List에 붙인다. */}
          <BaseSelect.List
            aria-label={label}
            aria-labelledby={labelledBy}
            {...stylex.props(columns !== undefined && styles.grid(columns))}
          >
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
      {/* Base UI는 children이 없으면 체크 이모지를 넣으므로 null을 넘긴다. */}
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
