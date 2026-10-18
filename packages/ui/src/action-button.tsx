import type { ComponentType } from 'react'
import { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './button'
import type { ForwardedStyle } from './public-props'

// SEED ActionButton에서 Button으로 옮기는 동안만 두는 이름. 기존 variant, size, layout 값을
// Button 값으로 바꿔 전달하며 Desktop DFragon 디자인 적용의 마지막 PR에서 지운다.
type LegacyVariant =
  | 'brandSolid'
  | 'neutralSolid'
  | 'neutralWeak'
  | 'criticalSolid'
  | 'brandOutline'
  | 'neutralOutline'
  | 'ghost'
type LegacySize = 'xsmall' | 'small' | 'medium' | 'large'

const variants: Record<LegacyVariant, ButtonVariant> = {
  brandSolid: 'primary',
  neutralSolid: 'secondary',
  neutralWeak: 'secondary',
  criticalSolid: 'danger',
  brandOutline: 'secondary',
  neutralOutline: 'secondary',
  ghost: 'ghost'
}
const sizes: Record<LegacySize, ButtonSize> = {
  xsmall: 'sm',
  small: 'sm',
  medium: 'md',
  large: 'lg'
}

/** @deprecated `Button`을 쓴다. */
export type ActionButtonProps = Omit<ButtonProps, 'variant' | 'size'> & {
  /** SEED 기본값과 같은 `brandSolid`(Button `primary`)가 기본이다. */
  variant?: LegacyVariant
  size?: LegacySize
  /** 아이콘만 둘 때는 `IconButton`을 쓴다. Button 외형에 영향이 없다. */
  layout?: 'withText' | 'iconOnly'
}

function ActionButtonImpl({
  variant = 'brandSolid',
  size = 'medium',
  layout: _layout,
  ...props
}: ActionButtonProps & ForwardedStyle) {
  return <Button variant={variants[variant]} size={sizes[size]} {...props} />
}

/** @deprecated `Button`을 쓴다. */
export const ActionButton: ComponentType<ActionButtonProps> = ActionButtonImpl
