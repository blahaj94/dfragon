---
type: adr
status: accepted
scope: apps/desktop usage stats for the Windows distribution channel
decided: 2026-10-31
last-reviewed: 2026-10-31
superseded-by: 없음
evidence: "v1.0.0 Windows Portable 실행 로그의 GA 빌드 변수 확인(2026-10-31) ; 저장소 소유자 결정(2026-10-31)"
review-after: 사용량 집계를 다시 넣기 전
---

# ADR 0003: Desktop 사용 통계를 보내지 않는다

## 상태

채택. [ADR 0002](0002-desktop-usage-stats-ga4.md)를 대체한다.

## 맥락

- ADR 0002에 따라 v1.0.0부터 배포 앱이 앱 실행, 캡처 회차, 직접 검색을 GA4로 보낸다. v1.0.0 Release 빌드에는 측정 ID와 API secret이 들어갔다.
- 웹사이트를 공개하고 커뮤니티에 앱을 알리려 한다. ADR 0002의 다시 정할 조건인 웹사이트 공개에 해당한다.
- 앱은 소스 공개를 신뢰의 근거로 내세운다. 개인정보처리방침과 화면 안내 없이 Google로 설치별 ID를 보내면 그 근거가 약해진다.
- GA를 계속 쓰려면 GA 이용과 수집 방식을 사용자에게 알려야 한다.

## 선택지

| 선택지 | 사용량 확인 | 사용자 신뢰 | 할 일 |
| --- | --- | --- | --- |
| A. GA4를 두고 사이트, 홍보글에 고지 | 유지 | 고지해도 설치별 ID가 Google로 간다 | 고지 문구, 개인정보 안내 |
| B. GA4를 두고 끄는 설정 추가 | 대부분 유지 | 끌 수 있다 | 설정 화면, 저장, 고지 |
| C. GA4를 지운다 | 없다 | 사용량을 세는 외부 전송이 없다 | 새 Release |

## 결정

C를 채택한다(2026-10-31 저장소 소유자 결정). Desktop은 사용 통계를 보내지 않고, 빌드 설정과 Release workflow도 GA 값을 받지 않는다. 대신할 집계는 두지 않는다.

## 결과

- 사용자 수와 기능별 사용량을 알 수 없다. GitHub Release 다운로드 수와 API 요청 수만 남는다.
- v1.0.0은 새 버전으로 바꾸기 전까지 계속 GA4로 보낸다. 받지 않으려면 GA 속성에서 Measurement Protocol API secret을 지운다.
- 이전 버전이 profile 폴더에 만든 `usage-stats.json`은 지우지 않고 남긴다. 앱이 더는 읽지 않는다.
