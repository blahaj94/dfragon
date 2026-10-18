// jsdom에는 layout 관측이 없다. Base UI Positioner의 크기 관측만 격리하며
// click, 키보드, 입력, Dialog/focus 구현은 실제 Base UI runtime으로 실행한다.
class LayoutObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, { ResizeObserver: LayoutObserver })
