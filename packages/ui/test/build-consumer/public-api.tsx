import * as stylex from '@stylexjs/stylex'
import { createRef } from 'react'
import {
  ActionButton,
  Checkmark,
  ContentStack,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ExampleSection,
  IconButton,
  LayoutBlock,
  ProgressCircle,
  StatusBadge,
  SupportingText,
  TextField,
  TextFieldInput,
  Typo,
  shapes,
  typographyVariants
} from '@dfragon/ui'
import type {
  ActionButtonProps,
  DialogActionProps,
  DialogBodyProps,
  DialogContentProps,
  DialogFooterProps,
  DialogRootProps,
  DialogTriggerProps,
  IconButtonProps,
  LayoutBlockProps,
  ProgressCircleProps,
  StatusBadgeProps,
  StatusBadgeTone,
  TextFieldInputProps,
  TextFieldProps,
  TypoProps,
  TypoTag,
  TypoVariant
} from '@dfragon/ui'
import { Typo as StandaloneTypo, typographyVariants as standaloneVariants } from '@dfragon/ui/typo'
import type { TypoProps as StandaloneTypoProps } from '@dfragon/ui/typo'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

// 별도 tsconfig는 source alias 없이 package export의 dist declaration을 해석한다.
export const components = [
  ActionButton,
  Checkmark,
  ContentStack,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ExampleSection,
  IconButton,
  LayoutBlock,
  ProgressCircle,
  StatusBadge,
  SupportingText,
  TextField,
  TextFieldInput
]

export type PublicProps = {
  action: ActionButtonProps
  progress: ProgressCircleProps
  field: TextFieldProps
  input: TextFieldInputProps
  dialogRoot: DialogRootProps
  dialogTrigger: DialogTriggerProps
  dialogContent: DialogContentProps
  dialogBody: DialogBodyProps
  dialogFooter: DialogFooterProps
  dialogAction: DialogActionProps
  iconButton: IconButtonProps
  statusBadge: StatusBadgeProps
  statusTone: StatusBadgeTone
  layout: LayoutBlockProps
  typo: TypoProps<'button'>
  standaloneTypo: StandaloneTypoProps<'a'>
  tag: TypoTag
  variant: TypoVariant
}

export const button = (
  <ActionButton variant="neutralOutline" ref={createRef<HTMLButtonElement>()}>
    산출물 소비자
  </ActionButton>
)
export const input = <TextFieldInput ref={createRef<HTMLInputElement>()} placeholder="입력" />
export const iconButton = (
  <IconButton
    variant="ghost"
    aria-label="설정"
    ref={createRef<HTMLButtonElement>()}
    icon={<svg aria-hidden="true" />}
  />
)
export const statusBadge = (
  <StatusBadge tone="positive" role="status">
    연결됨
  </StatusBadge>
)
export const paragraph = <Typo.txtM style={typographyVariants.txtM}>공개 entry</Typo.txtM>
export const link = (
  <StandaloneTypo.txtM
    as="a"
    href="/example"
    ref={createRef<HTMLAnchorElement>()}
    style={standaloneVariants.txtM}
  >
    React 전용 entry
  </StandaloneTypo.txtM>
)

// 소비자 compiler가 package export의 토큰 상수와 dist의 공용 형태를 함께 정적 CSS로 만든다.
const consumerStyles = stylex.create({
  signal: { backgroundColor: colors.signal, transitionDuration: motion.durHover }
})
export const primaryShape = <div {...stylex.props(consumerStyles.signal, shapes.cutTopRight)} />

// @ts-expect-error 공개 ActionButton은 화면별 className override를 허용하지 않는다.
export const unsupportedAppearance = <ActionButton className="override" />
// @ts-expect-error 기본 p 태그에는 anchor 전용 href를 전달할 수 없다.
export const unsupportedNativeAttribute = <StandaloneTypo.txtM href="/example" />
// @ts-expect-error 고정 upstream의 내부 source는 package export가 아니다.
export type InternalSeedEntry = typeof import('@dfragon/ui/src/seed/action-button')
