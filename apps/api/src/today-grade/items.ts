// 2026-10-30 사용자 결정: 방어구 5, 악세서리 3, 특수장비 3부위의 115레벨 에픽 대표 아이템이다. 팔찌와 목걸이는
// 시로코 퍼리조아가 낀 아이템, 반지는 Desktop 점수 엔진 fixture, 나머지는 API 테스트 fixture의 아이템이다.
export const TODAY_GRADE_ITEMS = [
  { slot: 'JACKET', itemId: '11f55a9437e514d46ee55c8a8ae82b7e', itemName: '긍휼 속 자비의 상의' },
  { slot: 'SHOULDER', itemId: '2d81feba3c9977d5ffa32fd378785bf0', itemName: '숭고한 심판의 어깨' },
  { slot: 'PANTS', itemId: '607ee0da46bf24a4b211bff52f3c05f1', itemName: '명예로운 공경의 하의' },
  { slot: 'WAIST', itemId: '20c367fa5eaccbaa7b9fe372d4b94170', itemName: '완전한 침묵의 벨트' },
  { slot: 'SHOES', itemId: 'e6360b073291b20bd81c830fe5b52962', itemName: '고요한 안식의 신발' },
  { slot: 'WRIST', itemId: 'c65e76ae9dee4ac94ca34110daa5e63a', itemName: '노블 페어리 팔찌' },
  { slot: 'AMULET', itemId: '184d9dfed90f970fe7ca3cb967e2a722', itemName: '노블 페어리 목걸이' },
  { slot: 'RING', itemId: '854d52a64fe061dc2586a10bf274676b', itemName: '칠흑의 정화 반지' },
  {
    slot: 'SUPPORT',
    itemId: '819d0bd846c913248d30c8b1e4e53755',
    itemName: '초연한 청렴의 보조장비'
  },
  {
    slot: 'MAGIC_STON',
    itemId: 'b797e5b10819d9edb772d6cc69f7561d',
    itemName: '무결한 순수의 마법석'
  },
  { slot: 'EARRING', itemId: '523be2dc115d046a3ce5ab76f5e1e42b', itemName: '강인한 절제의 귀걸이' }
] as const
