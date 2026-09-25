import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  background: '#f3f4f6',
  panel: '#ffffff',
  inset: '#f3f4f6',
  control: '#e4e7eb',
  text: '#20242b',
  muted: '#626a76',
  border: '#d4d9e0',
  accent: '#ab4d0c',
  selected: '#fff0e5',
  primary: '#ab4d0c',
  onPrimary: '#ffffff',
  error: '#b13232'
})

export const darkTheme = stylex.createTheme(colors, {
  background: '#16181c',
  panel: '#292d33',
  inset: '#20242b',
  control: '#343b45',
  text: '#f3f4f6',
  muted: '#aeb5bf',
  border: '#48515e',
  accent: '#ffad78',
  selected: '#45382f',
  primary: '#ffad78',
  onPrimary: '#20242b',
  error: '#ff9f9f'
})
