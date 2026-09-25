import stylex from '@stylexjs/unplugin'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import react from '@vitejs/plugin-react'
import type { PluginOption } from 'vite'

export function rendererTransforms({ test = false }: { test?: boolean } = {}): PluginOption[] {
  return [
    // Compile before React Fast Refresh; emit CSS alongside the existing SEED stylesheet.
    // Vitest needs the compiler without the Vite adapter's HTTP/HMR timers.
    test ? stylex.rollup(stylexOptions) : stylex.vite(stylexOptions),
    react()
  ]
}
