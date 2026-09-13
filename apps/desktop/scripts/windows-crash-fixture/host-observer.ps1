# Existing authorized session only; no VM/session/credential management.
[CmdletBinding()]
param(
  [Parameter(Mandatory)][System.Management.Automation.Runspaces.PSSession] $Session,
  [Parameter(Mandatory)][string] $GuestEvidence,
  [Parameter(Mandatory)][string] $HostEvidence,
  [Parameter(Mandatory)][string] $RunId,
  [Parameter(Mandatory)][string] $CaseId,
  [string] $InvocationOwner,
  [string] $SelectionFile,
  [ValidateRange(1, 600)][int] $HoldSeconds = 600,
  [ValidateRange(0, 5000)][int] $DemonstrateHoldMilliseconds = 0,
  [ValidateRange(1, 900)][int] $DeadlineSeconds = 900
)
$ErrorActionPreference = 'Stop'
function Test-HoldSelection {
  param($Event, $Selection)
  $supported = @('adapter.create-directory', 'adapter.create-exclusive', 'adapter.write', 'adapter.flush', 'adapter.rename', 'adapter.remove', 'adapter.sync-directory', 'adapter.close')
  $isSupported = $supported -ccontains $Selection.cutpoint
  $isPhase = $Selection.phase -ceq 'before' -or $Selection.phase -ceq 'after'
  $isSequence = ($Selection.sequence -is [int] -or $Selection.sequence -is [long]) -and $Selection.sequence -ge 1 -and $Selection.sequence -le 999999
  if (-not $isSupported -or -not $isPhase -or -not $isSequence) {
    throw 'Unsupported selected adapter boundary.'
  }
  $isSameRun = $Event.runId -ceq $Selection.runId
  $isSameCase = $Event.caseId -ceq $Selection.caseId
  if (-not $isSameRun -or -not $isSameCase) {
    throw 'Selected run identity mismatch.'
  }
  if ($Event.sequence -lt $Selection.sequence) {
    return $false
  }
  $isSameSequence = $Event.sequence -eq $Selection.sequence
  $isSameCutpoint = $Event.cutpoint -ceq $Selection.cutpoint
  $isSamePhase = $Event.phase -ceq $Selection.phase
  if (-not $isSameSequence -or -not $isSameCutpoint -or -not $isSamePhase) {
    throw 'Selected boundary was not reached exactly.'
  }
  return $true
}
function Write-HostArtifact {
  param([string] $Name, $Value)
  Assert-PlainDirectory $HostEvidence
  $bytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 30 -Compress))
  $final = Join-Path $HostEvidence $Name
  $pending = $final + '.pending'
  if ((Test-Path -LiteralPath $final) -or (Test-Path -LiteralPath $pending)) {
    throw 'Host artifact must be new.'
  }
  $stream = [IO.File]::Open($pending, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }
  [IO.File]::Move($pending, $final)
}
function Wait-SelectedRelease {
  param($Event, $Events, $RawRecords)
  $owner = $InvocationOwner
  if ([string]::IsNullOrEmpty($owner)) {
    $owner = 'standalone'
  }
  $hold = [ordered]@{ kind = 'ldb-synthetic-windows-hold-v1'; invocationOwner = $owner; selection = $Event; observations = @($Events); rawRecords = @($RawRecords) }
  # The request bytes have already been flushed; flush the complete host prefix before withholding ACK.
  Write-HostArtifact 'held.json' $hold
  $holdDeadline = [DateTime]::UtcNow.AddSeconds($HoldSeconds)
  if ($DemonstrateHoldMilliseconds -gt 0) {
    Start-Sleep -Milliseconds $DemonstrateHoldMilliseconds
    Write-HostArtifact 'released.json' @{ kind = 'demonstration'; runId = $RunId; caseId = $CaseId; sequence = $Event.sequence; invocationOwner = $owner }
    return
  }
  while ([DateTime]::UtcNow -lt $holdDeadline -and [DateTime]::UtcNow -lt $deadline) {
    $releasePath = Join-Path $HostEvidence 'release.request.json'
    if (Test-Path -LiteralPath $releasePath) {
      $info = Get-Item -LiteralPath $releasePath -Force
      $isPlain = -not $info.PSIsContainer -and -not ($info.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $info.Length -le 4096
      if (-not $isPlain) {
        throw 'Release request is not a bounded plain file.'
      }
      $release = Get-Content -LiteralPath $releasePath -Raw | ConvertFrom-Json
      $isIdentity = $release.runId -ceq $RunId -and $release.caseId -ceq $CaseId -and $release.sequence -eq $Event.sequence -and $release.invocationOwner -ceq $owner
      if (-not $isIdentity -or $release.action -cne 'resume') {
        throw 'Release identity or action mismatch.'
      }
      Write-HostArtifact 'released.json' $release
      return
    }
    Start-Sleep -Milliseconds 100
  }
  Write-HostArtifact 'hold-expired.json' @{ status = 'expired-not-success'; runId = $RunId; caseId = $CaseId; sequence = $Event.sequence }
  throw 'Selected hold expired without explicit release.'
}
function Assert-PlainDirectory([string] $Path) {
  if ($Path -notmatch '^[A-Za-z]:\\' -or [IO.Path]::GetFullPath($Path) -cne $Path) { throw 'Expected canonical local absolute directory.' }
  $current = $Path
  while ($current) {
    $item = Get-Item -LiteralPath $current -Force
    if ($item.PSProvider.Name -ne 'FileSystem' -or -not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Directory or ancestor is not plain.' }
    $current = [IO.Path]::GetDirectoryName($current)
  }
}
$remote = {
  param($Evidence, $Action, $Name, $Bytes, $ExpectedRun, $ExpectedOwner)
  if (-not [string]::IsNullOrEmpty($ExpectedOwner)) {
    $process = $script:LdbCrashProcess
    if ($null -eq $process -or $script:LdbCrashRun -cne $ExpectedRun -or $script:LdbCrashOwner -cne $ExpectedOwner) { throw 'Guest observer process ownership mismatch.' }
    if ($process.HasExited) { throw 'Guest fixture process exited before terminal ACK.' }
  }
  $ErrorActionPreference = 'Stop'
  if ($Evidence -notmatch '^[A-Za-z]:\\' -or [IO.Path]::GetFullPath($Evidence) -cne $Evidence -or $Name -notmatch '^\d{6}$') { throw 'Invalid evidence identity.' }
  $current = $Evidence
  while ($current) {
    $item = Get-Item -LiteralPath $current -Force
    if ($item.PSProvider.Name -ne 'FileSystem' -or -not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Guest evidence ancestor is not plain.' }
    $current = [IO.Path]::GetDirectoryName($current)
  }
  if (Test-Path -LiteralPath (Join-Path $Evidence 'failure.json')) { throw 'Guest fixture failed.' }
  if ($Action -ceq 'read') {
    $path = Join-Path $Evidence ($Name + '.request.json')
    if (-not (Test-Path -LiteralPath $path)) { return @{ status = 'missing' } }
    $item = Get-Item -LiteralPath $path -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -gt 2097152) { throw 'Request is not a bounded plain file.' }
    return @{ status = 'present'; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) }
  }
  if ($Action -cne 'ack') { throw 'Unsupported observer action.' }
  $pending = Join-Path $Evidence ($Name + '.ack.pending')
  $ack = Join-Path $Evidence ($Name + '.ack.json')
  if ((Test-Path -LiteralPath $pending) -or (Test-Path -LiteralPath $ack)) { throw 'Duplicate ACK artifact.' }
  $stream = [IO.File]::Open($pending, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($Bytes, 0, $Bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  [IO.File]::Move($pending, $ack)
  return @{ status = 'ack-delivered' }
}
$deadline = [DateTime]::UtcNow.AddSeconds($DeadlineSeconds)
function Invoke-ObserverAction([string] $Action, [string] $Name, [byte[]] $Bytes) {
  $remaining = [Math]::Floor(($deadline - [DateTime]::UtcNow).TotalSeconds)
  if ($remaining -lt 1) { throw 'Host observer deadline exceeded.' }
  $job = Invoke-Command -Session $Session -ScriptBlock $remote -ArgumentList $GuestEvidence, $Action, $Name, $Bytes, $RunId, $InvocationOwner -AsJob
  try {
    $finished = Wait-Job -Job $job -Timeout $remaining
    if ($null -eq $finished -or $job.State -ne 'Completed') { throw 'Remote observer action failed or timed out.' }
    if ([DateTime]::UtcNow -ge $deadline) { throw 'Host observer deadline exceeded.' }
    Receive-Job -Job $job -ErrorAction Stop
  } finally {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  }
}
$hostOwned = $false
try {
Assert-PlainDirectory ([IO.Path]::GetDirectoryName($HostEvidence))
if ($HostEvidence -notmatch '^[A-Za-z]:\\' -or [IO.Path]::GetFullPath($HostEvidence) -cne $HostEvidence) { throw 'Invalid host evidence path.' }
if (Test-Path -LiteralPath $HostEvidence) { throw 'Host evidence must be new.' }
New-Item -ItemType Directory -Path $HostEvidence | Out-Null
$hostOwned = $true
Assert-PlainDirectory $HostEvidence
$sequence = 1
$events = [Collections.Generic.List[object]]::new()
$rawRecords = [Collections.Generic.List[string]]::new()
$selection = $null
$selectedReached = $false
if (-not [string]::IsNullOrEmpty($SelectionFile)) {
  $selectionInfo = Get-Item -LiteralPath $SelectionFile -Force
  if ($selectionInfo.PSIsContainer -or ($selectionInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $selectionInfo.Length -gt 4096) {
    throw 'Selection must be a bounded plain file.'
  }
  $selection = Get-Content -LiteralPath $SelectionFile -Raw | ConvertFrom-Json
  if ($selection.runId -cne $RunId -or $selection.caseId -cne $CaseId) {
    throw 'Selection run identity mismatch.'
  }
}
  while ($true) {
    $name = '{0:D6}' -f $sequence
    $received = Invoke-ObserverAction 'read' $name @()
    if ($received.status -ceq 'missing') { Start-Sleep -Milliseconds 100; continue }
    $bytes = [Convert]::FromBase64String($received.content)
    $record = Join-Path $HostEvidence ($name + '.record.json')
    Assert-PlainDirectory $HostEvidence
    $stream = [IO.File]::Open($record, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    $event = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
    if ($event.sequence -isnot [int] -and $event.sequence -isnot [long]) { throw 'Observation sequence is not numeric.' }
    if ($event.runId -cne $RunId -or $event.caseId -cne $CaseId -or $event.sequence -ne $sequence) { throw 'Observation identity mismatch.' }
    if ($event.cutpoint -isnot [string] -or $event.phase -isnot [string] -or $event.outcome -isnot [string]) { throw 'Observation shape mismatch.' }
    $events.Add($event)
    $rawRecords.Add($received.content)
    if ($null -ne $selection -and -not $selectedReached) {
      $selectedReached = Test-HoldSelection $event $selection
      if ($selectedReached) {
        Wait-SelectedRelease $event ($events.ToArray()) ($rawRecords.ToArray())
      }
    }
    $isTerminal = $event.cutpoint -ceq 'run' -and $event.phase -ceq 'terminal'
    if ($isTerminal -and $null -ne $selection -and -not $selectedReached) {
      throw 'Run completed without reaching the selected boundary.'
    }
    $ack = [ordered]@{ runId = $event.runId; caseId = $event.caseId; sequence = $event.sequence; cutpoint = $event.cutpoint; phase = $event.phase; outcome = $event.outcome }
    $ackBytes = [Text.Encoding]::UTF8.GetBytes(($ack | ConvertTo-Json -Compress))
    # This action rechecks the deadline immediately before dispatching the ACK.
    $delivery = Invoke-ObserverAction 'ack' $name $ackBytes
    if ($delivery.status -cne 'ack-delivered') { throw 'ACK delivery is unconfirmed.' }
    Write-HostArtifact ($name + '.ack-delivered.json') $ack
    if ($event.cutpoint -ceq 'run' -and $event.phase -ceq 'terminal') {
      # Runner must separately verify guest exit, result.json and failure.json absence.
      if ($null -ne $selection -and -not $selectedReached) {
        throw 'Run completed without reaching the selected boundary.'
      }
      Write-HostArtifact 'terminal.json' @{ status = 'terminal-ack-delivered-only'; runId = $RunId; caseId = $CaseId; sequence = $sequence; selectedReached = $selectedReached }
      return 'terminal-ack-delivered-only'
    }
    $sequence += 1
  }
} catch {
  if ($hostOwned) {
    try {
      $failureBytes = [Text.Encoding]::UTF8.GetBytes('Observer failed; preserve guest and host artifacts.')
      $failureStream = [IO.File]::Open((Join-Path $HostEvidence 'observer-failure.txt'), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
      try { $failureStream.Write($failureBytes, 0, $failureBytes.Length); $failureStream.Flush($true) } finally { $failureStream.Dispose() }
    } catch { }
  }
  throw 'Host observer failed; evidence retained.'
}
