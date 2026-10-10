import type { ComponentType } from 'react'
import type { PublicProps } from './public-props'
import { ActionButton as SeedActionButton } from './seed/action-button'
import { ProgressCircle as SeedProgressCircle } from './seed/progress-circle'
import { TextFieldInput as SeedTextFieldInput } from './seed/text-field'
import {
  DialogRoot as SeedDialogRoot,
  DialogTrigger as SeedDialogTrigger,
  DialogContent as SeedDialogContent,
  DialogBody as SeedDialogBody,
  DialogFooter as SeedDialogFooter,
  DialogAction as SeedDialogAction
} from './seed/dialog'

// TextField를 제외한 공식 Snippet은 runtime wrapper 없이 제공한다. 디자인 컴포넌트와 TextField
// 포커스 색은 SEED 변수만 쓰는 StyleX로 외형을 소유한다.
export type ActionButtonProps = PublicProps<typeof SeedActionButton>
export const ActionButton: ComponentType<ActionButtonProps> = SeedActionButton

export type ProgressCircleProps = PublicProps<typeof SeedProgressCircle>
export const ProgressCircle: ComponentType<ProgressCircleProps> = SeedProgressCircle

export { TextField } from './text-field'
export type { TextFieldProps } from './text-field'
export type TextFieldInputProps = PublicProps<typeof SeedTextFieldInput>
export const TextFieldInput: ComponentType<TextFieldInputProps> = SeedTextFieldInput

export type DialogRootProps = PublicProps<typeof SeedDialogRoot>
export const DialogRoot: ComponentType<DialogRootProps> = SeedDialogRoot
export type DialogTriggerProps = PublicProps<typeof SeedDialogTrigger>
export const DialogTrigger: ComponentType<DialogTriggerProps> = SeedDialogTrigger
export type DialogContentProps = Omit<PublicProps<typeof SeedDialogContent>, 'layerIndex'>
export const DialogContent: ComponentType<DialogContentProps> = SeedDialogContent
export type DialogBodyProps = PublicProps<typeof SeedDialogBody>
export const DialogBody: ComponentType<DialogBodyProps> = SeedDialogBody
export type DialogFooterProps = PublicProps<typeof SeedDialogFooter>
export const DialogFooter: ComponentType<DialogFooterProps> = SeedDialogFooter
export type DialogActionProps = PublicProps<typeof SeedDialogAction>
export const DialogAction: ComponentType<DialogActionProps> = SeedDialogAction

export { IconButton } from './icon-button'
export type { IconButtonProps } from './icon-button'
export { StatusBadge } from './status-badge'
export type { StatusBadgeProps, StatusBadgeTone } from './status-badge'
export { Checkmark } from './checkmark'

export { default as LayoutBlock } from './seed/layout-01'
export type { LayoutBlockProps } from './seed/layout-01'
export { ContentStack, ExampleSection, SupportingText } from './composition'
export { Typo, typographyVariants } from './typo'
export type { TypoProps, TypoTag, TypoVariant } from './typo'
