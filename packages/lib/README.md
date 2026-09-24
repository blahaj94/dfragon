# @dfragon/lib

API·Web·Desktop에서 입력 규칙과 DNF UI 좌표 계산을 재사용하는 공용 TypeScript 패키지입니다. 앱 source, React, Electron, Node 전용 runtime에 의존하지 않는 ESM과 선언 파일을 제공합니다.

소비 workspace의 `dependencies`에 `"@dfragon/lib": "workspace:*"`를 추가하고 `pnpm --filter @dfragon/lib build` 후 사용합니다. 이번 변경은 공용 함수 제공까지이며 기존 계정·검색·OCR 호출부는 교체하지 않습니다.

```ts
import { validateDFNickname, type NicknameValidationResult } from '@dfragon/lib'

const result: NicknameValidationResult = validateDFNickname('★검신★')
if (!result.isValid) {
  console.log(result.reason)
}

// 서비스가 실제로 관리하는 목록이 있을 때만 지정합니다.
validateDFNickname('MyGM', { bannedWords: ['gm'] })
```

## 검사 범위

`validateDFNickname(nickname: string, options?)`는 던파 캐릭터명에 사용할 **CP949 기반 로컬 형식 검사**입니다. 게임 내 생성 가능 여부·이름 중복·공식 금칙어 판정은 제공하지 않습니다. 문자열 타입 검사는 HTTP·IPC 등 입력 경계에서 수행합니다.

- 빈 문자열·공백만 있는 입력, 내부/앞뒤 Unicode 공백을 거절합니다.
- 인쇄 가능한 ASCII는 1바이트, CP949로 손실 없이 표현되는 비ASCII 문자는 2바이트로 계산하며 최대 12바이트를 허용합니다. 비어 있지 않은 1바이트 이름도 형식상 통과합니다. 이 최소 길이·12바이트 상한은 요청한 로컬 정책이며 현재 게임 서버에서 검증한 계약이 아닙니다.
- 제어문자, format 문자, Unicode default-ignorable 문자(한글 채움 문자·ZWJ·variation selector 등)는 CP949 여부와 별도로 거절합니다. CP949에 없는 이모지·보조 평면 문자·단독 surrogate도 거절합니다. 예전 기호인 `★`, `♡` 등은 유지합니다.
- 문자열을 trim·NFC/NFKC·대소문자 변환해 반환하지 않습니다. 금칙어 비교에서만 소문자화합니다.
- `bannedWords`는 선택적 읽기 전용 배열이며 대소문자를 무시한 부분 문자열 검사입니다. 빈 항목은 무시합니다. `운영자`, `세리아`, `단진`을 공식 금칙어로 하드코딩하지 않습니다.
- 오류 우선순위는 빈 값 → 공백 → 문자 집합 → 바이트 길이 → 전달된 금칙어입니다. 성공은 `{ isValid: true }`, 실패는 `{ isValid: false, reason: string }`입니다.

## 도메인 근거와 한계

