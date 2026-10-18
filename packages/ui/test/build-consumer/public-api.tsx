import * as stylex from '@stylexjs/stylex'
import { createRef } from 'react'
import {
  ActionButton,
  Button,
  CardFrame,
  Checkbox,
  Chip,
  ContentStack,
  CornerBrackets,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ExampleSection,
  IconButton,
  Kbd,
  LoadingIndicator,
  Menu,
  NumericText,
  ProgressCircle,
  Select,
  StatusBadge,
  StatusChip,
  SupportingText,
  Switch,
  Tabs,
  TextField,
  TextFieldInput,
  Tooltip,
  Typo,
  shapes,
  typographyVariants
} from '@dfragon/ui'
import type {
  ActionButtonProps,
  ButtonProps,
  CardFrameProps,
  DialogActionProps,
  DialogBodyProps,
  DialogContentProps,
  DialogFooterProps,
  DialogRootProps,
  DialogTriggerProps,
  IconButtonProps,
  ProgressCircleProps,
  SelectPopupProps,
  StatusBadgeProps,
  StatusBadgeTone,
  StatusChipProps,
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
  Button,
  CardFrame,
  Checkbox,
  Chip,
  ContentStack,
  CornerBrackets,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ExampleSection,
  IconButton,
  Kbd,
  LoadingIndicator,
  NumericText,
  ProgressCircle,
  StatusBadge,
  StatusChip,
  SupportingText,
  Switch,
  TextField,
  TextFieldInput,
  Select.Trigger,
  Menu.Popup,
  Tabs.List,
  Tooltip.Popup
]

export type PublicProps = {
  button: ButtonProps
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
  selectPopup: SelectPopupProps
  statusChip: StatusChipProps
  statusBadge: StatusBadgeProps
  statusTone: StatusBadgeTone
  card: CardFrameProps
  typo: TypoProps<'button'>
  standaloneTypo: StandaloneTypoProps<'a'>
  tag: TypoTag
  variant: TypoVariant
}

export const button = (
  <Button variant="primary" ref={createRef<HTMLButtonElement>()}>
    산출물 소비자
  </Button>
)
export const legacyButton = <ActionButton variant="neutralOutline">이행 중 이름</ActionButton>
export const input = <TextFieldInput ref={createRef<HTMLInputElement>()} placeholder="입력" />
export const iconButton = (
  <IconButton
    aria-label="설정"
    ref={createRef<HTMLButtonElement>()}
    icon={<svg aria-hidden="true" />}
  />
)
export const select = (
  <Select.Root defaultValue="siroco">
    <Select.Trigger size="xs" aria-label="서버">
      <Select.Value />
    </Select.Trigger>
    <Select.Popup aria-label="서버">
      <Select.Item value="siroco">
        <Select.ItemText>시로코</Select.ItemText>
      </Select.Item>
    </Select.Popup>
  </Select.Root>
)
export const statusChip = (
  <StatusChip tone="success" role="status">
    연결됨
  </StatusChip>
)
export const card = (
  <CardFrame state="top">
    <NumericText value={414806} />
  </CardFrame>
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

// @ts-expect-error 공개 Button은 화면별 className override를 허용하지 않는다.
export const unsupportedAppearance = <Button className="override" />
// @ts-expect-error 기본 p 태그에는 anchor 전용 href를 전달할 수 없다.
export const unsupportedNativeAttribute = <StandaloneTypo.txtM href="/example" />
// @ts-expect-error 내부 source는 package export가 아니다.
export type InternalSourceEntry = typeof import('@dfragon/ui/src/button')
