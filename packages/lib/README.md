# @dfragon/lib

API, Desktop에서 입력 규칙, DNF UI 좌표, 픽셀 계산을 재사용하는 공용 TypeScript 패키지입니다. 앱 source, React, Electron, Node 전용 runtime에 의존하지 않는 ESM과 선언 파일을 제공합니다.

소비 workspace의 `dependencies`에 `"@dfragon/lib": "workspace:*"`를 추가하고 `pnpm --filter @dfragon/lib build` 후 사용합니다. API의 build와 typecheck는 공용 패키지를 먼저 빌드합니다. 캐릭터명 검사와 DNF 계산 함수의 적용 범위는 아래 안내를 따릅니다.

## 값 모양 검사

```ts
import { exactObject, isNonblankString, listOf, nullable, oneOf } from '@dfragon/lib/utils/shape-check'

const isRow = exactObject({ slotId: isNonblankString, grade: nullable(oneOf('종결', '준종결')) })
listOf(isRow)([{ slotId: 'WEAPON', grade: null }]) // true
isRow({ slotId: 'WEAPON', grade: null, extra: 1 }) // 정하지 않은 키가 있어 false
```

신뢰 경계를 넘어온 값이 정한 모양인지 스키마 라이브러리 없이 확인합니다. 모든 검사는 순수 함수이며 값을 바꾸거나 형 변환하지 않고 `true`, `false`만 돌려줍니다. zod 같은 의존성을 같이 묶을 수 없는 곳에서 씁니다.

- `exactObject`, `hasExactKeys`는 배열이 아닌 객체의 own key(symbol 포함)가 정확히 정한 키인지 봅니다.
- `isFiniteNumber`는 NaN과 무한대를 거절하고, `isNonNegativeSafeInteger`, `isPositiveSafeInteger`는 안전 정수만 받습니다.
- `isNonblankString`은 공백만 있는 문자열을 거절하고, `isNullableString`은 빈 문자열도 받습니다.
- `isUtcTimestamp`는 `Z`로 끝나는 ISO 시각 중 실제 날짜만 받아 `2026-02-30T00:00Z`, `24:00`을 거절합니다. `isOffsetTimestamp`는 `±HH:MM` offset도 받습니다.

## 조건 단언

```ts
import { assert } from '@dfragon/lib/utils/assert'
import { isRecord } from '@dfragon/lib/utils/shape-check'

assert(isRecord(value))
value.rows // 이 줄부터 value는 Record<string, unknown>
```

`assert(condition, failure?)`는 조건이 falsy이면 실패를 던지고, 통과하면 TypeScript가 이후 코드에서 조건을 참으로 보고 타입을 좁힙니다. Electron preload처럼 Node 전용 모듈을 쓸 수 없는 곳에서도 쓰도록 `node:assert`에 의존하지 않습니다.

- `failure`를 주지 않거나 문자열을 주면 그 message로 이 패키지의 `AssertionError`를 던집니다. 기본 message는 `'Assertion failed'`입니다.
- `Error`를 주면 그 객체를 그대로 던집니다.
- `() => Error` 함수를 주면 실패할 때만 호출해 돌려받은 오류를 던집니다. API 오류 응답처럼 계약된 실패를 던질 때는 이 형태를 써서, 통과할 때마다 오류 객체를 만들지 않게 합니다.

```ts
const invalidResponse = () => neopleSearchFailure('api')
assert(Array.isArray(body.rows), invalidResponse)
```

`./package.json`도 export하므로 빌드의 라이선스 수집기가 패키지 위치를 찾을 수 있습니다. 기존 CP949 원문은 `dist/notices`에 유지하고 패키지 루트 `LICENSES`에도 복사해 배포합니다.

## 캐릭터 검색어 정책

`matchesDNFSearchNicknamePolicy(nickname)`는 검색어의 Unicode 코드 포인트 수 2~12와 앞뒤 공백 금지를 함께 검사합니다. `DNF_SEARCH_NICKNAME_LIMITS`가 두 길이 경계의 원본입니다. 문자열을 trim, 정규화하지 않고 내부 공백과 분해 문자, 이모지 sequence의 기존 의미를 유지합니다.

API 검색 query, Desktop main 검색 관측, 수동 입력 화면이 이 함수를 공유합니다. 함수의 보장은 길이, 공백 정책에 한정됩니다. API의 엄격한 URL/UTF-8 decode와 Desktop의 `isWellFormed()` 검사는 각 입력 경계에 남아 있습니다. 아래 CP949 기반 캐릭터명 생성 검사를 대체하지 않습니다.

## 던파 캐릭터명 검사

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

