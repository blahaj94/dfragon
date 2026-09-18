import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'

export const styles = stylex.create({
  image: { width: '100%', height: '100%', objectFit: 'contain' },
  zoom: { transform: 'scale(1.7)' },
  placeholder: {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    height: '100%',
    color: colors.muted,
    fontSize: 12
  },
  equipment: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 8,
    width: '100%',
    maxWidth: 176,
    marginInline: 'auto'
  },
  largeEquipment: {
    maxWidth: 480,
    columnGap: 8,
    rowGap: 12,
    gridTemplateColumns: '64px 64px minmax(80px, 1fr) 64px 64px',
    position: 'relative'
  },
  slot: {
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 4,
    aspectRatio: '1',
    overflow: 'hidden',
    minWidth: 0,
    backgroundColor: '#16181c'
  },
  rarity: (color: string) => ({ borderColor: color }),
  position: (column: number, row: number) => ({ gridColumn: column, gridRow: row }),
  portrait: { position: 'absolute', left: '29%', top: 0, width: '42%', height: '100%' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 10,
    fontWeight: 400,
    lineHeight: '18px',
    color: colors.text
  },
  largeTable: { fontSize: 14, lineHeight: '28px', maxWidth: 560, marginInline: 'auto' },
  row: {
    backgroundColor: {
      default: colors.card,
      ':nth-child(even)': colors.alternate
    }
  },
  cell: { paddingInline: 6, paddingBlock: 0, textAlign: 'left', fontWeight: 400 },
  value: { textAlign: 'right', whiteSpace: 'nowrap' },
  enhancement: { color: '#ff75f5' }
})

export const gradeStyles = stylex.create({
  종결: { color: '#50e3c2' },
  준종결: { color: '#ffb400' },
  기타: { color: '#ffffff' },
  미평가: { color: colors.muted }
})
