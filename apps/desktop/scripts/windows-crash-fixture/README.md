# Windows 합성 crash 실험 도구

Issue #432의 생성, marker 확립, R0→R1 교체, clear와 재시작 복구를 기존 Windows credential store에 연결합니다. 합성 safeStorage만 사용하며 실제 credential, Electron safeStorage/DPAPI, HTTP 및 VM 전원 제어는 없습니다. 실험 adapter의 `confirmed`는 실행을 위한 주입값이며 제품 capability를 바꾸지 않습니다. 정상 대조 통과도 namespace 또는 전원 손실 내구성의 증명이 아닙니다.

`createWindowsSecurityApiForTesting` → 반환 관측 API → `createWindowsSecurityNative` → 실험 adapter → `createWindowsCredentialStore`의 기존 `WindowsCredentialFiles` 경로를 사용합니다. 기존 `prepareCredentialTransition`, `finalizeCredentialTransition`, `clearCredential`을 재사용하며 실험 경계만 연결합니다.

## 실행

승인된 Windows 일반 사용자 세션, 고정 source commit과 lockfile의 dependencies가 필요합니다. 다음 명령의 cwd는 `apps/desktop`입니다. 이 native 실행은 일반 전체 test/lint/build/format과 별도입니다.

```powershell
node node_modules/typescript/bin/tsc --noEmit -p scripts/windows-crash-fixture/tsconfig.json
$env:LDB_CRASH_CONFIG = 'C:\approved-lab\normal-config.json'
node node_modules/vitest/vitest.mjs run --config scripts/windows-crash-fixture/vitest.config.ts
```

Config는 아래 형태의 UTF-8 JSON입니다. 실제 경로는 승인된 실험 영역을 사용합니다. `root` 이름에 새 UUID v4를 사용하며 root 자체는 만들지 않습니다. `evidence`는 root와 같은 parent에 미리 만든 빈 일반 directory입니다. 예시 UUID와 실행 이름은 재사용하지 않습니다.

```json
{
  "runId": "normal-01",
  "caseId": "normal-control",
  "mode": "normal",
  "root": "C:\\approved-lab\\ldb-crash-11111111-1111-4111-8111-111111111111",
  "evidence": "C:\\approved-lab\\ldb-crash-11111111-1111-4111-8111-111111111111-normal-01-evidence"
}
```

Root parent와 ancestors의 안전한 namespace를 확인하지 못하면 생성 전에 실패합니다. Root는 실제 native private DACL로 생성합니다. 최초 disk 관측과 host ACK, 새 directory 생성, R0 저장, marker 상태의 새 store 검사와 복호화 0회, R1 교체 및 새 store의 R1 확인, clear 후 empty, marker와 R1이 남은 새 store의 복구 및 clear를 확인합니다. 실제 flush 실패 등은 실패로 보존하며 mock 성공으로 대체하지 않습니다.

## Host ACK 실행

`host-observer.ps1`은 이미 승인된 `PSSession`을 입력받습니다. Session 생성, credential 획득이나 VM 제어는 없습니다. Guest test를 기존 Runner로 비동기 시작하고 반환된 idle session으로 host의 별도 PowerShell에서 실행합니다. 긴 guest Invoke-Command가 점유한 session을 동시에 사용하지 않습니다.

```powershell
& .\apps\desktop\scripts\windows-crash-fixture\host-observer.ps1 `
  -Session $existingGuestSession -GuestEvidence $guestEvidencePath `
  -HostEvidence $newHostEvidencePath -RunId 'normal-01' `
  -CaseId 'normal-control' -DeadlineSeconds 900
