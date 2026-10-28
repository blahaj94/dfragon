import { type KeyboardEvent, useState } from 'react'

export function useServerMenu(): {
  open: boolean
  setOpen: (open: boolean) => void
  openOnTab: (event: KeyboardEvent<HTMLInputElement>) => void
} {
  const [open, setOpen] = useState(false)
  const openOnTab = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Tab' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    setOpen(true)
  }

  return { open, setOpen, openOnTab }
}
