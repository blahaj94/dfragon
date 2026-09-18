import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  background: '#16181c',
  surface: '#292d33',
  card: '#22262c',
  alternate: '#2b3037',
  text: '#f3f4f6',
  muted: '#aeb5bf',
  border: '#454c56',
  accent: '#3392ff',
  adventure: '#a9d3ad',
  input: '#16181c',
  control: '#343b45',
  shellText: '#f3f4f6',
  shellMuted: '#aeb5bf'
})

// The approved light board keeps the character cards dark.
export const lightTheme = stylex.createTheme(colors, {
  background: '#f3f4f6',
  surface: '#ffffff',
  shellText: '#20242b',
  shellMuted: '#626a76'
})
