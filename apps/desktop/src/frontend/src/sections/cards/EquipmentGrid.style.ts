import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
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
  portrait: { position: 'absolute', left: '29%', top: 0, width: '42%', height: '100%' }
})
