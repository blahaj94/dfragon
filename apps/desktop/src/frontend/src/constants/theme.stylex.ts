import * as stylex from '@stylexjs/stylex'

// Semantic tokens from dfragon-design design/colors.md. SEED palette steps adapt to the
// document color mode, so the defaults are the dark steps and lightTheme overrides only the
// tokens whose step differs in light mode. Apply lightTheme wherever the light document mode
// is active, including portals outside <main>.
// Card tokens keep the dark values as literals because character cards stay dark in both modes.
export const colors = stylex.defineVars({
  bgCanvas: 'var(--seed-color-palette-gray-100)',
  bgSurface: 'var(--seed-color-palette-gray-200)',
  bgInset: 'var(--seed-color-palette-gray-100)',
  bgControl: 'var(--seed-color-palette-gray-400)',
  bgControlHover: 'var(--seed-color-palette-gray-500)',
  bgBrandSolid: 'var(--seed-color-palette-blue-600)',
  bgBrandWeak: 'var(--seed-color-palette-blue-200)',
  fgDefault: 'var(--seed-color-palette-gray-1000)',
  fgMuted: 'var(--seed-color-palette-gray-800)',
  fgBrand: 'var(--seed-color-palette-blue-700)',
  fgInfo: 'var(--seed-color-palette-blue-700)',
  fgSuccess: 'var(--seed-color-palette-green-700)',
  fgWarning: 'var(--seed-color-palette-yellow-700)',
  fgDanger: 'var(--seed-color-palette-red-700)',
  borderDefault: 'var(--seed-color-palette-gray-400)',
  borderStrong: 'var(--seed-color-palette-gray-500)',
  borderFocus: 'var(--seed-color-palette-blue-600)',
  borderDanger: 'var(--seed-color-palette-red-600)',
  cardBg: '#1d2025',
  cardInset: '#16171b',
  cardStripe: '#2b2e35',
  cardControl: '#393d46',
  // The design card set has no hover or selected fill, so these keep the dark values of
  // bg.controlHover and bg.brand.weak for the server menu that stays dark in light mode.
  cardControlHover: '#5b606a',
  cardBrandWeak: '#1e3352',
  cardBorder: '#393d46',
  cardFg: '#f3f4f5',
  cardFgMuted: '#dcdee3',
  cardFgAdventure: '#93e5c0',
  enchantFinal: '#50e3c2',
  enchantSemi: '#ffb400',
  enchantOther: '#ffffff',
  gameAmplify: '#ff75f5'
})

export const lightTheme = stylex.createTheme(colors, {
  bgCanvas: 'var(--seed-color-palette-gray-200)',
  bgSurface: 'var(--seed-color-palette-gray-00)',
  bgControl: 'var(--seed-color-palette-gray-300)',
  bgControlHover: 'var(--seed-color-palette-gray-400)',
  bgBrandSolid: 'var(--seed-color-palette-blue-700)',
  bgBrandWeak: 'var(--seed-color-palette-blue-100)',
  borderDanger: 'var(--seed-color-palette-red-700)'
})
