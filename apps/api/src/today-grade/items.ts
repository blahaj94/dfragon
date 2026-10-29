// 2026-10-30 사용자 결정: 방어구 5, 악세서리 3, 특수장비 3부위의 `엘더 페어리` 장비(115레벨 레전더리)다.
// Neople 상점 판매 정보 조회는 상점에서 파는 장비만 지원하며, 2026-10-30에 11개 모두 itemGradeValue를 주는 것을 확인했다.
export const TODAY_GRADE_ITEMS = [
  { slot: 'JACKET', itemId: 'bc0b48fc1aee8c0e52aaf26c74a333b4', itemName: '엘더 페어리 상의' },
  { slot: 'SHOULDER', itemId: '22939054b71dfd19a8a5231f1c2056ac', itemName: '엘더 페어리 어깨' },
  { slot: 'PANTS', itemId: '063aa2c3726ea7bb560c1a845a58caa9', itemName: '엘더 페어리 하의' },
  { slot: 'WAIST', itemId: '9d8753d398024eb58c0e4bd845cf5b10', itemName: '엘더 페어리 벨트' },
  { slot: 'SHOES', itemId: 'b9a53ed5a3cefd55052e245e80c8a8c4', itemName: '엘더 페어리 신발' },
  { slot: 'WRIST', itemId: '311f3720a38dc22182863a1e975feb18', itemName: '엘더 페어리 팔찌' },
  { slot: 'AMULET', itemId: '0346b10d179e5c4ce056fa4c42670f99', itemName: '엘더 페어리 목걸이' },
  { slot: 'RING', itemId: 'f83450f4b2907a2a8bd5f1deb3b54289', itemName: '엘더 페어리 반지' },
  { slot: 'SUPPORT', itemId: 'fa53754fc0f378503e801e066d331e6e', itemName: '엘더 페어리 보조장비' },
  {
    slot: 'MAGIC_STON',
    itemId: '57ad748a9e4802e0e90f6390995cd420',
    itemName: '엘더 페어리 마법석'
  },
  { slot: 'EARRING', itemId: '841ea92775de710061d9ea2045217e21', itemName: '엘더 페어리 귀걸이' }
] as const
