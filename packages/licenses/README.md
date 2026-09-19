# @ldb/licenses

LDB의 빌드 도구용 오픈소스 고지 패키지입니다. 공용 원문·버전별 보완 자료·수집 코드를 한곳에서 관리하고, 앱별 배포 내용에 맞는 산출물을 만듭니다. 제품 renderer·공용 함수의 runtime 의존성이 아닙니다. 저장소의 Node 24와 Vite 기반 빌드에서 사용합니다.

## 원본과 수집 범위

- `notices/ui`: 기존 SEED·아이콘 LICENSE/NOTICE 원문입니다. 수정 내역·source hash는 소유 코드의 `packages/ui/seed-provenance.json`에 유지합니다.
- `notices/desktop`: NanumSquareNeo·Lucide와 Desktop UI 자산 출처입니다.
- `notices/lib`: CP949 문자 표의 iconv-lite 고지입니다. `@ldb/lib` build에서 `dist/notices`로 복사합니다. Desktop이 이 함수를 아직 소비하지 않으므로 현재 Desktop 고지에는 넣지 않습니다.
- `notices/upstream`, `overrides.json`: 설치된 npm 패키지에서 빠진 원문을 해당 버전의 upstream 또는 배포 패키지로부터 보완합니다. 출처·버전·SHA-256을 기록하며 빌드 중 네트워크에서 가져오지 않습니다. 범용 MIT 문구로 저작권자를 추정하지 않습니다.
- OCR 원문은 모델·사전과 검증 hash를 함께 관리하는 `apps/desktop/assets/ocr`에 보존하고 Desktop 고지에 수집합니다. 원래 OCR 배포 경로도 유지합니다.
- npm 고지는 번들 입력 graph와 설치된 production dependency의 전이 의존성에서 수집합니다. 입력 graph는 tree-shaking 이전 입력도 포함하므로 일부 미사용 입력의 고지가 포함될 수 있습니다. `devDependencies` 전체를 일괄 배포하지 않습니다.

`uiNotices({ uiRoot })`는 기존 UI·Web·Desktop의 고지와 SEED 변경 banner·provenance·bundle 목록을 유지합니다. `desktopNotices({ desktopRoot, uiRoot })`는 여기에 Desktop runtime·OCR·글꼴·아이콘·Electron 고지와 열람용 정적 HTML·JSON을 추가합니다. 실제 파일을 찾지 못한 새 npm 고지는 빌드를 실패시킵니다.

## 알려진 원문 공백

기존 ONNX 의존성인 `guid-typescript@1.0.9`는 npm에 ISC를 선언하지만 설치 패키지와 현재 공식 저장소에 LICENSE 원문이 없습니다. npm의 gitHead도 현재 저장소에서 조회되지 않았습니다. 이 한 버전은 `LICENSE-STATUS.txt`와 화면의 **원문 확인 필요** 표시로 공백을 보존합니다. 이 표시는 라이선스 원문을 대신하거나 준수 완료를 뜻하지 않습니다. 원문 확보 또는 해당 구성요소를 실제 배포에서 제거하는 판단이 남아 있습니다.

근거: [npm 1.0.9](https://www.npmjs.com/package/guid-typescript/v/1.0.9), [현재 공식 저장소](https://github.com/snico-dev/guid-typescript). 원문을 확보하면 이 예외와 테스트를 함께 갱신합니다.

## Desktop 화면과 배포

기본 화면의 `파티` / `오픈소스 라이선스` 탭에서 로그인 없이 고지를 읽습니다. 정적 문서는 로컬에 포함되며 외부 fetch·실행 script·새 IPC가 없습니다. 원문은 HTML escape 후 `<pre>`로 표시하고 Chromium의 HTML 원문은 별도의 sandbox iframe에서 엽니다. 파티 탭을 숨겨도 캡처 hook과 이미 열린 화면은 unmount하지 않습니다.

- 개발 서버: Vite middleware가 현재 모듈 graph와 로컬 원문을 제공합니다.
- 일반 build·UI fixture: `out/frontend/notices/index.html`과 원문·`licenses.json`을 사용합니다.
- 설치 패키지: `afterExtract`가 대상 Electron 원문을 보존하고 `afterPack`이 대상 앱의 `resources/licenses`(macOS는 `Contents/Resources/licenses`)에 복사하고, **실제 대상 Electron 배포물**의 LICENSE·Chromium 고지로 교체합니다. cross build에서도 호스트 원문을 대상 원문이라고 표시하지 않습니다. 빌드 공용 입력을 수정하지 않아 target별 복사를 격리합니다.

기존 고지 파일·배포 시 필요한 source 변경 표시를 탭으로 대체해 삭제하지 않습니다. 자동 수집은 라이선스 충돌·copyleft 소스 제공·모델 사용 조건의 법률 검토를 대신하지 않으며, 새 종류의 자산이나 native component는 실제 배포 구성을 함께 확인해야 합니다.

## 사용·검증

소비 빌드의 `devDependencies`에 `"@ldb/licenses": "workspace:*"`를 추가합니다.

```ts
import { uiNotices, desktopNotices } from '@ldb/licenses/vite'
```

```bash
pnpm --filter @ldb/licenses test
pnpm --filter @ldb/lib test
pnpm --filter @ldb/desktop build
```

`ldb-copy-notices lib dist/notices`는 정적 고지 복사용 bin입니다. 배포 시 `src`·`notices`·`overrides.json`을 함께 유지합니다. 수집기 테스트는 전이·순환 의존성, dev 제외, nested LICENSE, 버전 고정 보완, 누락 감지, HTML escape, target별 packaging 원문 교체를 확인합니다.
