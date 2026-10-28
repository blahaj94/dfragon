import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import * as stylex from '@stylexjs/stylex'
import { createContext, useContext, type ComponentType, type ReactNode, type Ref } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './text-field.style'

type TextFieldSize = 'sm' | 'md' | 'lg'

type TextFieldState = { invalid: boolean; disabled: boolean; size: TextFieldSize }

const TextFieldStateContext = createContext<TextFieldState>({
  invalid: false,
  disabled: false,
  size: 'md'
})

export type TextFieldProps = {
  invalid?: boolean
  disabled?: boolean
  name?: string
  size?: TextFieldSize
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

export function TextField({
  invalid = false,
  disabled = false,
  name,
  size = 'md',
  children,
  ref
}: TextFieldProps) {
  return (
    <Field.Root
      ref={ref}
      name={name}
      invalid={invalid}
      disabled={disabled}
      {...stylex.props(styles.field)}
    >
      <TextFieldStateContext value={{ invalid, disabled, size }}>{children}</TextFieldStateContext>
    </Field.Root>
  )
}

export type TextFieldLabelProps = PublicProps<typeof Field.Label>

function TextFieldLabelImpl({ className, style, ...props }: TextFieldLabelProps & ForwardedStyle) {
  return (
    <Field.Label
      {...props}
      {...withForwardedStyle(stylex.props(styles.label), { className, style })}
    />
  )
}

export const TextFieldLabel: ComponentType<TextFieldLabelProps> = TextFieldLabelImpl

export type TextFieldInputProps = Omit<PublicProps<typeof Input>, 'ref'> & {
  ref?: Ref<HTMLInputElement>
}

function TextFieldInputImpl({
  className,
  style,
  ...inputProps
}: TextFieldInputProps & ForwardedStyle) {
  const { invalid, disabled, size } = useContext(TextFieldStateContext)

  return (
    <div
      {...stylex.props(
        styles.box,
        styles[size],
        invalid && styles.invalid,
        disabled && styles.disabled
      )}
    >
      <Input
        {...inputProps}
        {...withForwardedStyle(stylex.props(styles.input), { className, style })}
      />
    </div>
  )
}

export const TextFieldInput: ComponentType<TextFieldInputProps> = TextFieldInputImpl

export type TextFieldDescriptionProps = PublicProps<typeof Field.Description>

function TextFieldDescriptionImpl({
  className,
  style,
  ...props
}: TextFieldDescriptionProps & ForwardedStyle) {
  return (
    <Field.Description
      {...props}
      {...withForwardedStyle(stylex.props(styles.description), { className, style })}
    />
  )
}

export const TextFieldDescription: ComponentType<TextFieldDescriptionProps> =
  TextFieldDescriptionImpl

export type TextFieldErrorProps = Omit<PublicProps<typeof Field.Error>, 'match'>

function TextFieldErrorImpl({ className, style, ...props }: TextFieldErrorProps & ForwardedStyle) {
  const { invalid } = useContext(TextFieldStateContext)
  if (!invalid) {
    return null
  }

  return (
    <Field.Error
      match
      {...props}
      {...withForwardedStyle(stylex.props(styles.error), { className, style })}
    />
  )
}

export const TextFieldError: ComponentType<TextFieldErrorProps> = TextFieldErrorImpl
