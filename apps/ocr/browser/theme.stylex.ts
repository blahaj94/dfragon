import * as stylex from '@stylexjs/stylex'

// Names follow the dfragon-design semantic tokens. SEED palette steps resolve by the root
// data-seed-color-mode, so the dark theme only overrides tokens that use a different step.
export const colors = stylex.defineVars({
  bgCanvas: 'var(--seed-color-palette-gray-200)',
  bgSurface: 'var(--seed-color-palette-gray-00)',
  bgInset: 'var(--seed-color-palette-gray-100)',
  bgControl: 'var(--seed-color-palette-gray-300)',
  bgControlHover: 'var(--seed-color-palette-gray-400)',
  bgBrandSolid: 'var(--seed-color-palette-blue-700)',
  bgBrandSolidHover: 'var(--seed-color-palette-blue-800)',
  bgBrandWeak: 'var(--seed-color-palette-blue-100)',
  fgDefault: 'var(--seed-color-palette-gray-1000)',
  fgMuted: 'var(--seed-color-palette-gray-800)',
  fgSubtle: 'var(--seed-color-palette-gray-700)',
  fgPlaceholder: 'var(--seed-color-palette-gray-600)',
  fgBrand: 'var(--seed-color-palette-blue-700)',
  fgDanger: 'var(--seed-color-palette-red-700)',
  borderDefault: 'var(--seed-color-palette-gray-400)',
  borderBrand: 'var(--seed-color-palette-blue-700)',
  borderFocus: 'var(--seed-color-palette-blue-600)'
})

export const darkTheme = stylex.createTheme(colors, {
  bgCanvas: 'var(--seed-color-palette-gray-100)',
  bgSurface: 'var(--seed-color-palette-gray-200)',
  bgControl: 'var(--seed-color-palette-gray-400)',
  bgControlHover: 'var(--seed-color-palette-gray-500)',
  bgBrandSolid: 'var(--seed-color-palette-blue-600)',
  bgBrandSolidHover: 'var(--seed-color-palette-blue-700)',
  bgBrandWeak: 'var(--seed-color-palette-blue-200)',
  borderBrand: 'var(--seed-color-palette-blue-600)'
})
