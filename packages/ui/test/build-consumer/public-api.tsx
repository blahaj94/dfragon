import { createRef } from 'react'
import {
  ActionButton,
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
  SupportingText,
  TextField,
  TextFieldInput,
  Typo,
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
  TextFieldInputProps,
  TextFieldProps,
  TypoProps,
  TypoTag,
  TypoVariant
} from '@dfragon/ui'
import { Typo as StandaloneTypo, typographyVariants as standaloneVariants } from '@dfragon/ui/typo'
import type { TypoProps as StandaloneTypoProps } from '@dfragon/ui/typo'

// 별도 tsconfig는 source alias 없이 package export의 dist declaration을 해석한다.
export const components = [
  ActionButton,
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

// @ts-expect-error 공개 ActionButton은 화면별 className override를 허용하지 않는다.
export const unsupportedAppearance = <ActionButton className="override" />
// @ts-expect-error 기본 p 태그에는 anchor 전용 href를 전달할 수 없다.
export const unsupportedNativeAttribute = <StandaloneTypo.txtM href="/example" />
// @ts-expect-error 고정 upstream의 내부 source는 package export가 아니다.
export type InternalSeedEntry = typeof import('@dfragon/ui/src/seed/action-button')
