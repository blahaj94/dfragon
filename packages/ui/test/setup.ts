// jsdom에는 layout 관측이 없다. Base UI Positioner의 크기 관측만 격리하며
class LayoutObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, { ResizeObserver: LayoutObserver })
