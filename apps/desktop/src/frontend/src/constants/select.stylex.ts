import * as stylex from '@stylexjs/stylex'

export const selectColors = stylex.defineVars({
  input: '#1c1f24',
  border: '#454a52',
  hover: '#343941',
  selected: '#3d3020',
  selectedIcon: '#624416',
  accent: '#ffb34d',
  divider: '#3b4048',
  shadow: 'rgba(0, 0, 0, 0.35)'
})

export const selectLightTheme = stylex.createTheme(selectColors, {
  input: '#f7f8fa',
  border: '#d1d5db',
  hover: '#f0f2f5',
  selected: '#fff2df',
  selectedIcon: '#ffe4ba',
  accent: '#995b00',
  divider: '#e5e7eb',
  shadow: 'rgba(0, 0, 0, 0.16)'
})
