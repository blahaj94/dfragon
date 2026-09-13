# Called from the pinned VM runner after its existing source/dependency/session preparation.
[CmdletBinding()]
param(
  [Parameter(Mandatory)][System.Management.Automation.Runspaces.PSSession] $Session,
  [Parameter(Mandatory)][string] $GuestDesktop,
  [Parameter(Mandatory)][string] $GuestNode,
  [Parameter(Mandatory)][string] $GuestConfig,
  [Parameter(Mandatory)][string] $GuestEvidence,
  [Parameter(Mandatory)][string] $HostEvidence,
  [Parameter(Mandatory)][string] $RunId
)
$ErrorActionPreference = 'Stop'
$invocationOwner = [guid]::NewGuid().ToString()
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
  foreach ($scriptName in @('host-observer.ps1', 'run-normal-control.ps1', 'host-control.test.ps1')) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $scriptName), [ref] $tokens, [ref] $errors) | Out-Null
    if ($errors.Count -ne 0) { throw 'PowerShell parser validation failed.' }
  }
  & (Join-Path $PSScriptRoot 'host-control.test.ps1') | Out-Null
  Invoke-Control {
    param($Desktop, $Node, $Config, $Evidence, $Run, $Owner)
    $ErrorActionPreference = 'Stop'
    if ($null -ne $script:LdbCrashProcess) { throw 'This session already owns a crash fixture process.' }
    foreach ($path in @($Desktop, $Node, $Config, $Evidence)) {
      if ($path -notmatch '^[A-Za-z]:\\' -or [IO.Path]::GetFullPath($path) -cne $path) { throw 'Expected canonical local absolute path.' }
    }
    $settings = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
    if ($settings.runId -cne $Run -or $settings.caseId -cne 'normal-control' -or $settings.mode -cne 'normal' -or $settings.evidence -cne $Evidence) { throw 'Normal control settings mismatch.' }
    $stdout = $Evidence + '.stdout.log'
    $stderr = $Evidence + '.stderr.log'
    if ((Test-Path -LiteralPath $stdout) -or (Test-Path -LiteralPath $stderr)) { throw 'Process output must be new.' }
    $previousConfig = $env:LDB_CRASH_CONFIG
    try {
      $env:LDB_CRASH_CONFIG = $Config
      # One native test in a worker thread, so process termination has no forked Vitest workers.
      $script:LdbCrashOwner = $Owner
      $script:LdbCrashRun = $Run
      $script:LdbCrashProcess = Start-Process -FilePath $Node -WorkingDirectory $Desktop -ArgumentList @('node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/windows-crash-fixture/vitest.config.ts', '--pool=threads', '--maxWorkers=1') -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
      # Windows PowerShell 5.1 redirect startup needs its process handle cached for later ExitCode.
      # The Process owns this handle until Dispose; acquisition failure remains a failed run.
      $null = $script:LdbCrashProcess.get_Handle()
    } finally { $env:LDB_CRASH_CONFIG = $previousConfig }
    return @{ started = $true; pid = $script:LdbCrashProcess.Id }
  } @($GuestDesktop, $GuestNode, $GuestConfig, $GuestEvidence, $RunId, $invocationOwner) | Out-Null
  & (Join-Path $PSScriptRoot 'host-observer.ps1') -Session $Session -GuestEvidence $GuestEvidence -HostEvidence $HostEvidence -RunId $RunId -CaseId 'normal-control' -InvocationOwner $invocationOwner -DeadlineSeconds 900 | Out-Null

  $terminal = Invoke-Control {
    param($Run, $Evidence, $Owner)
    $process = $script:LdbCrashProcess
    if ($null -eq $process -or $script:LdbCrashRun -cne $Run -or $script:LdbCrashOwner -cne $Owner) { throw 'Guest process ownership mismatch.' }
    if (-not $process.WaitForExit(20000)) { throw 'Guest process did not terminate after terminal ACK.' }
    $result = Get-Content -LiteralPath (Join-Path $Evidence 'result.json') -Raw | ConvertFrom-Json
    $failed = Test-Path -LiteralPath (Join-Path $Evidence 'failure.json')
    $exitCode = $process.ExitCode
    if ($exitCode -isnot [int] -or $exitCode -ne 0 -or $failed -or $result.status -cne 'passed' -or $result.runId -cne $Run -or $result.caseId -cne 'normal-control') { throw 'Guest normal control did not pass.' }
    return @{ exitCode = $exitCode; result = 'passed'; processExited = $true }
  } @($RunId, $GuestEvidence, $invocationOwner)
  $terminal | ConvertTo-Json -Compress
} catch {
  throw 'Windows normal control failed; preserve all guest and host artifacts.'
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