[네오플의 2018년 검색 API 공지](https://developers.neople.co.kr/contents/notice/view/106)는 `wordType=full` 검색의 2~12자를 안내합니다. 검색어 길이는 캐릭터명 생성의 인코딩·바이트 상한과 다른 계약입니다. [DFRAGON 검색 규칙](../../docs/rules/character-search.md)은 Unicode code point 기준 2~12자이며, [DFRAGON 계정 닉네임](../../docs/rules/auth-api.md#닉네임)은 grapheme 기준 1~20자와 이모지를 허용합니다. 이 함수로 두 validator를 대체하면 기존 동작을 깨뜨립니다.

[과거 던파 공식 생성 안내](https://df.nexon.com/community/news/notice/118741)는 일부 ASCII 기호·완성형 한글·한문·히라가나를 열거합니다. 이는 CP949 전체와 동일한 목록이 아니며, 오래된 공지만으로 현재 허용 문자 전체를 확정할 수 없습니다. 이 함수는 요청한 고전 특수문자 지원을 위해 인쇄 가능한 ASCII 및 CP949 문자 집합을 채택한 근사 검사입니다. 실제 생성·검색 성공을 보장하지 않습니다.

원래 의사 코드의 허용 정규식은 사용되지 않았고 끝의 `\$`는 문자열 끝 대신 달러 문자를 요구했습니다. Unicode 구간은 CP949 문자 집합과 일치하지 않으며, 일부 이모지 범위를 차단해도 미지원 문자·단독 surrogate·보이지 않는 문자는 남습니다. 실제 인코딩 가능성을 확인한 정적 문자 집합을 사용해 이 문제를 해결합니다.

CP949는 Unicode 한자 전체를 지원하지 않습니다. 처음 제시된 `검신〆`의 `〆`와 `아라드郎`의 `郎`는 CP949에 없으므로 거절합니다. 모양이 비슷한 `郞`는 별개의 문자로 CP949에 있어 `아라드郞`는 8바이트로 통과합니다. `★검신★`는 8바이트로 통과하고 `사쿠라🌸`는 거절합니다. 자동으로 유사 문자를 치환하지 않습니다.

## 개발 및 검증

```bash
pnpm --filter @dfragon/lib test
pnpm --filter @dfragon/lib lint
pnpm --filter @dfragon/lib format:check
```

`test`는 먼저 TypeScript build를 수행하고 Node 기본 test runner로 공개 package export와 경계값을 검증합니다. `src/cp949-characters.ts`는 `iconv-lite@0.7.3`의 CP949 encode/decode 왕복 결과에서 생성했습니다. 한글 완성형 전체는 연속 범위로 처리합니다. `iconv-lite`는 개발 의존성이며 앱 bundle에는 포함되지 않습니다. 생성 데이터의 라이선스는 [`@dfragon/licenses`의 원문](../licenses/notices/lib/iconv-lite-LICENSE)과 build 산출물 `dist/notices/iconv-lite-LICENSE`에 보존합니다.

문자 표를 갱신할 때는 `pnpm --filter @dfragon/lib generate:cp949` 후 root에서 `pnpm exec prettier --write packages/lib/src/cp949-characters.ts`를 실행합니다. 테스트는 BMP 전체에 대해 원본 codec과 표의 일치를 검증합니다.

## DNF UI 배율 추정

```ts
import { estimateDNFUIScale } from '@dfragon/lib'

const scale = estimateDNFUIScale(50) // 1080px 기준: 1.2857142857142858
const smallerWindowScale = estimateDNFUIScale(50, 900) // 1.2
```

`estimateDNFUIScale(uiPercent: number, clientHeight = 1080): number`는 600px 높이·UI 0% 기준의 래스터 배율을 `H / (H - (H - 600) × uiPercent / 100)`으로 추정합니다. `H`는 실행 중 게임 창의 client 높이입니다. 기본 높이 1080에서는 기존 `225 / (225 - uiPercent)` 모델과 같습니다. UI 입력은 0~100의 유한한 수, 높이는 600~1080의 정수 픽셀이며 위반 시 `RangeError`로 거절합니다. 값을 보정하거나 배율을 반올림하지 않습니다. 소수 UI 입력도 계산하지만 이는 모델 보간이며 실제 게임 설정 검증을 뜻하지 않습니다.

| UI % | 추정 배율 |
| --- | --- |
| 0 | 1 |
| 25 | 1.125 |
| 50 | 약 1.285714 |
| 75 | 1.5 |
| 100 | 1.8 |

기존 1080px 모델은 제공된 PNG 비교 보고서의 0·25·50·75·100% 다섯 단계와 일관된 후보식입니다. 후속 Windows 10 조사에서 600·851·900·1080px 높이의 일부 UI 설정과 비교해 높이 항을 추가했습니다. [측정 조건과 실제 관측값](../../docs/reference/desktop-party-geometry.md)을 참고합니다. 게임 내부의 공식 산식은 아니며, 약 16:9·DPI 96 이외 환경과 모든 UI 단계, 정확한 픽셀 반올림·단계별 불연속은 확인하지 않았습니다. 패키지 테스트는 산식과 숫자 관측값을 검증하며 원본 PNG를 재분석하지 않습니다. 배율의 상대 오차를 이미지 일치율이나 식별 확률로 해석하지 않습니다.

사용 예는 기준 크기 11px로 먼저 만든 래스터를 이 배율로 등방 확대하는 것입니다. `11 * scale` 크기로 글자를 새로 렌더링하는 방식과 다릅니다. 폰트·크기·자간·보간·DPR·이미지 좌표 및 정수 출력 크기의 처리는 호출자가 결정하며 함수는 DOM·Canvas에 의존하지 않습니다. 기존 OCR/capture 호출부는 변경하지 않습니다.

## 파티 영역 계산

`estimateDNFPartyScale(slotSpacing: number)`는 **인접한 두 슬롯의 같은 기준점 사이 가로 거리**를 기준 간격 141px로 나누어 배율을 구합니다. UI 퍼센트나 설정 파일을 읽지 않습니다. 141px이면 1, 관측한 181px이면 약 1.284입니다. 정수 픽셀로 측정한 결과이므로 UI 모델의 약 1.286과 약간 다릅니다. 인접하지 않은 슬롯의 거리나 체력·마나의 채워진 길이를 전달하면 올바른 배율을 얻을 수 없습니다. 입력은 유한한 양수이며, 양수 배율로 표현할 수 없는 값도 `RangeError`로 거절합니다.

`projectDNFPartyRegions(options)`는 아래 입력으로 **4개 후보 영역**을 반환합니다. 실제 파티원 수나 프레임 존재를 판단하지 않습니다.

| 입력 | 의미 |
| --- | --- |
| `clientSize: { width, height }` | 캡처된 게임 영역의 양의 안전 정수 픽셀 크기. 창 테두리·바탕화면을 제외합니다. |
| `baseRegion: { x, y, width, height }` | 호출자가 보정한 첫 슬롯 영역. 600px 높이·UI 0% 게임 영역 좌표이며, x/y는 0 이상, 폭/높이는 양수인 유한한 수입니다. |
| `scale` | 관측하거나 추정한 유한한 양수 배율입니다. |
| `offset?: { x, y }` | 확대 후 더하는 게임 영역 내부의 이동량입니다. 유한한 출력 픽셀 단위이며 기본값은 0입니다. 바탕화면상의 창 위치가 아닙니다. |

```ts
import { estimateDNFPartyScale, projectDNFPartyRegions } from '@dfragon/lib'

const regions = projectDNFPartyRegions({
  clientSize: { width: 1920, height: 1080 },
  scale: estimateDNFPartyScale(181),
  // 측정한 기준 HP 바 예시입니다. 닉네임 크롭 영역으로 사용하지 마세요.
  baseRegion: { x: 42, y: 27, width: 99, height: 3 }
})
```

각 슬롯의 기준 x에 `141 × 슬롯 인덱스(0~3)`를 더한 뒤 배율과 이동량을 적용합니다. 반올림한 간격을 누적하지 않고 각 영역의 좌상단은 `floor`, 우하단은 `ceil`로 계산해 정수 `{ x, y, width, height }[]`를 만듭니다. 어느 한 영역이라도 게임 영역을 벗어나거나 유효한 정수 사각형이 되지 않으면 전체 호출이 `RangeError`로 실패합니다. 잘라내기·부분 성공으로 잘못된 보정을 숨기지 않습니다. 입력 객체는 변경하지 않습니다.

닉네임의 최대 길이와 오른쪽 상태 아이콘 경계는 아직 검증하지 않아 기본 닉네임 사각형을 제공하지 않습니다. `baseRegion`은 후속 보정 작업에서 결정하고, 보간 가장자리의 여유도 호출자가 포함해야 합니다. 1·2번 간격은 실제 2인 파티에서 측정했으며 3·4번은 같은 간격을 반복한다는 예측입니다. 반환된 네 후보를 네 명의 실제 파티원으로 취급하지 마세요.

이 함수는 DOM·Canvas·Electron에 의존하지 않습니다. 사각형 계산은 다른 양의 client 크기도 받지만 게임 레이아웃의 실측 범위는 위 조사 조건뿐입니다. 창 크기 조회, 프레임 자동 검출, 빈 슬롯 판정, 화면 좌표 변환, PNG 저장과 기존 Desktop 호출부 연결은 포함하지 않습니다.
