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

Root parent와 ancestors는 기존 native fixture와 같은 일반 directory 및 reparse 검사를 수행합니다. Ancestor의 `untrusted`는 ACL 신뢰로 승격하지 않으며 구조 관측으로만 구분합니다. 이는 격리된 VM 실험 범위이고 악의적인 parent 교체를 방어한다는 보장이 아닙니다. 새 root는 실제 native private DACL로 생성한 뒤 반드시 `private/trusted`를 확인하며 하위 제품 ACL 검사도 유지합니다. 최초 disk 관측과 host ACK, 새 directory 생성, R0 저장, marker 상태의 새 store 검사와 복호화 0회, R1 교체 및 새 store의 R1 확인, clear 후 empty, marker와 R1이 남은 새 store의 복구 및 clear를 확인합니다. 실제 flush 실패 등은 실패로 보존하며 mock 성공으로 대체하지 않습니다.

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

보존된 합성 root를 복구하려면 새 runId/evidence, `caseId: "recovery"`, `mode: "recover"`, 원래 정상 실행의 manifest 절대 경로인 `originManifest`를 설정합니다. Root는 원래 manifest와 일치해야 합니다. 새 host observer를 같은 run/case로 실행합니다. Marker/temporary는 복호화 0회를 확인한 뒤 기존 clear 순서로 복구합니다. Ready/empty는 관측하며 자동 refresh/publish는 없습니다. Unavailable은 실패입니다. 외부 recover 모드의 결과는 `observed-consistent` 또는 `findings`이며 정상 대조 PASS나 전원 손실 내구성 증명이 아닙니다. 복구에는 원래 host의 `held.json`을 새 guest 파일로 복사한 `originHostHold`와 그 host SHA-256인 `originHostHoldSha256`도 필요합니다. 아래 중단 선택과 복구 판정 절의 실행 packet을 사용합니다. 강제 종료 실행은 별도 허용 범위입니다.

자동 cleanup은 없습니다. 원본 root, manifest, request/ACK, `.pending`, result/failure 및 host 기록을 모두 보존합니다. 실패한 이름으로 재실행하거나 덮어쓰지 않습니다. Cleanup은 이 도구에 포함되지 않습니다.

`observer.test.ts`는 ACK identity와 duplicate/timeout/disconnect, pending mutation 차단, 최초 관측과 ACK 이전 store 검사 0회를 확인합니다. 기존 `windows-credential-store.test.ts`의 flush/write/rename/clear 실패 및 marker/temporary 복호화 차단을 재사용합니다. 일반 unit 통과는 실제 Win32 검증을 대신하지 않습니다.


## 기존 VM Runner의 정상 대조 실행 packet

Runner는 기존 스킬의 승인된 source/dependency 준비 및 일반 사용자 세션 생성을 그대로 사용합니다. 아래 `$session`은 준비가 완료된 idle session이며, `$guestDesktop`, `$guestNode`, `$guestLab`, `$hostLab`은 스킬이 확정한 절대 경로입니다. Source commit과 PowerShell script와 회귀 검증 파일의 SHA-256을 실행 기록에 남깁니다. Node executable 및 lockfile을 바꾸거나 install하지 않습니다.

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

`run-normal-control.ps1`은 시작 전에 host의 PowerShell script와 회귀 검증 파일를 parser로 검사하고 `host-control.test.ps1`의 실제 start/cleanup AST 기반 6개 stub 회귀 검증을 실행합니다. Stub 검증은 실제 session/process/VM/file을 변경하지 않으며 통과 전에는 guest process를 시작하지 않습니다. Guest의 전용 harness typecheck는 위 명령으로 별도 통과시킨 뒤 실행합니다. Guest cwd는 `$guestDesktop`, executable은 `$guestNode`, args는 `node_modules/vitest/vitest.mjs run --config scripts/windows-crash-fixture/vitest.config.ts --pool=threads --maxWorkers=1`, environment 추가는 자식 process의 `LDB_CRASH_CONFIG=$config`입니다. 부모 session 환경은 즉시 복원합니다.

Guest process는 `Start-Process -PassThru`의 정확한 Process 객체를 invocation마다 새로 만든 owner nonce 및 runId와 함께 session에 보관합니다. 같은 runId로 거절된 재실행의 finally는 이전 nonce의 process를 종료하지 않습니다. 단일 worker thread를 사용해 Vitest 자식 worker process를 만들지 않습니다. Host observer 완료 후 20초 내 guest 종료, exit 0, 같은 run/case의 result passed 및 failure 부재를 확인해야만 성공 JSON을 반환합니다. 시작/terminal/종료 제어 remoting은 각각 최대 30초, 관측은 최대 900초입니다. 모든 종료 경로에서 자신의 run Process만 종료/WaitForExit/Dispose하며 VM이나 다른 process를 종료하지 않습니다. Session이 끊겨 종료를 확인할 수 없으면 실패 상태로 보존하고 기존 Runner의 재연결/소유 process 확인 절차로 넘깁니다. 종료를 추정하거나 자동 재실행하지 않습니다.

