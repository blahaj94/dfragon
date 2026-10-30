export function blockNativeDrag(target: Document): void {
  target.addEventListener('dragstart', (event) => {
    if (event.target instanceof HTMLElement && event.target.getAttribute('draggable') === 'true') {
      return
    }
    event.preventDefault()
  })
}