`validateDFNickname(nickname: string, options?)`는 던파 캐릭터명에 사용할 **CP949 기반 로컬 형식 검사**입니다. 게임 내 생성 가능 여부, 이름 중복, 공식 금칙어 판정은 제공하지 않습니다. 문자열 타입 검사는 HTTP, IPC 등 입력 경계에서 수행합니다.

이 저장소의 앱은 이 함수를 호출하지 않습니다. OCR 학습용 닉네임을 만드는 [dfragon-ocr](https://github.com/blahaj94/dfragon-ocr)이 이 함수와 `cp949Characters`를 허용 문자 판정의 원본으로 복사해 쓰므로, 규칙을 바꿀 때는 그 저장소의 사본도 함께 갱신합니다.

- 빈 문자열, 공백만 있는 입력, 내부/앞뒤 Unicode 공백을 거절합니다.
- 인쇄 가능한 ASCII는 1바이트, CP949로 손실 없이 표현되는 비ASCII 문자는 2바이트로 계산하며 최대 12바이트를 허용합니다. 비어 있지 않은 1바이트 이름도 형식상 통과합니다. 이 최소 길이, 12바이트 상한은 요청한 로컬 정책이며 현재 게임 서버에서 검증한 계약이 아닙니다.
- 제어문자, format 문자, Unicode default-ignorable 문자(한글 채움 문자, ZWJ, variation selector 등)는 CP949 여부와 별도로 거절합니다. CP949에 없는 이모지, 보조 평면 문자, 단독 surrogate도 거절합니다. 예전 기호인 `★`, `♡` 등은 유지합니다.
- 문자열을 trim, NFC/NFKC, 대소문자 변환해 반환하지 않습니다. 금칙어 비교에서만 소문자화합니다.
- `bannedWords`는 선택적 읽기 전용 배열이며 대소문자를 무시한 부분 문자열 검사입니다. 빈 항목은 무시합니다. `운영자`, `세리아`, `단진`을 공식 금칙어로 하드코딩하지 않습니다.
- 오류 우선순위는 빈 값 → 공백 → 문자 집합 → 바이트 길이 → 전달된 금칙어입니다. 성공은 `{ isValid: true }`, 실패는 `{ isValid: false, reason: string }`입니다.

## 도메인 근거와 한계

[네오플의 2018년 검색 API 공지](https://developers.neople.co.kr/contents/notice/view/106)는 `wordType=full` 검색의 2~12자를 안내합니다. 검색어 길이는 캐릭터명 생성의 인코딩, 바이트 상한과 다른 계약입니다. [DFragon 검색 규칙](../../docs/rules/character-search.md)은 Unicode code point 기준 2~12자입니다. 이 함수로 검색 validator를 대체하면 기존 동작을 깨뜨립니다.

[과거 던파 공식 생성 안내](https://df.nexon.com/community/news/notice/118741)는 일부 ASCII 기호, 완성형 한글, 한문, 히라가나를 열거합니다. 이는 CP949 전체와 동일한 목록이 아니며, 오래된 공지만으로 현재 허용 문자 전체를 확정할 수 없습니다. 이 함수는 요청한 고전 특수문자 지원을 위해 인쇄 가능한 ASCII 및 CP949 문자 집합을 채택한 근사 검사입니다. 실제 생성, 검색 성공을 보장하지 않습니다.

CP949는 Unicode 한자 전체를 지원하지 않습니다. `검신〆`의 `〆`와 `아라드郎`의 `郎`는 CP949에 없으므로 거절합니다. 모양이 비슷한 `郞`는 별개의 문자로 CP949에 있어 `아라드郞`는 8바이트로 통과합니다. `★검신★`는 8바이트로 통과하고 `사쿠라🌸`는 거절합니다. 자동으로 유사 문자를 치환하지 않습니다.

## 개발 및 검증

```bash
pnpm --filter @dfragon/lib test
pnpm --filter @dfragon/lib lint
pnpm --filter @dfragon/lib format:check
```

`test`는 먼저 TypeScript build를 수행하고 Node 기본 test runner로 공개 package export와 경계값을 검증합니다. `src/cp949-characters.ts`는 `iconv-lite@0.7.3`의 CP949 encode/decode 왕복 결과에서 생성했습니다. 한글 완성형 전체는 연속 범위로 처리합니다. `iconv-lite`는 개발 의존성이며 앱 bundle에는 포함되지 않습니다. 생성 데이터의 라이선스는 [`@dfragon/licenses`의 원문](../licenses/notices/lib/iconv-lite-LICENSE)과 build 산출물 `dist/notices/iconv-lite-LICENSE`에 보존합니다.

문자 표를 갱신할 때는 `pnpm --filter @dfragon/lib generate:cp949` 후 root에서 `pnpm exec biome format --write packages/lib/src/cp949-characters.ts`를 실행합니다. 테스트는 BMP 전체에 대해 원본 codec과 표의 일치를 검증합니다.

## 파티참가인원 닉네임 검출, 크롭

이동 가능한 **파티참가인원 팝업**의 `캐릭터 이름` 열을 처리합니다. 가로 파티 HUD의 `detectPartyFrameGeometry`와 다른 대상입니다. Desktop 개발자 작업 공간의 파티원창 크롭 탭에서 미리보기와 수집에 사용합니다.

```ts
import {
  cropDNFPartyParticipantNicknames,
  detectDNFPartyParticipantWindow,
  type DNFParticipantFrame
} from '@dfragon/lib'

// 호출자가 캡처, 디코딩한 게임 client와 UI 0%의 기준 헤더입니다.
declare const frame: DNFParticipantFrame
declare const headingTemplate: DNFParticipantFrame

// 위치와 행 상태만 필요할 때 사용합니다.
const detection = detectDNFPartyParticipantWindow(frame, headingTemplate)

// 검출과 원본 복사를 한 프레임에서 수행하므로 별도로 detect를 호출할 필요가 없습니다.
const result = cropDNFPartyParticipantNicknames(frame, headingTemplate)
if (result.status === 'found') {
  for (const row of result.rows) {
    if (row.crop === null) continue
    // slot은 1~4 원래 행 번호입니다. 3번만 남아도 slot:3을 유지합니다.
    // row.crop의 RGBA를 표시하거나 저장하는 일은 호출자가 담당합니다.
    console.log(row.slot, row.nickname, row.crop.width, row.crop.height)
  }
}
```

두 함수의 입력은 `{ width, height, rgba }`입니다. `rgba`는 행 우선, 채널 순서 RGBA, premultiply하지 않은 `Uint8Array | Uint8ClampedArray`이고, padding 없이 정확히 `width × height × 4`바이트여야 합니다. alpha는 검출에 사용하지 않고 크롭에 그대로 보존합니다. 게임 client 크기는 양의 안전한 정수이며 한 변 8192px, 총 33,000,000픽셀 이하를 받습니다. 바탕화면, 창 테두리는 호출자가 제외합니다. 메모리 보호 한도 안의 모든 해상도, 화면 비율, 팝업 배율에서 검증됐다는 의미는 아닙니다.

`headingTemplate`은 UI 0%에서 **레벨, 장비 점수, 캐릭터 이름, 직업명 네 열의 헤더 전체**를 배경과 테두리까지 포함해 자른 `368 × 17` RGBA입니다. 측정한 팝업 좌상단에서 `(14, 67)`부터 시작합니다. 자르기 외에 확대, 이진화, 글자만 추출하는 전처리를 하지 않습니다. 기준 이미지 제공, 디코딩, 갱신은 호출자가 소유하며 패키지에 게임 이미지나 플레이어 데이터는 포함하지 않습니다. 잘못된 크기, 바이트 배열과 대비가 없는 기준 헤더는 `RangeError`로 거절합니다.

| `status` | 의미 |
| --- | --- |
| `found` | 헤더와 네 행 구조를 만족하는 팝업 하나를 검출했습니다. `window`, `scale`, `matchScore`, `rows`를 반환합니다. |
| `not-found` | 검증 가능한 팝업이 없습니다. 화면 경계에 잘린 후보도 제외합니다. |
| `ambiguous` | 서로 다른 팝업 후보가 둘 이상입니다. 하나를 임의로 선택하지 않습니다. |
| `search-limit` | 조건을 만족하는 빨간 연결 영역이 128개를 초과하거나, 프레임 전체 헤더 비교가 64,000,000개 픽셀 표본 한도를 초과하려 합니다. 일부 후보만 검사해 성공을 반환하지 않습니다. |

`window`와 각 행의 `nickname`은 입력 게임 client 기준의 정수 `{ x, y, width, height }`입니다. `rows`는 항상 위에서부터 네 개이며 각 행은 `{ slot, occupied, nickname }`입니다. 빈 행, 자물쇠 행도 남고, 네 행 모두 비어 있어도 창이 검출되면 `found`입니다. 크롭 함수는 각 행에 `crop`을 추가합니다. 참가자가 있으면 독립 RGBA 복사본, 없으면 `null`이며 입력 버퍼를 변경하거나 공유하지 않습니다. 크기 변경, 선명화, OCR는 하지 않습니다.

`scale`은 헤더로 추정한 래스터 배율이며 게임 UI 설정 퍼센트가 아닙니다. `matchScore`는 평균을 뺀 정규화 상관 점수로, 식별 성공 확률이나 닉네임 판독 신뢰도가 아닙니다. 동기 CPU 계산이므로 반복 캡처에 연결할 때 실행 위치와 주기는 호출자가 정합니다.

## 12인 공대창 검출, 크롭

`detectDNFRaidParticipantWindow(frame, headingTemplate)`은 공대창의 위치, 배율과 12행의 참가 여부, 닉네임, 파티 표식, 장비 점수 영역을 반환합니다. `cropDNFRaidParticipantNicknames(frame, headingTemplate)`은 같은 프레임에서 참가 행의 닉네임 원본 RGBA도 복사합니다. 닉네임 OCR이나 Desktop 수집, 웹 업로드를 실행하지 않습니다.

공대원이 나가면 아래 행이 위로 당겨집니다. 결과의 `row`는 해당 프레임의 화면 위치(1~12)이며 이전 프레임의 같은 행과 같은 캐릭터라는 뜻이 아닙니다. 결과는 항상 12행이며 빈 행은 `occupied: false`, `nicknameCrop: null`입니다. 별도 8인 레이드 레이아웃은 지원 범위 밖입니다.

```ts
import { cropDNFRaidParticipantNicknames, type DNFParticipantFrame } from '@dfragon/lib'

// 호출자가 원본 game client와 공대창 기준 헤더를 RGBA로 준비합니다.
declare const frame: DNFParticipantFrame
declare const raidHeadingTemplate: DNFParticipantFrame

const result = cropDNFRaidParticipantNicknames(frame, raidHeadingTemplate)
if (result.status === 'found') {
  for (const row of result.rows) {
    if (row.nicknameCrop === null) continue
    // row.nickname은 client 기준 좌표, nicknameCrop은 독립된 원본 픽셀입니다.
    console.log(row.row, row.nickname, row.nicknameCrop.width, row.nicknameCrop.height)
  }
}
```

파티 구분과 장비 점수 판독은 `readDNFRaidParticipantMetadata(frame, rows, templates)`로 별도 실행합니다. 호출자가 준비한 표식, 글자 기준 이미지와 행별 픽셀에서 `party`, `equipmentScoreText`를 반환하며 판독할 수 없는 필드는 `null`입니다. R/Y/G, 싱글을 행 번호로 추정하지 않고, 점수는 `1000.4K` 같은 표시 문자열을 유지합니다. 정답 저장, 화면 연결은 하지 않습니다. 파티 표식 기준 없이 수치만 읽을 때는 `readDNFRaidParticipantValues(frame, rows, glyphs)`가 같은 판독 규칙으로 행별 `{ row, valueText }`를 반환합니다. 같은 칸은 게임에서 명성으로 바뀔 수 있어, `classifyDNFRaidValueColumn`이 검출 결과의 `valueHeadingRegion`을 기준 열 제목과 비교해 `fame`, `equipment-score`, `unknown`을 정합니다. 표시 문자열은 `parseDNFRaidValueNotation`이 보일 수 있는 정수 범위 `{ min, max }`로 바꿉니다(`1000.4K`는 1,000,400~1,000,499). 행의 `jobRegion`은 직업명 칸 좌표이며 OCR은 하지 않습니다.

공대창 실측과 공개 API의 입력, 검증 범위는 [공대원창 검출 안내](../../docs/reference/desktop-raid-participants.md)를 참고합니다.

## HUD 파티 프레임 검출

`detectPartyFrameGeometry({ width, height, rgba })`는 HP, MP가 가득 찬 HUD 프레임과 주변 경계를 찾아 `scale`, `slots`를 반환합니다. 각 슬롯은 1~4번 번호와 원본 닉네임 크롭 좌표, 가림 확인용 `coverage`를 포함합니다. 누락된 슬롯은 채우지 않으며 미검출, 모호한 후보, 잘못된 입력은 `PartyFrameGeometryError`의 `reason`으로 구분합니다. 일반 Desktop OCR 캡처와 개발자 이미지 수집이 같은 함수를 사용합니다.

`rgba`는 행 우선 RGBA `Uint8Array`이며 정확히 `width × height × 4`바이트여야 합니다. Canvas의 `Uint8ClampedArray`는 같은 buffer를 보는 `Uint8Array`로 전달할 수 있습니다. `isValidPartyFrameSize(width, height)`는 양의 안전한 정수, 한 변 8192px 이하, 총 33,000,000픽셀 이하를 확인합니다. 특정 해상도 일치 조건은 없으며, 호출자가 창 테두리를 제외한 게임 client 원점의 픽셀을 제공해야 합니다.

검출기는 화면에서 관측한 래스터 배율을 사용하며 UI 설정 퍼센트를 역산하지 않습니다. HP, MP 잔량이 줄어든 전투 화면, 폰트 변경, 모든 장식의 정확도는 보장하지 않습니다. 실측 및 합성 검증의 구분은 [HUD geometry 안내](../../docs/reference/desktop-party-geometry.md)를 따릅니다.