기존 스킬의 Collect 단계에 전달할 exact guest artifact는 `$evidence` 전체, `$evidence + '.stdout.log'`, `$evidence + '.stderr.log'`입니다. Host artifact는 `$hostEvidence` 전체와 wrapper의 terminal JSON/종료 코드입니다. `$root`와 `$config`는 guest에 그대로 보존합니다. 수집 실패도 완료가 아닙니다. Native 실패 후 독립적인 일반 test/lint/build/format을 진행할 때는 별도 job/result로 기록하고 최초 native 실패와 섞지 않습니다.

준비 실패도 `diagnostics.ts`의 고정 stage 이름만 오류에 남깁니다. 원문 native 오류, 경로와 SID는 출력하지 않습니다. Evidence directory 검증 전 실패하면 그 위치에 failure 파일을 강제로 쓰지 않으며 guest stdout/stderr의 stage와 실제 process 종료를 진단 근거로 사용합니다.

Wrapper는 host observer에 자신의 runId와 owner nonce를 전달합니다. Request polling 전에 보관된 같은 Process의 종료를 확인하여 준비 단계에서 이미 종료된 guest를 전체 900초 deadline까지 기다리지 않습니다. 다른 run/nonce이면 즉시 실패하며 process를 변경하지 않습니다. 독립 host observer 호출처럼 Process 소유권을 전달하지 않은 경우에는 기존 artifact 및 deadline 관측만 수행합니다.


Windows PowerShell 5.1의 redirect와 `Start-Process -PassThru` 조합에서는 종료 후에도 ExitCode가 null인 사례가 있습니다. 이 실험 환경에서도 합성 child의 종료 코드 0과 7이 모두 null이었고, 시작 직후 Process.Handle을 확보하면 같은 PSSession의 서로 다른 시작/관측/종료 호출에서 두 숫자를 정확히 읽었습니다. Wrapper는 이 최소 보완을 사용하며 Process 객체가 Dispose까지 handle을 보유합니다. Handle 취득 실패나 숫자가 아닌 ExitCode를 성공으로 바꾸지 않습니다. 매우 빠른 종료의 모든 race를 보증하는 변경은 아닙니다.

