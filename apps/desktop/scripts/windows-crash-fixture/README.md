# Windows 합성 crash 실험 도구

기존 Windows credential store의 생성, marker 확립, R0→R1 교체, clear와 재시작 복구를 단계마다 멈추고 관측하는 실험 도구입니다. 합성 safeStorage만 사용하며 실제 credential, Electron safeStorage/DPAPI, HTTP와 VM 전원 제어는 없습니다. 기존 native adapter에 관측을 연결하며 제품의 실행 시 권한, 파일 검사는 유지합니다.

`createWindowsSecurityApiForTesting` → 반환 관측 API → `createWindowsSecurityNative` → 실험 adapter → `createWindowsCredentialStore`의 기존 `WindowsCredentialFiles` 경로를 사용합니다. 기존 `prepareCredentialTransition`, `finalizeCredentialTransition`, `clearCredential`을 재사용하며 실험 경계만 연결합니다.

배포 후 재현된 저장 문제를 조사할 때 선택적으로 사용합니다. 로그인 개발, 활성화, 배포에 이 실험이 필요하지는 않습니다. 정상 대조 통과도 namespace 또는 전원 손실 내구성의 증명이 아닙니다.

## 합성 회귀 테스트

같은 폴더의 `*.test.ts`는 Desktop의 기본 `test`가 실행합니다. `observer.test.ts`는 ACK identity와 duplicate, timeout, disconnect, pending mutation 차단, 최초 관측과 ACK 이전 store 검사 0회를 확인합니다. 일반 unit 통과는 실제 Win32 검증을 대신하지 않습니다.

PowerShell 회귀 검증 `host-control.test.ps1`, `host-selection.test.ps1`, `host-publication.test.ps1`, `host-evidence.test.ps1`은 직접 실행합니다. Publication, evidence test만 새 UUID 임시 directory에 실제 파일을 쓰며 기존 run은 정리하지 않습니다.

## 실행

승인된 Windows 일반 사용자 세션, 고정 source commit과 lockfile의 dependencies가 필요합니다. 다음 명령의 cwd는 `apps/desktop`입니다. 이 native 실행은 일반 test, lint, build, format과 별도입니다.

```powershell
node node_modules/typescript/bin/tsc --noEmit -p scripts/windows-crash-fixture/tsconfig.json
$env:DFRAGON_CRASH_CONFIG = 'C:\approved-lab\normal-config.json'
node node_modules/vitest/vitest.mjs run --config scripts/windows-crash-fixture/vitest.config.ts
```

Config는 아래 형태의 UTF-8 JSON입니다. 실제 경로는 승인된 실험 영역을 사용합니다. `root` 이름에 새 UUID v4를 사용하며 root 자체는 만들지 않습니다. `evidence`는 root와 같은 parent에 미리 만든 빈 일반 directory입니다. 예시 UUID와 실행 이름은 재사용하지 않습니다.

```json
{
  "runId": "normal-01",
  "caseId": "normal-control",
  "mode": "normal",
  "root": "C:\\approved-lab\\dfragon-crash-11111111-1111-4111-8111-111111111111",
  "evidence": "C:\\approved-lab\\dfragon-crash-11111111-1111-4111-8111-111111111111-normal-01-evidence"
}
```

Root parent와 ancestors는 기존 native fixture와 같은 일반 directory, reparse 검사를 수행합니다. 이는 격리된 VM 실험 범위이고 악의적인 parent 교체를 방어한다는 보장이 아닙니다. 새 root는 실제 native private DACL로 생성한 뒤 `private/trusted`를 확인합니다. 실제 flush 실패 등은 실패로 보존하며 mock 성공으로 대체하지 않습니다.

보존된 합성 root를 복구하려면 새 runId와 evidence, `caseId: "recovery"`, `mode: "recover"`, 원래 정상 실행의 manifest 절대 경로인 `originManifest`를 설정합니다. 원래 host의 `held.json`을 새 guest 파일로 복사한 `originHostHold`와 그 SHA-256인 `originHostHoldSha256`도 필요합니다. 결과는 `observed-consistent` 또는 `findings`이며 정상 대조 PASS나 전원 손실 내구성 증명이 아닙니다. 강제 종료 실행은 별도 허용 범위입니다.

### Host ACK

`host-observer.ps1`은 이미 승인된 `PSSession`을 입력받습니다. Session 생성, credential 획득이나 VM 제어는 없습니다. Guest test를 비동기로 시작하고 반환된 idle session으로 host의 별도 PowerShell에서 실행합니다. VM Runner에서는 `run-normal-control.ps1`이 이 순서를 묶습니다.

```powershell
& .\apps\desktop\scripts\windows-crash-fixture\host-observer.ps1 `
  -Session $existingGuestSession -GuestEvidence $guestEvidencePath `
  -HostEvidence $newHostEvidencePath -RunId 'normal-01' `
  -CaseId 'normal-control' -DeadlineSeconds 900
```

HostEvidence는 guest disk와 VM 저장소에서 분리된 host 보존 위치여야 합니다. Guest는 단계마다 request를 공개하고, host가 원본 bytes를 기록하고 flush한 뒤에만 ACK를 받아 다음 mutation으로 진행합니다. Mismatch, stale 또는 duplicate ACK, 기록 오류, disconnect와 30초 ACK timeout은 자동으로 계속하지 않습니다. Host와 guest test deadline은 900초입니다.

**Host script 종료는 terminal ACK 전달 완료일 뿐 guest 성공이 아닙니다.** guest process의 실제 종료와 exit 0, 최종 `result.json`의 passed, host terminal record와 모든 sequence ACK, `failure.json` 부재를 함께 확인합니다.

## 보존

- 자동 cleanup은 없습니다. 원본 root, manifest, request와 ACK, `.pending`, result, failure와 host 기록을 모두 보존합니다.
- 실패한 이름으로 재실행하거나 덮어쓰지 않습니다. 실행마다 새 run, root, config, evidence를 만듭니다.
- 실행 담당이 host 보존 위치와 source commit을 기록합니다. Native 실패와 별개로 실행한 일반 lint, build, test, format 결과는 따로 보존하며 native 성공으로 합치지 않습니다.
- 실패나 timeout 때는 VM을 종료하지 않고 기존 Runner의 승인된 process 종료 절차를 따릅니다.
