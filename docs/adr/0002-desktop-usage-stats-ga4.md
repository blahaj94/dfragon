---
type: adr
status: superseded
scope: apps/desktop usage stats for the Windows distribution channel
decided: 2026-10-31
last-reviewed: 2026-10-31
superseded-by: 0003-remove-desktop-usage-stats.md
evidence: "GA4 Measurement Protocol 문서 확인(2026-10-31) ; GitHub Release 다운로드 수와 API 접근 로그 구조 확인(2026-10-31) ; 저장소 소유자 결정(2026-10-31)"
review-after: 개인정보처리방침 게시, 웹사이트 공개, 설치형 배포나 코드 서명(SignPath) 신청 전
---

# ADR 0002: Desktop 사용량을 GA4로 센다

## 상태

채택. 배포 채널 빌드에 GA 측정 ID와 API secret을 넣으면 앱이 사용 통계를 보낸다.

## 맥락

앱을 실제로 몇 명이 얼마나 쓰는지 알 방법이 없었다.

- GitHub Release 다운로드 수는 Release마다 1~3회였고(2026-10-31), 본인 테스트와 실제 사용자를 가를 수 없다.
- API 접근 로그는 IP와 사용자 ID를 남기지 않아 요청 수만 센다. test 빌드도 같은 운영 API를 쓰고, 로그는 컨테이너를 새로 만들면 지워진다.
- [ADR 0001](0001-update-notice-without-auto-install.md)을 쓸 때 Desktop은 사용자가 지정하지 않은 시스템으로 데이터를 보내지 않았다.

## 선택지

| 선택지 | 순사용자 수 | 개인정보 | 운영 |
| --- | --- | --- | --- |
| A. API 로그 집계 | 없음 | 새 수집 없음 | 로그 보관을 따로 만들어야 한다 |
| B. GA4 Measurement Protocol | 설치별 client_id로 센다 | 설치별 ID가 Google로 간다 | 무료, 대시보드 제공 |
| C. 영구 ID 없는 Electron 전용 분석(Aptabase 등) | 없음 | 부담이 적다 | 외부 서비스나 self-host |

## 결정

B를 채택한다. 사용 통계는 항상 보내며 화면 안내와 끄는 설정은 두지 않는다(2026-10-31 저장소 소유자 결정).

- 대상: 배포 채널 빌드만 보낸다. test, development 채널과 채널 없는 실행은 GA 설정이 없어 보내지 않는다. 배포 채널도 빌드할 때 `DFRAGON_GA_MEASUREMENT_ID`, `DFRAGON_GA_API_SECRET`이 모두 비어 있으면 보내지 않는다. 하나만 있거나 형식이 틀리면 빌드를 멈춘다.
- 이벤트: 앱 실행(`app_start`), 캡처 회차(`capture`, 회차 프레임을 읽었을 때), 직접 검색(`character_search`)이다. `capture`와 `character_search`에는 파티, 공대를 `screen`으로 붙인다.
- 함께 보내는 값: 설치별 `client_id`(`<난수>.<처음 실행한 Unix 초>`, profile 폴더의 `usage-stats.json`), 실행마다 바뀌는 `session_id`, 앱 버전(`app_version` user property). 닉네임, 서버, 캐릭터, 이미지, OCR 결과는 보내지 않는다. 요청에는 IP와 Electron User-Agent가 전달되며 언어 header는 고정값 `en-US`다.
- 실패 처리: 전송 실패는 다시 시도하지 않고 진단 기록에 `USAGE_STATS_FAILED`만 남긴다.
- 값 관리: 측정 ID는 production 환경 variable, API secret은 production 환경 secret에 두고 Release workflow의 빌드 단계에만 넘긴다.

## 결과

- GA4에서 일간, 월간 활성 사용자, 버전별 분포, 캡처와 직접 검색 횟수를 본다. Measurement Protocol은 요청 IP로 지역을 정하지 않으므로 국가 정보는 비어 있다.
- API secret은 설치본에서 꺼낼 수 있다. 누군가 같은 GA 속성에 가짜 이벤트를 넣을 수 있고, 그러면 데이터만 오염된다.
- Desktop이 사용자가 지정하지 않은 시스템(Google)으로 데이터를 보낸다. 개인정보처리방침이 없고 화면 안내도 없다. 국외 이전 고지, GA 이용 고지가 필요해지거나 SignPath처럼 설치 중 고지와 끄기 옵션을 요구하는 조건을 맞춰야 하면 이 결정을 다시 정한다.
