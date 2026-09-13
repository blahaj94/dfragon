# Called from the pinned VM runner after its existing source/dependency/session preparation.
[CmdletBinding()]
param(
  [Parameter(Mandatory)][System.Management.Automation.Runspaces.PSSession] $Session,
  [Parameter(Mandatory)][string] $GuestDesktop,
  [Parameter(Mandatory)][string] $GuestNode,
  [Parameter(Mandatory)][string] $GuestConfig,
  [Parameter(Mandatory)][string] $GuestEvidence,
  [Parameter(Mandatory)][string] $HostEvidence,
  [Parameter(Mandatory)][string] $RunId,
  [ValidateSet('normal', 'recover')][string] $Mode = 'normal',
  [string] $SelectionFile,
  [ValidateRange(1, 600)][int] $HoldSeconds = 600,
  [ValidateRange(0, 5000)][int] $DemonstrateHoldMilliseconds = 0
)
$ErrorActionPreference = 'Stop'
$invocationOwner = [guid]::NewGuid().ToString()
$caseId = 'normal-control'
if ($Mode -ceq 'recover') {
  $caseId = 'recovery'
}
$hasSelection = -not [string]::IsNullOrEmpty($SelectionFile)
if ($hasSelection -and $Mode -cne 'normal') {
  throw 'Recovery cannot select an original-run hold.'
}
function Invoke-Control([scriptblock] $Operation, [object[]] $Arguments) {
  $job = Invoke-Command -Session $Session -ScriptBlock $Operation -ArgumentList $Arguments -AsJob
  try {
    $finished = Wait-Job $job -Timeout 30
    if ($null -eq $finished -or $job.State -ne 'Completed') { throw 'Guest control action failed or timed out.' }
    Receive-Job $job -ErrorAction Stop
  } finally {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
  }
}
try {
  foreach ($scriptName in @('host-observer.ps1', 'run-normal-control.ps1', 'host-control.test.ps1', 'host-selection.test.ps1', 'host-publication.test.ps1')) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $scriptName), [ref] $tokens, [ref] $errors) | Out-Null
    if ($errors.Count -ne 0) { throw 'PowerShell parser validation failed.' }
  }
  & (Join-Path $PSScriptRoot 'host-control.test.ps1') | Out-Null
  & (Join-Path $PSScriptRoot 'host-selection.test.ps1') | Out-Null
  Invoke-Control {
    param($Desktop, $Node, $Config, $Evidence, $Run, $Owner, $ExpectedMode, $ExpectedCase, $NeedsLongAck)
    $ErrorActionPreference = 'Stop'
    if ($null -ne $script:LdbCrashProcess) { throw 'This session already owns a crash fixture process.' }
    foreach ($path in @($Desktop, $Node, $Config, $Evidence)) {
      if ($path -notmatch '^[A-Za-z]:\\' -or [IO.Path]::GetFullPath($path) -cne $path) { throw 'Expected canonical local absolute path.' }
    }
    $settings = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
    if ($settings.runId -cne $Run -or $settings.caseId -cne $ExpectedCase -or $settings.mode -cne $ExpectedMode -or $settings.evidence -cne $Evidence) { throw 'Fixture control settings mismatch.' }
    if ($NeedsLongAck -and $settings.ackTimeoutMs -ne 900000) { throw 'Selected hold requires the explicit 900000 ms guest ACK timeout.' }
    $stdout = $Evidence + '.stdout.log'
    $stderr = $Evidence + '.stderr.log'
    if ((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr)) { throw 'Process output must be new.' }
    $previousConfig = $env:LDB_CRASH_CONFIG
    $previousOwner = $env:LDB_CRASH_OWNER
    try {
      $env:LDB_CRASH_CONFIG = $Config
      $env:LDB_CRASH_OWNER = $Owner
      # One native test in a worker thread, so process termination has no forked Vitest workers.
      $script:LdbCrashOwner = $Owner
      $script:LdbCrashRun = $Run
      $script:LdbCrashProcess = Start-Process -FilePath $Node -WorkingDirectory $Desktop -ArgumentList @('node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/windows-crash-fixture/vitest.config.ts', '--pool=threads', '--maxWorkers=1') -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
      # Windows PowerShell 5.1 redirect startup needs its process handle cached for later ExitCode.
      # The Process owns this handle until Dispose; acquisition failure remains a failed run.
      $null = $script:LdbCrashProcess.get_Handle()
    } finally { $env:LDB_CRASH_CONFIG = $previousConfig; $env:LDB_CRASH_OWNER = $previousOwner }
    return @{ started = $true; pid = $script:LdbCrashProcess.Id }
  } @($GuestDesktop, $GuestNode, $GuestConfig, $GuestEvidence, $RunId, $invocationOwner, $Mode, $caseId, $hasSelection) | Out-Null
  & (Join-Path $PSScriptRoot 'host-observer.ps1') -Session $Session -GuestEvidence $GuestEvidence -HostEvidence $HostEvidence -RunId $RunId -CaseId $caseId -InvocationOwner $invocationOwner -DeadlineSeconds 900 -SelectionFile $SelectionFile -HoldSeconds $HoldSeconds -DemonstrateHoldMilliseconds $DemonstrateHoldMilliseconds | Out-Null

  $terminal = Invoke-Control {
    param($Run, $Evidence, $Owner, $ExpectedCase, $ExpectedMode)
    $process = $script:LdbCrashProcess
    if ($null -eq $process -or $script:LdbCrashRun -cne $Run -or $script:LdbCrashOwner -cne $Owner) { throw 'Guest process ownership mismatch.' }
    if (-not $process.WaitForExit(20000)) { throw 'Guest process did not terminate after terminal ACK.' }
    $result = Get-Content -LiteralPath (Join-Path $Evidence 'result.json') -Raw | ConvertFrom-Json
    $failed = Test-Path -LiteralPath (Join-Path $Evidence 'failure.json')
    $exitCode = $process.ExitCode
    $isNormal = $ExpectedMode -ceq 'normal' -and $result.status -ceq 'passed'
    $isRecovery = $ExpectedMode -ceq 'recover' -and @('observed-consistent', 'findings') -ccontains $result.status
    $isExpectedResult = $isNormal -or $isRecovery
    if ($exitCode -isnot [int] -or $exitCode -ne 0 -or $failed -or -not $isExpectedResult -or $result.runId -cne $Run -or $result.caseId -cne $ExpectedCase) { throw 'Guest fixture result is not confirmed.' }
    return @{ exitCode = $exitCode; result = $result.status; processExited = $true; verdict = $result.verdict }

  } @($RunId, $GuestEvidence, $invocationOwner, $caseId, $Mode)
  if ($hasSelection) {
    $terminal.result = 'hold-demonstrated'
  }
  $terminal | ConvertTo-Json -Depth 30 -Compress
} catch {
  throw 'Windows fixture control failed; preserve all guest and host artifacts.'
} finally {
  # Also covers a Start-Process response lost after the process was created.
  Invoke-Control {
    param($Run, $Owner)
    if ($script:LdbCrashOwner -cne $Owner) { return }
    $process = $script:LdbCrashProcess
    if ($null -eq $process) { return }
    if ($script:LdbCrashRun -cne $Run) { throw 'Refusing to stop a different run.' }
    if (-not $process.HasExited) {
      $process.Kill()
      if (-not $process.WaitForExit(20000)) { throw 'Owned guest process termination is unconfirmed.' }
    }
    $process.Dispose()
    $script:LdbCrashProcess = $null
    $script:LdbCrashRun = $null
    $script:LdbCrashOwner = $null
  } @($RunId, $invocationOwner)
}
