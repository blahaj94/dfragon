/** 묵언의 진의 옵션 종류. 칸 색과 설명 상자의 종류 이름을 정한다. */
export type OathUpgradeKind = 'damage' | 'cooldown' | 'oathPoint' | 'speed' | 'range' | 'reduction'

/** 종류 이름. DFragon 디자인 캔버스 상세 창, 카드 면 보드의 표기이고, 서약 포인트는 보드에 없어 정했다. */
export const oathUpgradeKindLabels: Readonly<Record<OathUpgradeKind, string>> = {
  damage: '스킬 공격력 증가',
  cooldown: '쿨타임 감소',
  oathPoint: '서약 포인트',
  speed: '모든 속도',
  range: '공격 범위',
  reduction: '물리 마법 피해 감소'
}

// 네오플 응답의 옵션 이름별 종류. dnf-reverse-engineering의 PVF 판본 b2725b7c 서약 데이터 층
// (`data_layers/oaths/b2725b7c/oaths_upgrades.json`)의 `[ability text]`와 `[ability type]`(1 데미지, 2 쿨타임,
// 3 속도, 4 범위, 5 피해 감소, 100 서약 포인트)이다. 1~4단계는 데미지, 쿨타임, 서약 포인트, 5~9단계는 속도,
// 범위, 피해 감소 가운데 하나다. 옵션 이름은 모두 다르다.
const optionKinds: ReadonlyMap<string, OathUpgradeKind> = new Map([
  ['강인한 통찰', 'damage'],
  ['고요한 호흡', 'cooldown'],
  ['깨어난 서약', 'oathPoint'],
  ['포용의 권능', 'damage'],
  ['자애의 마음', 'cooldown'],
  ['자비의 맹세', 'oathPoint'],
  ['심연의 고동', 'damage'],
  ['내면의 조율', 'cooldown'],
  ['영혼의 계약', 'oathPoint'],
  ['신념의 대가', 'damage'],
  ['경계의 인내', 'cooldown'],
  ['구원의 언약', 'oathPoint'],
  ['이어진 걸음', 'speed'],
  ['숭고한 동행', 'range'],
  ['결의의 공명', 'reduction'],
  ['영원의 궤적', 'speed'],
  ['불변의 약속', 'range'],
  ['본질의 선언', 'reduction'],
  ['만물의 흐름', 'speed'],
  ['바래온 구원', 'range'],
  ['자각의 파동', 'reduction'],
  ['순례자의 길', 'speed'],
  ['맞잡은 구원', 'range'],
  ['남겨진 온기', 'reduction'],
  ['진리 도달', 'speed'],
  ['완성된 의지', 'range'],
  ['만개하는 빛', 'reduction']
])

/** 옵션 이름의 종류. 표에 없는 이름(게임 갱신으로 새로 생긴 옵션)이면 undefined다. */
export function oathUpgradeKind(optionName: string): OathUpgradeKind | undefined {
  return optionKinds.get(optionName)
}
