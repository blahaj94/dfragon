import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import type { PluginOption } from 'vite'

export function rendererTransforms({ test = false }: { test?: boolean } = {}): PluginOption[] {
  const options = { runtimeInjection: false, useCSSLayers: false }
  return [
    // Compile before React Fast Refresh; emit CSS alongside the existing SEED stylesheet.
    // Vitest needs the compiler without the Vite adapter's HTTP/HMR timers.
    test ? stylex.rollup(options) : stylex.vite(options),
    react()
  ]
}
