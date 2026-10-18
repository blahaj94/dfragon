import { Dialog } from '@base-ui/react/dialog'
import * as stylex from '@stylexjs/stylex'
import { isValidElement, type ComponentType, type ReactNode, type Ref } from 'react'
import { Button, type ButtonProps } from './button'
import { CloseIcon } from './icons'
import { IconButton } from './icon-button'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './dialog.style'

export type DialogRootProps = Dialog.Root.Props

const LIST_SELECTOR = '[role="menu"], [role="listbox"]'

function isInsideList(target: EventTarget | null) {
  const isElement = target instanceof Element

  return isElement && target.closest(LIST_SELECTOR) != null
}

// 바깥을 눌러도 닫지 않는 것이 기본이다. 입력 중인 내용을 실수로 잃지 않게 한다.
// dialog 안에 펼친 메뉴나 목록에서 누른 Escape는 그 목록만 닫는다. Base UI 부품은 스스로
// 전파를 멈추지만, 다른 라이브러리의 목록은 같은 keydown이 dialog까지 올라온다.
export function DialogRoot({
  disablePointerDismissal = true,
  onOpenChange,
  ...props
}: DialogRootProps) {
  return (
    <Dialog.Root
      disablePointerDismissal={disablePointerDismissal}
      onOpenChange={(open, details) => {
        const isListEscape = details.reason === 'escape-key' && isInsideList(details.event.target)
        if (isListEscape) {
          details.cancel()

          return
        }
        onOpenChange?.(open, details)
      }}
      {...props}
    />
  )
}

export type DialogTriggerProps = Omit<PublicProps<typeof Dialog.Trigger>, 'ref'> & {
  ref?: Ref<HTMLButtonElement>
  /**
   * 자식 요소 하나를 trigger로 렌더링한다. `render`와 같으며 ActionButton alias와 함께 지운다.
   * @deprecated `render`를 쓴다.
   */
  asChild?: boolean
}

function DialogTriggerImpl({ asChild = false, children, render, ...props }: DialogTriggerProps) {
  if (asChild && isValidElement(children)) {
    return <Dialog.Trigger render={children} {...props} />
  }

  return (
    <Dialog.Trigger render={render} {...props}>
      {children}
    </Dialog.Trigger>
  )
}

export const DialogTrigger: ComponentType<DialogTriggerProps> = DialogTriggerImpl

export type DialogContentProps = Omit<PublicProps<typeof Dialog.Popup>, 'title' | 'ref'> & {
  ref?: Ref<HTMLDivElement>
  title?: ReactNode
  description?: ReactNode
  /** @default true */
  showCloseButton?: boolean
}

function DialogContentImpl({
  title,
  description,
  showCloseButton = true,
  children,
  className,
  style,
  ...popupProps
}: DialogContentProps & ForwardedStyle) {
  const showsHeader = title != null || description != null || showCloseButton

  return (
    <Dialog.Portal>
      <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
      <Dialog.Popup
        {...popupProps}
        {...withForwardedStyle(stylex.props(styles.popup), { className, style })}
      >
        {showsHeader && (
          <div {...stylex.props(styles.header)}>
            <div {...stylex.props(styles.heading)}>
              {title != null && (
                <Dialog.Title {...stylex.props(styles.title)}>{title}</Dialog.Title>
              )}
              {description != null && (
                <Dialog.Description {...stylex.props(styles.description)}>
                  {description}
                </Dialog.Description>
              )}
            </div>
            {showCloseButton && (
              <Dialog.Close
                render={<IconButton aria-label="닫기" icon={<CloseIcon />} />}
                {...stylex.props(styles.close)}
              />
            )}
          </div>
        )}
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  )
}

// Base UI Dialog의 Portal, Backdrop, Popup을 묶고 제목, 설명, 닫기 버튼을 둔다.
export const DialogContent: ComponentType<DialogContentProps> = DialogContentImpl

export type DialogBodyProps = PublicProps<'div'>

function DialogBodyImpl({ className, style, ...props }: DialogBodyProps & ForwardedStyle) {
  return <div {...props} {...withForwardedStyle(stylex.props(styles.body), { className, style })} />
}

export const DialogBody: ComponentType<DialogBodyProps> = DialogBodyImpl

export type DialogFooterProps = PublicProps<'div'>

function DialogFooterImpl({ className, style, ...props }: DialogFooterProps & ForwardedStyle) {
  return (
    <div {...props} {...withForwardedStyle(stylex.props(styles.footer), { className, style })} />
  )
}

export const DialogFooter: ComponentType<DialogFooterProps> = DialogFooterImpl

export type DialogActionProps = ButtonProps

// 누르면 dialog를 닫는 Button. 닫기 전에 할 일은 onClick에 둔다.
export function DialogAction(props: DialogActionProps) {
  return <Dialog.Close render={<Button {...props} />} />
}