근거는 [PowerShell 공식 이슈 #5421](https://github.com/PowerShell/PowerShell/issues/5421)과 [Process.ExitCode 계약](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.exitcode?view=netframework-4.8.1)입니다. 과거 정상 대조의 result passed나 host ACK를 근거로 수집하지 못한 숫자 종료 코드를 소급 확정하지 않습니다.


## 중단 선택과 복구 판정

`store.*`의 `protocol-start`와 `protocol-return`은 기존 store 메서드 호출과 실제 반환값입니다. `detail.scenario`로 생성, 교체와 clear를 구분합니다. 성공을 보고한 시점은 host가 `confirmed` 등의 protocol-return 원본 bytes를 보존한 시점이며 ACK 완료와 구분합니다. `adapter.*`의 `after/returned`, `nativeReturns`, 선택 지점에 도착했다는 사실은 protocol 성공이 아닙니다. 선택 가능한 지점은 위 adapter 목록의 `before/after`뿐입니다.

Host는 각 원본 `.record.json`을 보존하고 ACK 전달을 확인한 뒤 `.ack-delivered.json`을 남깁니다. 선택 지점에서는 contiguous 원본 bytes 전체와 run/case/sequence/cutpoint/phase/outcome, 원래 manifest와 실행 owner를 `held.json`에 보존한 뒤 ACK를 보류합니다. 최종 이름은 `.pending`의 write, `Flush(true)`, close 뒤에만 공개합니다. **운영자는 최종 `held.json`을 완전히 읽고 선택과 source/evidence hash를 확인한 뒤에만 승인된 중단을 수행합니다.** `.pending` 또는 원본 record 파일의 존재는 중단 신호가 아닙니다.

Selected run의 config에는 `ackTimeoutMs: 900000`을 명시합니다. Host 전체 deadline은 900초, 기본 hold는 도달 후 600초이며 남은 host deadline을 넘지 않습니다. Guest는 이 동안 mutation을 진행하지 않습니다. 만료, disconnect, point 미도달, identity 불일치나 nonnumeric exit는 실패이며 원래 run을 PASS로 바꾸지 않습니다. 별도 승인을 기다리는 동안 무기한 멈춰 두지 말고, 실행 조건을 확정한 뒤 새 run을 시작합니다. 만료 뒤 자동 재실행은 없습니다.

### 정상 inventory와 선택 파일

먼저 동일 source/lockfile로 정상 대조를 완료합니다. 그 host evidence의 원본 record에서 경계 목록을 만들며 이전 run의 sequence를 새 run에서 무조건 같은 경계라고 간주하지 않습니다. Host는 새 run의 exact cutpoint/phase/sequence를 다시 확인하므로 흐름이 달라지면 실패합니다. 아래는 host PowerShell에서 실행합니다.

```powershell
$ErrorActionPreference = 'Stop'
$method = ''
$scenario = 'prepare'
$inventory = foreach ($file in Get-ChildItem -LiteralPath $normalHostEvidence -Filter '*.record.json' | Sort-Object Name) {
  $event = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  if ($event.phase -ceq 'protocol-start' -and $event.cutpoint.StartsWith('store.')) {
    $method = $event.cutpoint
    $scenario = $event.detail.scenario
  }
  if ($event.cutpoint.StartsWith('adapter.')) {
    $family = ''
    if ($scenario -ceq 'prepare') { $family = 'creation' }
    if ($method -ceq 'store.establishTransition') { $family = 'marker-establishment' }
    if ($method -ceq 'store.commitCredential' -and $scenario -ceq 'replace.commit-r1') { $family = 'replacement' }
    if ($method -ceq 'store.clearCredential' -and $scenario -ceq 'clear') { $family = 'clear-deletion' }
    if ($method -ceq 'store.removeTransition') { $family = 'marker-removal' }
    if ($family) {
      [pscustomobject]@{ family = $family; scenario = $scenario; method = $method; sequence = $event.sequence; cutpoint = $event.cutpoint; phase = $event.phase; path = $event.detail.path }
    }
  }
}
$inventory | Format-Table family, scenario, sequence, cutpoint, phase, path
```

최초 실제 중단 batch 제안은 이 inventory의 `(family, cutpoint, phase)`별 첫 대표 지점마다 새 root/run을 한 번 실행하는 것입니다. Creation, marker establishment, R0→R1 replacement, clear deletion, marker removal의 다섯 분류가 모두 있어야 합니다. 실제 목록과 총 개수는 정상 inventory를 확인한 뒤 실행 승인 기록에 고정합니다. Root마다 별도 정상 준비를 처음부터 수행하고 첫 미도달, 제어/관측 실패 또는 finding에서 batch를 멈춥니다. 반복 횟수와 대표 경계가 전체 Win32 호출, 모든 경로 또는 전원 손실을 검증했다는 뜻은 아닙니다. 내부 FileDispositionInfo→CloseHandle 지점을 추가하지 않습니다.

```powershell
$batch = @($inventory | Group-Object family, cutpoint, phase | ForEach-Object { $_.Group[0] })
$batch | Format-Table family, sequence, cutpoint, phase
# 실행 담당이 검토한 행 하나를 고릅니다. 각 행마다 새 run/root/config/evidence를 만듭니다.
$point = $batch[$approvedPointIndex]
$selection = @{ runId = $runId; caseId = 'normal-control'; sequence = $point.sequence; cutpoint = $point.cutpoint; phase = $point.phase }
$bytes = [Text.Encoding]::UTF8.GetBytes(($selection | ConvertTo-Json -Compress))
$file = [IO.File]::Open($newHostSelectionFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $file.Write($bytes, 0, $bytes.Length); $file.Flush($true) } finally { $file.Dispose() }
```

위 기존 정상 packet의 새 config 생성에서 `ackTimeoutMs = 900000`을 추가하고 wrapper에 선택 파일을 전달합니다. Session/VM 준비는 기존 Runner가 맡습니다.

```powershell
& .\apps\desktop\scripts\windows-crash-fixture\run-normal-control.ps1 `
  -Session $session -GuestDesktop $guestDesktop -GuestNode $guestNode `
  -GuestConfig $config -GuestEvidence $evidence -HostEvidence $hostEvidence `
  -RunId $runId -SelectionFile $newHostSelectionFile -HoldSeconds 600 `
  -DemonstrateHoldMilliseconds 1000
```

`-DemonstrateHoldMilliseconds 1000`은 host가 증거를 보존하고 1초간 ACK를 보류한 뒤 `released.json`을 보존하고 재개하는 비파괴 대조입니다. Wrapper의 성공 결과 이름은 `hold-demonstrated`이고 guest의 정상 완료와 numeric exit 0도 확인합니다. 실제 중단 batch에서는 이 인자를 **빼고**, 운영자가 별도 승인된 중단 방식을 수행합니다. 이 script에는 VM stop/start, checkpoint restore 또는 OS 전원 제어 명령이 없습니다.

수동 정상 재개가 필요하면 `held.json`의 identity와 owner를 그대로 사용해 새 `release.request.json`을 독점 생성합니다. `action: "resume"`만 지원하며 600초 안에 발행합니다. 이 파일을 만들면 guest mutation이 다시 시작될 수 있습니다.

```powershell
$held = Get-Content -LiteralPath (Join-Path $hostEvidence 'held.json') -Raw | ConvertFrom-Json
$release = @{ action = 'resume'; runId = $held.selection.runId; caseId = $held.selection.caseId; sequence = $held.selection.sequence; invocationOwner = $held.invocationOwner }
$bytes = [Text.Encoding]::UTF8.GetBytes(($release | ConvertTo-Json -Compress))
$file = [IO.File]::Open((Join-Path $hostEvidence 'release.request.json'), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $file.Write($bytes, 0, $bytes.Length); $file.Flush($true) } finally { $file.Dispose() }
```

### 중단 뒤 별도 process의 복구 실행

실제 VM 중단은 대상 VM, 중단 방식, 재시작 책임, 보존할 host 경로와 원본 disk를 고정한 **별도 사용자 승인 뒤에만** 운영자가 수행합니다. 승인 기록에 선정한 source commit/lockfile/script SHA-256, inventory와 선택 파일, host `held.json` SHA-256, 도달 시간, 중단/재시작의 실제 결과를 남깁니다. 정상 shutdown과 checkpoint rollback을 crash로 표시하지 않습니다. 원본이 변경되는 checkpoint restore는 이 packet에 포함하지 않습니다.

재시작 후에는 원래 root에 `inspect`, prepare 또는 cleanup을 먼저 호출하지 않습니다. 새 run/evidence/config만 준비하고, 원래 host의 `held.json`을 별도 새 guest 파일에 복사합니다. 아래 입력 변수는 기존 Runner가 확정한 절대 경로이며 `$originManifest`는 원래 guest evidence의 `manifest.json`, `$root`는 보존한 원본입니다. `held.json`의 source는 guest에 남은 request가 아니라 VM 저장소와 분리해 보존한 host evidence입니다.

```powershell
$heldPath = Join-Path $originalHostEvidence 'held.json'
$heldBytes = [IO.File]::ReadAllBytes($heldPath)
$heldSha = (Get-FileHash -LiteralPath $heldPath -Algorithm SHA256).Hash.ToLowerInvariant()
$recoverRun = 'recovery-' + [guid]::NewGuid().ToString()
$recoverEvidence = $root + '-' + $recoverRun + '-evidence'
$recoverConfig = $root + '-' + $recoverRun + '.config.json'
$guestHeldCopy = $root + '-' + $recoverRun + '.host-held.json'
$recoverHostEvidence = Join-Path $hostLab $recoverRun
Invoke-Command -Session $session -ScriptBlock {
  param($Root, $Evidence, $Config, $Run, $OriginManifest, $HeldPath, $HeldBytes, $HeldSha)
  $ErrorActionPreference = 'Stop'
  foreach ($path in @($Evidence, $Config, $HeldPath)) {
    if (Test-Path -LiteralPath $path) { throw 'Recovery paths must be new.' }
  }
  New-Item -ItemType Directory -Path $Evidence | Out-Null
  $stream = [IO.File]::Open($HeldPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($HeldBytes, 0, $HeldBytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  if ((Get-FileHash -LiteralPath $HeldPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $HeldSha) { throw 'Host evidence transfer hash mismatch.' }
  $settings = @{ runId = $Run; caseId = 'recovery'; mode = 'recover'; root = $Root; evidence = $Evidence; originManifest = $OriginManifest; originHostHold = $HeldPath; originHostHoldSha256 = $HeldSha }
  $bytes = [Text.Encoding]::UTF8.GetBytes(($settings | ConvertTo-Json -Compress))
  $stream = [IO.File]::Open($Config, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
} -ArgumentList $root, $recoverEvidence, $recoverConfig, $recoverRun, $originManifest, $guestHeldCopy, $heldBytes, $heldSha
& .\apps\desktop\scripts\windows-crash-fixture\run-normal-control.ps1 `
  -Session $session -GuestDesktop $guestDesktop -GuestNode $guestNode `
  -GuestConfig $recoverConfig -GuestEvidence $recoverEvidence `
  -HostEvidence $recoverHostEvidence -RunId $recoverRun -Mode recover
```

복구는 host transfer hash, contiguous raw record와 manifest/run/case/root/owner를 확인한 뒤 read-only original disk를 host에 보존하고 ACK를 받습니다. **이 ACK 뒤에만** 새 store를 검사하고 기존 marker protocol의 clear를 수행합니다. 최초 disk와 복구 결과는 따로 기록하며, 관측 실패는 empty가 아닙니다. 준비/읽기 실패는 기존 고정 stage failure로 남고 그 위치의 정상 관측이나 복구 성공을 주장하지 않습니다.

`oracle.ts`는 원본 합성 bytes의 hash와 record parser를 사용해 R0/R1, marker/temp를 판정합니다. 이는 합성 bytes 해석이며 DPAPI 복호화 검증이 아닙니다. 성공 보고 뒤 경로/marker/R1/삭제가 보존되지 않으면 `durabilityFindings`에 기록합니다. Marker 재등장 후 보수적으로 clear한 경우는 내구성 finding과 복구 안전성을 분리합니다. Marker 제거 결과 불명에서는 marker 없는 완전한 R1 복원을 허용합니다. 이전 R0 복원, marker/temp가 있는데 복호화/복원, 원본과 다른 inspection 상태 또는 필요한 clear/최종 empty 미확인은 `recoveryFindings`입니다.

자동 refresh/publish 값은 이 store 전용 fixture에 해당 callback이나 실제 network 호출이 없다는 제한된 관측입니다. 정상 인증 flow의 전송/게시 가드나 HTTP E2E를 검증했다고 표시하지 않습니다. 원래 정상 scenario도 실제 서버를 호출하지 않습니다.

Wrapper는 recovery guest의 실제 숫자 exit 0, 해당 run/case의 result, terminal ACK와 failure 부재를 확인합니다. Findings가 있으면 `findings`, 없으면 `observed-consistent`이며 둘 다 namespace durability는 `unverified`입니다. `interruption: external-evidence-required`는 실제 중단이 일어났다는 보장이 아닙니다. 원래 run의 만료/종료코드 미수집/수집 실패를 recovery의 exit 0으로 소급 PASS 처리하지 않습니다.

수집 대상은 원래/복구 root와 manifest/config, 원래/복구 guest evidence 전체, 각각의 `.stdout.log`와 `.stderr.log`, host evidence 전체(특히 raw record, ACK 전달, `held.json`, `.pending`, release/expiry/terminal/failure), wrapper JSON 및 numeric exit, 복사한 host-held 파일과 SHA-256, 운영자 중단/재시작 evidence입니다. 어느 것도 덮어쓰거나 자동 삭제하지 않습니다.

### 강제 종료 없는 별도 recovery 대조

실제 중단 승인 전에는 정상 inventory의 `scenario = recovery.clear`, `method = store.removeTransition`, `adapter.sync-directory`, `phase = after` 중 마지막 행을 선택해 위 1초 demonstration을 실행할 수 있습니다. 이 지점 뒤 정상 flow에는 store protocol-return과 empty 검사만 남고 credential/marker를 다시 쓰지 않습니다. 정상 guest numeric exit 0과 `hold-demonstrated`를 확인한 뒤 위 recovery packet을 같은 root에 실행합니다. 이는 원본 host 증거 로드, 별도 process, 원본 disk ACK와 empty 판정의 연결 검증입니다. VM/process crash나 marker/R1 crash 복구 evidence로 표시하지 않습니다. 임의의 앞선 point에서 정상 flow를 끝낸 disk를 그 point 직후 disk로 간주하지 않습니다.

```powershell
$point = @($inventory | Where-Object { $_.scenario -ceq 'recovery.clear' -and $_.method -ceq 'store.removeTransition' -and $_.cutpoint -ceq 'adapter.sync-directory' -and $_.phase -ceq 'after' })[-1]
if ($null -eq $point) { throw 'Final clear demonstration boundary is absent.' }
```

일반 검증 command는 root의 `pnpm --filter @ldb/desktop run --sequential '/^(test|lint|build)$/'`, `pnpm --filter @ldb/desktop format:check`, 전용 fixture typecheck입니다. PowerShell 검증은 `host-control.test.ps1`, `host-selection.test.ps1`, `host-publication.test.ps1`입니다. Publication test만 새 UUID host temp directory에 실제 파일을 쓰며 기존 run은 정리하지 않습니다. 모든 native 검증과 실제 interruption evidence는 별도로 보존합니다.
