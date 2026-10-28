import { Menu as BaseMenu } from '@base-ui/react/menu'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { listboxStyles } from './listbox.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './menu.style'

export type MenuPopupProps = PublicProps<typeof BaseMenu.Popup> &
  Pick<BaseMenu.Portal.Props, 'container'> &
  Pick<BaseMenu.Positioner.Props, 'side' | 'align' | 'sideOffset'>

function MenuPopupImpl({
  container,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  className,
  style,
  ...props
}: MenuPopupProps & ForwardedStyle) {
  return (
    <BaseMenu.Portal container={container}>
      <BaseMenu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        {...stylex.props(listboxStyles.positioner)}
      >
        <BaseMenu.Popup
          {...props}
          {...withForwardedStyle(stylex.props(listboxStyles.popup), { className, style })}
        />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

const MenuPopup: ComponentType<MenuPopupProps> = MenuPopupImpl

export type MenuItemProps = PublicProps<typeof BaseMenu.Item>

function MenuItemImpl({ className, style, ...props }: MenuItemProps & ForwardedStyle) {
  return (
    <BaseMenu.Item
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.item, styles.item), { className, style })}
    />
  )
}

const MenuItem: ComponentType<MenuItemProps> = MenuItemImpl

export type MenuRadioItemProps = PublicProps<typeof BaseMenu.RadioItem>

function MenuRadioItemImpl({
  children,
  className,
  style,
  ...props
}: MenuRadioItemProps & ForwardedStyle) {
  return (
    <BaseMenu.RadioItem
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.item, styles.item), { className, style })}
    >
      <BaseMenu.RadioItemIndicator {...stylex.props(listboxStyles.marker)}>
        {null}
      </BaseMenu.RadioItemIndicator>
      {children}
    </BaseMenu.RadioItem>
  )
}

const MenuRadioItem: ComponentType<MenuRadioItemProps> = MenuRadioItemImpl

export type MenuGroupLabelProps = PublicProps<typeof BaseMenu.GroupLabel>

function MenuGroupLabelImpl({ className, style, ...props }: MenuGroupLabelProps & ForwardedStyle) {
  return (
    <BaseMenu.GroupLabel
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.groupLabel), { className, style })}
    />
  )
}

const MenuGroupLabel: ComponentType<MenuGroupLabelProps> = MenuGroupLabelImpl

export type MenuSeparatorProps = PublicProps<typeof BaseMenu.Separator>

function MenuSeparatorImpl({ className, style, ...props }: MenuSeparatorProps & ForwardedStyle) {
  return (
    <BaseMenu.Separator
      {...props}
      {...withForwardedStyle(stylex.props(listboxStyles.separator), { className, style })}
    />
  )
}

const MenuSeparator: ComponentType<MenuSeparatorProps> = MenuSeparatorImpl

export const Menu = {
  Root: BaseMenu.Root,
  Trigger: BaseMenu.Trigger,
  Popup: MenuPopup,
  Item: MenuItem,
  RadioGroup: BaseMenu.RadioGroup,
  RadioItem: MenuRadioItem,
  Group: BaseMenu.Group,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator
}
