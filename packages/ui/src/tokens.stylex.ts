import * as stylex from '@stylexjs/stylex'

// StyleX compiler는 import 경로가 .stylex로 끝나는 파일의 defineConsts만 다른 파일에서 읽는다.
// 값은 tokens.css의 --df-* 변수 참조이므로 모드 전환은 CSS만으로 끝나고 런타임 테마가 없다.

export const colors = stylex.defineConsts({
  bgCanvas: 'var(--df-bg-canvas)',
  bgBar: 'var(--df-bg-bar)',
  bgSurface: 'var(--df-bg-surface)',
  bgInset: 'var(--df-bg-inset)',
  bgStripe: 'var(--df-bg-stripe)',
  bgControl: 'var(--df-bg-control)',
  bgControlHover: 'var(--df-bg-control-hover)',
  bgWell: 'var(--df-bg-well)',
  bgSuccessWeak: 'var(--df-bg-success-weak)',
  bgDangerWeak: 'var(--df-bg-danger-weak)',
  bgWarningWeak: 'var(--df-bg-warning-weak)',
  bgOverlay: 'var(--df-bg-overlay)',
  signal: 'var(--df-signal)',
  onSignal: 'var(--df-on-signal)',
  brandLogo: 'var(--df-brand-logo)',
  fgDefault: 'var(--df-fg-default)',
  fgMuted: 'var(--df-fg-muted)',
  fgSubtle: 'var(--df-fg-subtle)',
  fgPlaceholder: 'var(--df-fg-placeholder)',
  fgDisabled: 'var(--df-fg-disabled)',
  fgSuccess: 'var(--df-fg-success)',
  fgDanger: 'var(--df-fg-danger)',
  fgWarning: 'var(--df-fg-warning)',
  fgAdventure: 'var(--df-fg-adventure)',
  borderDefault: 'var(--df-border-default)',
  borderStrong: 'var(--df-border-strong)',
  borderDanger: 'var(--df-border-danger)',
  tierTop: 'var(--df-tier-top)',
  tierRanker: 'var(--df-tier-ranker)',
  tierRankerSurface: 'var(--df-tier-ranker-surface)',
  tierRankerWell: 'var(--df-tier-ranker-well)',
  tierRankerOutline: 'var(--df-tier-ranker-outline)',
  scoreDealer: 'var(--df-score-dealer)',
  scoreBuffer: 'var(--df-score-buffer)',
  cardBg: 'var(--df-card-bg)',
  cardBgWaiting: 'var(--df-card-bg-waiting)',
  cardInset: 'var(--df-card-inset)',
  cardStripe: 'var(--df-card-stripe)',
  cardControl: 'var(--df-card-control)',
  cardControlHover: 'var(--df-card-control-hover)',
  cardBorder: 'var(--df-card-border)',
  cardBorderStrong: 'var(--df-card-border-strong)',
  cardDivider: 'var(--df-card-divider)',
  cardFg: 'var(--df-card-fg)',
  cardFgMuted: 'var(--df-card-fg-muted)',
  cardFgSubtle: 'var(--df-card-fg-subtle)',
  cardFgAdventure: 'var(--df-card-fg-adventure)',
  cardSignal: 'var(--df-card-signal)',
  cardOnSignal: 'var(--df-card-on-signal)',
  bracketDefault: 'var(--df-bracket-default)',
  bracketSelected: 'var(--df-bracket-selected)',
  bracketDanger: 'var(--df-bracket-danger)',
  bracketFailure: 'var(--df-bracket-failure)',
  bracketTop: 'var(--df-bracket-top)',
  bracketRanker: 'var(--df-bracket-ranker)',
  cardFailure: 'var(--df-card-failure)',
  cardFailureWeak: 'var(--df-card-failure-weak)',
  hatchAlert: 'var(--df-hatch-alert)',
  gridLine: 'var(--df-grid-line)',
  brandDragon: 'var(--df-brand-dragon)',
  brandCream: 'var(--df-brand-cream)',
  brandOutline: 'var(--df-brand-outline)',
  rarityCommon: 'var(--df-rarity-common)',
  rarityUncommon: 'var(--df-rarity-uncommon)',
  rarityRare: 'var(--df-rarity-rare)',
  rarityUnique: 'var(--df-rarity-unique)',
  rarityEpic: 'var(--df-rarity-epic)',
  rarityLegendary: 'var(--df-rarity-legendary)',
  rarityChronicle: 'var(--df-rarity-chronicle)',
  rarityPrimordial: 'var(--df-rarity-primordial)',
  enchantFinal: 'var(--df-enchant-final)',
  enchantSemi: 'var(--df-enchant-semi)',
  enchantOther: 'var(--df-enchant-other)',
  gameEnhance: 'var(--df-game-enhance)',
  gameAmplify: 'var(--df-game-amplify)',
  attrFire: 'var(--df-attr-fire)',
  attrWater: 'var(--df-attr-water)',
  attrLight: 'var(--df-attr-light)',
  attrDark: 'var(--df-attr-dark)',
  oathUpgradeDamage: 'var(--df-oath-upgrade-damage)',
  oathUpgradeCooldown: 'var(--df-oath-upgrade-cooldown)',
  oathUpgradeOathPoint: 'var(--df-oath-upgrade-oath-point)',
  oathUpgradeSpeed: 'var(--df-oath-upgrade-speed)',
  oathUpgradeRange: 'var(--df-oath-upgrade-range)',
  raidPartyRed: 'var(--df-raid-party-red)',
  raidPartyYellow: 'var(--df-raid-party-yellow)',
  raidPartyGreen: 'var(--df-raid-party-green)'
})

export const space = stylex.defineConsts({
  s4: 'var(--df-space-4)',
  s8: 'var(--df-space-8)',
  s12: 'var(--df-space-12)',
  s16: 'var(--df-space-16)',
  s24: 'var(--df-space-24)'
})

export const radius = stylex.defineConsts({
  panel: 'var(--df-radius-panel)',
  control: 'var(--df-radius-control)'
})

export const shape = stylex.defineConsts({
  cut: 'var(--df-cut)',
  gridCell: 'var(--df-grid-cell)',
  hazardStripe: 'var(--df-hazard-stripe)'
})

export const size = stylex.defineConsts({
  topbar: 'var(--df-size-topbar)',
  controlSm: 'var(--df-size-control-sm)',
  controlMd: 'var(--df-size-control-md)',
  controlLg: 'var(--df-size-control-lg)'
})

export const motion = stylex.defineConsts({
  ease: 'var(--df-ease)',
  durHover: 'var(--df-dur-hover)',
  durState: 'var(--df-dur-state)',
  durCount: 'var(--df-dur-count)',
  cycle: 'var(--df-cycle)',
  beat: 'var(--df-beat)'
})

export const font = stylex.defineConsts({
  ui: 'var(--df-font-ui)',
  num: 'var(--df-font-num)'
})
