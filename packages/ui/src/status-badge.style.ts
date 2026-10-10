import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  // SEED large Badge가 높이 24를 유지한다. 상태 글자가 말줄임으로 잘리지 않도록 폭 제한을 푼다.
  badge: {
    maxWidth: 'none',
    borderRadius: 'var(--seed-radius-full)',
    backgroundColor: 'var(--seed-color-palette-gray-100)'
  },
  neutral: { color: 'var(--seed-color-fg-neutral-subtle)' },
  informative: { color: 'var(--seed-color-fg-informative)' },
  critical: { color: 'var(--seed-color-fg-critical)' },
  warning: { color: 'var(--seed-color-fg-warning)' },
  positive: { color: 'var(--seed-color-fg-positive)' },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    marginInlineEnd: 6,
    verticalAlign: 'middle',
    borderRadius: '50%',
    backgroundColor: 'currentColor'
  }
})
