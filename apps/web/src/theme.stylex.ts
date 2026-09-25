import * as stylex from '@stylexjs/stylex'

export const colors = stylex.defineVars({
  heading: { default: '#08060d', '@media (prefers-color-scheme: dark)': '#f3f4f6' },
  border: { default: '#e5e4e7', '@media (prefers-color-scheme: dark)': '#2e303a' },
  code: { default: '#f4f3ec', '@media (prefers-color-scheme: dark)': '#1f2028' },
  social: {
    default: 'rgba(244, 243, 236, 0.5)',
    '@media (prefers-color-scheme: dark)': 'rgba(47, 48, 58, 0.5)'
  },
  shadow: {
    default: 'rgba(0, 0, 0, 0.1) 0 10px 15px -3px, rgba(0, 0, 0, 0.05) 0 4px 6px -2px',
    '@media (prefers-color-scheme: dark)':
      'rgba(0, 0, 0, 0.4) 0 10px 15px -3px, rgba(0, 0, 0, 0.25) 0 4px 6px -2px'
  }
})
