import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'
import type { CardCharacter, EquipmentSlot } from './types'

const styles = stylex.create({
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
  slot: (color: string) => ({
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: color,
    borderRadius: 4,
    aspectRatio: '1',
    overflow: 'hidden',
    minWidth: 0,
    backgroundColor: '#16181c'
  }),
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
  row: { backgroundColor: colors.card },
  alternate: { backgroundColor: colors.alternate },
  cell: { paddingInline: 6, paddingBlock: 0, textAlign: 'left', fontWeight: 400 },
  value: { textAlign: 'right', whiteSpace: 'nowrap' },
  enhancement: { color: '#ff75f5' },
  grade: (grade: string | undefined) => ({
    color: grade === '종결' ? '#50e3c2' : grade === '준종결' ? '#ffb400' : colors.muted
  }),
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 12 }
})

export function CardImage({
  src,
  label,
  portrait = false
}: {
  src?: string
  label: string
  portrait?: boolean
}): React.JSX.Element {
  const [failedSource, setFailedSource] = useState<string>()
  if (src == null || failedSource === src) {
    return (
      <span role="img" aria-label={`${label} 이미지 없음`} {...stylex.props(styles.placeholder)}>
        —
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={label}
      draggable={false}
      onError={() => setFailedSource(src)}
      {...stylex.props(styles.image, portrait && styles.zoom)}
    />
  )
}

// Explicit visual positions; equipment arrays may arrive in any order.
const positions = [
  ['SHOULDER', 1, 1],
  ['JACKET', 2, 1],
  ['PANTS', 1, 2],
  ['WAIST', 2, 2],
  ['SHOES', 1, 3],
  ['AURA', 1, 4],
  ['CREATURE', 2, 4],
  ['WEAPON', 3, 1],
  ['TITLE', 4, 1],
  ['WRIST', 3, 2],
  ['AMULET', 4, 2],
  ['SUPPORT', 3, 3],
  ['RING', 4, 3],
  ['EARRING', 3, 4],
  ['MAGIC_STON', 4, 4]
] as const

export function EquipmentGrid({
  character,
  oath = false,
  large = false
}: {
  character: CardCharacter
  oath?: boolean
  large?: boolean
}): React.JSX.Element {
  const slots = oath ? character.oath : character.equipment
  return (
    <div {...stylex.props(styles.equipment, large && styles.largeEquipment)}>
      {positions.map(([id, column, row]) => {
        const isExtra = ['AURA', 'CREATURE', 'TITLE'].includes(id)
        if (oath && !large && isExtra) {
          return null
        }
        const source = oath && large && isExtra ? character.equipment : slots
        const slot = source.find((item) => item.id === id)
        return (
          <div
            key={id}
            title={slot?.label ?? id}
            {...stylex.props(
              styles.slot(slot?.rarityColor ?? colors.border),
              styles.position(large && column > 2 ? column + 1 : column, row)
            )}
          >
            <CardImage src={slot?.image} label={slot?.label ?? id} />
          </div>
        )
      })}
      {large && (
        <div {...stylex.props(styles.portrait)}>
          <CardImage src={character.image} label="캐릭터" portrait />
        </div>
      )}
    </div>
  )
}

const investmentIds = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'WAIST',
  'SHOES',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]

export function InvestmentTable({
  equipment,
  kind = 'both',
  large = false
}: {
  equipment: EquipmentSlot[]
  kind?: 'both' | 'enhancement' | 'enchantment'
  large?: boolean
}): React.JSX.Element {
  return (
    <table
      aria-label={
        kind === 'enhancement'
          ? '강화 수치'
          : kind === 'enchantment'
            ? '마법부여 등급'
            : '투자 현황'
      }
      {...stylex.props(styles.table, large && styles.largeTable)}
    >
      <tbody>
        {investmentIds.map((id, index) => {
          const item = equipment.find((slot) => slot.id === id)
          return (
            <tr key={id} {...stylex.props(styles.row, index % 2 === 1 && styles.alternate)}>
              <th scope="row" {...stylex.props(styles.cell)}>
                {item?.label ?? id}
              </th>
              {kind !== 'enchantment' && (
                <td {...stylex.props(styles.cell, styles.value, styles.enhancement)}>
                  {item?.enhancement ?? '—'}
                </td>
              )}
              {kind !== 'enhancement' && (
                <td {...stylex.props(styles.cell, styles.value, styles.grade(item?.enchantment))}>
                  {item?.enchantment ?? '미평가'}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
