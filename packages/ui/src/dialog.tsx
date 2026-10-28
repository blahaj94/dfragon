import { Dialog } from '@base-ui/react/dialog'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType, Ref } from 'react'
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

// Base UI 부품은 스스로 전파를 멈추지만, 다른 라이브러리의 목록은 같은 keydown이 dialog까지 올라온다.
export function DialogRoot({
  disablePointerDismissal = true,
  onOpenChange,
  ...props
}: DialogRootProps) {
  const handleOpenChange: DialogRootProps['onOpenChange'] = (open, details) => {
    const isListEscape = details.reason === 'escape-key' && isInsideList(details.event.target)
    if (isListEscape) {
      details.cancel()

      return
    }
    onOpenChange?.(open, details)
  }

  return (
    <Dialog.Root
      disablePointerDismissal={disablePointerDismissal}
      onOpenChange={handleOpenChange}
      {...props}
    />
  )
}

export type DialogTriggerProps = Omit<PublicProps<typeof Dialog.Trigger>, 'ref'> & {
  ref?: Ref<HTMLButtonElement>
}

export const DialogTrigger: ComponentType<DialogTriggerProps> = Dialog.Trigger

export type DialogContentProps = Omit<PublicProps<typeof Dialog.Popup>, 'title' | 'ref'> & {
  ref?: Ref<HTMLDivElement>
  size?: 'sm' | 'lg'
}

function DialogContentImpl({
  size = 'sm',
  className,
  style,
  ...popupProps
}: DialogContentProps & ForwardedStyle) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop {...stylex.props(styles.backdrop)} />
      <Dialog.Popup
        {...popupProps}
        {...withForwardedStyle(stylex.props(styles.popup, styles[size]), { className, style })}
      />
    </Dialog.Portal>
  )
}

export const DialogContent: ComponentType<DialogContentProps> = DialogContentImpl

export type DialogHeaderProps = PublicProps<'div'> & {
  showCloseButton?: boolean
}

function DialogHeaderImpl({
  showCloseButton = true,
  children,
  className,
  style,
  ...props
}: DialogHeaderProps & ForwardedStyle) {
  return (
    <div {...props} {...withForwardedStyle(stylex.props(styles.header), { className, style })}>
      <div {...stylex.props(styles.heading)}>{children}</div>
      {showCloseButton && (
        <Dialog.Close
          render={<IconButton aria-label="닫기" icon={<CloseIcon />} />}
          {...stylex.props(styles.close)}
        />
      )}
    </div>
  )
}

export const DialogHeader: ComponentType<DialogHeaderProps> = DialogHeaderImpl

export type DialogTitleProps = PublicProps<typeof Dialog.Title>

function DialogTitleImpl({ className, style, ...props }: DialogTitleProps & ForwardedStyle) {
  return (
    <Dialog.Title
      {...props}
      {...withForwardedStyle(stylex.props(styles.title), { className, style })}
    />
  )
}

export const DialogTitle: ComponentType<DialogTitleProps> = DialogTitleImpl

export type DialogDescriptionProps = PublicProps<typeof Dialog.Description>

function DialogDescriptionImpl({
  className,
  style,
  ...props
}: DialogDescriptionProps & ForwardedStyle) {
  return (
    <Dialog.Description
      {...props}
      {...withForwardedStyle(stylex.props(styles.description), { className, style })}
    />
  )
}

export const DialogDescription: ComponentType<DialogDescriptionProps> = DialogDescriptionImpl

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

export function DialogAction(props: DialogActionProps) {
  return <Dialog.Close render={<Button {...props} />} />
}
