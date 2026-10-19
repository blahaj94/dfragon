import { dealerCard } from '../../testing/fixtures/character-cards'
import type {
  CharacterDetailItemText,
  CharacterDetailItemTexts
} from '../../../../preload/common/types/character-detail'

// 딜러 카드 12부위의 설명 상자 문구. 무기는 DFragon 디자인 캔버스 상세 창 보드의 예시 문구이고, 나머지는 같은
// 이름 아이템의 API 응답 fixture(apps/api/test/fixtures) 아이템 상세 원문이다.
const dealerSlotTexts: Readonly<Record<string, CharacterDetailItemText>> = {
  WEAPON: {
    explain:
      '[용을 베는 자]\n스킬 퀵슬롯의 빈 슬롯이 3개 이상일 때 검은 용의 힘 발동\n- 슈퍼아머 적용\n- 물리/마법 피해 감소 +10%\n- 모든 속도 +20%',
    buff: null,
    flavor: '그 피로 세상을 멸할 힘을 얻는다.'
  },
  JACKET: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '혹자가 자비를 원한다면, 기꺼이 베풀라.'
  },
  SHOULDER: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '정의 속에서 내려진 심판을 두려워하지 말지어다.'
  },
  PANTS: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '명예와 신앙을 추구하는 이를 공경할지어다.'
  },
  WAIST: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '함부로 꺼낼 말이 아니라면 그 어디서도 꺼내지 말라.'
  },
  SHOES: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '안식에 들기 전에는 항상 자신의 발밑을 확인하라.'
  },
  AMULET: {
    explain: '모든 속성 강화 +40',
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '믿고 있는 이를 의심하지 말지어다.'
  },
  WRIST: {
    explain: '모든 속성 강화 +50',
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '늘 진실을 좇고, 진실을 따르고, 진실을 기억하라.'
  },
  RING: {
    explain: '모든 속성 강화 +40',
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '타인의 희생을 잊지도 말고, 무시하지도 말지어다.'
  },
  SUPPORT: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '어떤 것에도 구애받지 않도록 항상 청렴한 태도를 지키라.'
  },
  MAGIC_STON: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +2',
    flavor: '허락 없이 타인의 순수를 더럽히지 말지어다.'
  },
  EARRING: {
    explain: null,
    buff: '30레벨 버프 스킬 Lv +1\n50레벨 액티브 스킬 Lv +1',
    flavor: '스스로 절제하기를 원한다면, 강인한 의지로 버티라.'
  }
}

/** 합성 미리보기 상세 창의 itemId별 설명 상자 문구. 딜러 카드 12부위만 채우고 서약은 비운다. */
export const previewItemTexts: CharacterDetailItemTexts = Object.fromEntries(
  dealerCard.investment.flatMap(({ slotId, itemId }) => {
    if (itemId === null || !Object.hasOwn(dealerSlotTexts, slotId)) {
      return []
    }

    return [[itemId, dealerSlotTexts[slotId]]]
  })
)
