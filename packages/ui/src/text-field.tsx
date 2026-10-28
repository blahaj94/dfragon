import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import * as stylex from '@stylexjs/stylex'
import { createContext, useContext, type ComponentType, type ReactNode, type Ref } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './text-field.style'

export type TextFieldValueChangeDetails = { value: string }

type TextFieldSize = 'sm' | 'md' | 'lg'

export type TextFieldProps = {
  label?: ReactNode
  description?: ReactNode
  errorMessage?: ReactNode
  invalid?: boolean
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  name?: string
  value?: string
  defaultValue?: string
  onValueChange?: (details: TextFieldValueChangeDetails) => void
  size?: TextFieldSize
  children: ReactNode
  ref?: Ref<HTMLDivElement>
  fieldRef?: Ref<HTMLDivElement>
}

type TextFieldContextValue = Pick<
  TextFieldProps,
  'value' | 'defaultValue' | 'onValueChange' | 'readOnly' | 'required'
>

const TextFieldContext = createContext<TextFieldContextValue>({})

export function TextField({
  label,
  description,
  errorMessage,
  invalid = false,
  disabled = false,
  readOnly,
  required,
  name,
  value,
  defaultValue,
  onValueChange,
  size = 'md',
  children,
  ref,
  fieldRef
}: TextFieldProps) {
  const showsError = invalid && errorMessage != null

  return (
    <Field.Root
      ref={fieldRef}
      name={name}
      invalid={invalid}
      disabled={disabled}
      {...stylex.props(styles.field)}
    >
      {label != null && <Field.Label {...stylex.props(styles.label)}>{label}</Field.Label>}
      <div
        ref={ref}
        {...stylex.props(
          styles.box,
          styles[size],
          invalid && styles.invalid,
          disabled && styles.disabled
        )}
      >
        <TextFieldContext value={{ value, defaultValue, onValueChange, readOnly, required }}>
          {children}
        </TextFieldContext>
      </div>
      {description != null && (
        <Field.Description {...stylex.props(styles.description)}>{description}</Field.Description>
      )}
      {showsError && (
        <Field.Error match {...stylex.props(styles.error)}>
          {errorMessage}
        </Field.Error>
      )}
    </Field.Root>
  )
}

export type TextFieldInputProps = Omit<PublicProps<typeof Input>, 'ref'> & {
  ref?: Ref<HTMLInputElement>
}

function TextFieldInputImpl({
  onValueChange,
  className,
  style,
  ...inputProps
}: TextFieldInputProps & ForwardedStyle) {
  const field = useContext(TextFieldContext)
  const fieldValueChange = field.onValueChange

  return (
    <Input
      value={field.value}
      defaultValue={field.defaultValue}
      readOnly={field.readOnly}
      required={field.required}
      {...inputProps}
      onValueChange={(value, details) => {
        onValueChange?.(value, details)
        fieldValueChange?.({ value })
      }}
      {...withForwardedStyle(stylex.props(styles.input), { className, style })}
    />
  )
}

export const TextFieldInput: ComponentType<TextFieldInputProps> = TextFieldInputImpl