```

HostEvidence는 guest disk와 VM 저장소에서 분리된 host 보존 위치여야 합니다. 실행 담당이 그 위치와 source commit을 기록합니다. Host script는 새 위치만 만들고 reparse ancestors를 거절하지만 물리 저장소 분리는 증명하지 않습니다.

Guest는 sequence별 request를 `.pending`에 기록하고 flush/close 후 `.request.json`으로 공개합니다. Host는 request를 읽고 identity를 확인한 뒤 host의 새 `.record.json`에 원본 bytes를 기록하고 `Flush(true)`와 close를 완료합니다. 그 뒤에만 ACK를 guest에 독점 생성하여 공개합니다. Guest는 runId, caseId, sequence, cutpoint, phase, outcome 여섯 field가 정확히 일치할 때만 다음 mutation을 허용합니다.

Mismatch, stale/duplicate ACK, 기록 오류, disconnect 및 30초 ACK timeout은 자동 continue하지 않습니다. Request 존재 확인은 mutation 재시도가 아닙니다. Host 전체 및 guest test deadline은 900초입니다. Host script는 remote job을 남은 deadline으로 기다리고 종료 시 job을 정리합니다. Timeout 후 늦은 ACK를 발행하지 않습니다.

**Host script 종료는 terminal ACK 전달 완료일 뿐 guest 성공이 아닙니다.** Runner는 guest 전체 process의 실제 종료와 exit 0, 최종 `result.json`의 passed, host terminal record 및 모든 sequence ACK, `failure.json` 부재를 함께 확인하고 수집해야 합니다. Terminal ACK 뒤 result 기록이 실패하면 전체 실패입니다. 실패/timeout 시 기존 Runner의 승인된 process 종료 절차를 따르고 VM을 종료하지 않습니다. Native 실패 뒤 독립적인 일반 lint/build/test/format 결과는 따로 보존하며 전체 native 성공으로 합치지 않습니다.

## 경계와 보존

- `adapter.create-directory`, `create-exclusive`, `write`, `flush`, `rename`, `remove`, `sync-directory`, `close`의 before/after가 ACK 중단 지점입니다. Before는 호출 전, after는 동기 native method 전체의 반환/throw 뒤입니다.
- `nativeReturns`는 관측 사이의 동기 Win32 API 반환값 순서입니다. 각 adapter operation 앞에서 이전 read-only 관측을 비워 해당 operation의 반환만 연결합니다. 이 배열 안의 호출 사이에는 ACK나 중단이 없습니다. `returned`는 protocol 성공이나 내구성 보장이 아닙니다.
- `protocol-return`은 기존 store/operation의 confirmed/established/committed/cleared 등을 별도로 기록합니다.
- FileDispositionInfo→동기 내부 CloseHandle, 다른 동기 method 내부 및 물리 전원 손실 지점은 미지원입니다. Adapter remove 전후를 내부 지점으로 표시하지 않습니다. Process 종료 시 OS handle 정리도 관측된 내부 경계가 아닙니다.
- `original-disk`는 이름, 타입/보호 판정, 합성 bytes와 SHA-256을 읽고 host ACK 후 store를 검사합니다. `store.inspect()`도 directory를 생성할 수 있으므로 최초 관측으로 사용하지 않습니다. 읽기 실패는 empty가 아닙니다.

보존된 합성 root를 복구하려면 새 runId/evidence, `caseId: "recovery"`, `mode: "recover"`, 원래 정상 실행의 manifest 절대 경로인 `originManifest`를 설정합니다. Root는 원래 manifest와 일치해야 합니다. 새 host observer를 같은 run/case로 실행합니다. Marker/temporary는 복호화 0회를 확인한 뒤 기존 clear 순서로 복구합니다. Ready/empty는 관측하며 자동 refresh/publish는 없습니다. Unavailable은 실패입니다. 외부 recover 모드의 결과는 `observed-unverified`이며 정상 대조 PASS나 crash 내구성 verdict가 아닙니다. 이전 cutpoint/success history와 비교하는 crash oracle은 미지원입니다. 강제 종료 실험은 별도 허용 범위입니다.

자동 cleanup은 없습니다. 원본 root, manifest, request/ACK, `.pending`, result/failure 및 host 기록을 모두 보존합니다. 실패한 이름으로 재실행하거나 덮어쓰지 않습니다. Cleanup은 이 도구에 포함되지 않습니다.

`observer.test.ts`는 ACK identity와 duplicate/timeout/disconnect, pending mutation 차단, 최초 관측과 ACK 이전 store 검사 0회를 확인합니다. 기존 `windows-credential-store.test.ts`의 flush/write/rename/clear 실패 및 marker/temporary 복호화 차단을 재사용합니다. 일반 unit 통과는 실제 Win32 검증을 대신하지 않습니다.


## 기존 VM Runner의 정상 대조 실행 packet

Runner는 기존 스킬의 승인된 source/dependency 준비 및 일반 사용자 세션 생성을 그대로 사용합니다. 아래 `$session`은 준비가 완료된 idle session이며, `$guestDesktop`, `$guestNode`, `$guestLab`, `$hostLab`은 스킬이 확정한 절대 경로입니다. Source commit과 PowerShell script 세 개의 SHA-256을 실행 기록에 남깁니다. Node executable 및 lockfile을 바꾸거나 install하지 않습니다.

```powershell
$runId = 'normal-' + [guid]::NewGuid().ToString()
$root = Join-Path $guestLab ('ldb-crash-' + [guid]::NewGuid().ToString())
$evidence = $root + '-' + $runId + '-evidence'
$config = $root + '-' + $runId + '.config.json'
$hostEvidence = Join-Path $hostLab $runId
Invoke-Command -Session $session -ScriptBlock {
  param($Root, $Evidence, $Config, $Run)
  $ErrorActionPreference = 'Stop'
  if ((Test-Path -LiteralPath $Root) -or (Test-Path -LiteralPath $Evidence) -or (Test-Path -LiteralPath $Config)) { throw 'Fixture paths must be new.' }
  New-Item -ItemType Directory -Path $Evidence | Out-Null
  $body = @{ runId = $Run; caseId = 'normal-control'; mode = 'normal'; root = $Root; evidence = $Evidence } | ConvertTo-Json -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $file = [IO.File]::Open($Config, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
  try { $file.Write($bytes, 0, $bytes.Length); $file.Flush($true) } finally { $file.Dispose() }
} -ArgumentList $root, $evidence, $config, $runId
& .\apps\desktop\scripts\windows-crash-fixture\run-normal-control.ps1 `
  -Session $session -GuestDesktop $guestDesktop -GuestNode $guestNode `
  -GuestConfig $config -GuestEvidence $evidence -HostEvidence $hostEvidence -RunId $runId
```

`run-normal-control.ps1`은 시작 전에 host의 PowerShell script 세 개를 parser로 검사하고 `host-control.test.ps1`의 실제 start/cleanup AST 기반 4개 stub 회귀 검증을 실행합니다. Stub 검증은 실제 session/process/VM/file을 변경하지 않으며 통과 전에는 guest process를 시작하지 않습니다. Guest의 전용 harness typecheck는 위 명령으로 별도 통과시킨 뒤 실행합니다. Guest cwd는 `$guestDesktop`, executable은 `$guestNode`, args는 `node_modules/vitest/vitest.mjs run --config scripts/windows-crash-fixture/vitest.config.ts --pool=threads --maxWorkers=1`, environment 추가는 자식 process의 `LDB_CRASH_CONFIG=$config`입니다. 부모 session 환경은 즉시 복원합니다.

Guest process는 `Start-Process -PassThru`의 정확한 Process 객체를 invocation마다 새로 만든 owner nonce 및 runId와 함께 session에 보관합니다. 같은 runId로 거절된 재실행의 finally는 이전 nonce의 process를 종료하지 않습니다. 단일 worker thread를 사용해 Vitest 자식 worker process를 만들지 않습니다. Host observer 완료 후 20초 내 guest 종료, exit 0, 같은 run/case의 result passed 및 failure 부재를 확인해야만 성공 JSON을 반환합니다. 시작/terminal/종료 제어 remoting은 각각 최대 30초, 관측은 최대 900초입니다. 모든 종료 경로에서 자신의 run Process만 종료/WaitForExit/Dispose하며 VM이나 다른 process를 종료하지 않습니다. Session이 끊겨 종료를 확인할 수 없으면 실패 상태로 보존하고 기존 Runner의 재연결/소유 process 확인 절차로 넘깁니다. 종료를 추정하거나 자동 재실행하지 않습니다.

기존 스킬의 Collect 단계에 전달할 exact guest artifact는 `$evidence` 전체, `$evidence + '.stdout.log'`, `$evidence + '.stderr.log'`입니다. Host artifact는 `$hostEvidence` 전체와 wrapper의 terminal JSON/종료 코드입니다. `$root`와 `$config`는 guest에 그대로 보존합니다. 수집 실패도 완료가 아닙니다. Native 실패 후 독립적인 일반 test/lint/build/format을 진행할 때는 별도 job/result로 기록하고 최초 native 실패와 섞지 않습니다.
