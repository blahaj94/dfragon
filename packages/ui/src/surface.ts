/**
 * 컨트롤이 놓인 면. `card`는 라이트 모드에서도 다크인 캐릭터 카드 위라서 모드 색 대신 card* 토큰으로
 * 그린다. 목록처럼 body portal에 그리는 부분도 카드에서 열었으면 같은 면 색을 쓴다.
 */
export type ControlSurface = 'default' | 'card'
