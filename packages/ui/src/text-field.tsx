import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import * as stylex from '@stylexjs/stylex'
import {
  createContext,
  isValidElement,
  useContext,
  type ComponentType,
  type ReactNode,
  type Ref
} from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './text-field.style'

export type TextFieldValueChangeDetails = { value: string }

type TextFieldSize = 'sm' | 'md' | 'lg'
/** @deprecated SEED TextField 크기 이름. `md`, `lg`로 옮기며 ActionButton alias와 함께 지운다. */
type LegacyTextFieldSize = 'medium' | 'large'

export type TextFieldProps = {
  label?: ReactNode
  description?: ReactNode
  /** `invalid`일 때만 보인다. */
  errorMessage?: ReactNode
  invalid?: boolean
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  name?: string
  value?: string
  defaultValue?: string
  onValueChange?: (details: TextFieldValueChangeDetails) => void
  /** sm 32, md 40, lg 48px 높이. @default 'md' */
  size?: TextFieldSize | LegacyTextFieldSize
  /** `TextFieldInput` 하나를 둔다. */
  children: ReactNode
  /** 입력 상자(테두리를 그리는 요소). */
  ref?: Ref<HTMLDivElement>
  /** label, 설명, 오류를 묶는 Field 요소. */
  fieldRef?: Ref<HTMLDivElement>
}

type TextFieldContextValue = Pick<
  TextFieldProps,
  'value' | 'defaultValue' | 'onValueChange' | 'readOnly' | 'required'
>

const TextFieldContext = createContext<TextFieldContextValue>({})

const sizes: Record<TextFieldSize | LegacyTextFieldSize, TextFieldSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  medium: 'md',
  large: 'lg'
}

// Base UI Field가 label, 설명, 오류를 입력의 접근 가능한 이름과 설명에 연결한다.
// value와 onValueChange는 안쪽 TextFieldInput에 전달한다.
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
          styles[sizes[size]],
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
  /**
   * 자식 요소 하나를 입력으로 렌더링한다. `render`와 같으며 ActionButton alias와 함께 지운다.
   * @deprecated `render`를 쓴다.
   */
  asChild?: boolean
}

function TextFieldInputImpl({
  asChild = false,
  children,
  render,
  onValueChange,
  className,
  style,
  ...inputProps
}: TextFieldInputProps & ForwardedStyle) {
  const field = useContext(TextFieldContext)
  const fieldValueChange = field.onValueChange
  const element = asChild && isValidElement(children) ? children : render

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
      render={element}
      {...withForwardedStyle(stylex.props(styles.input), { className, style })}
    />
  )
}

// Base UI Input. TextField 안에 두면 label, 설명, 오류와 value가 연결된다.
export const TextFieldInput: ComponentType<TextFieldInputProps> = TextFieldInputImpl
