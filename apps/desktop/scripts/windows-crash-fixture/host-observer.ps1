# Existing authorized session only; no VM/session/credential management.
[CmdletBinding()]
param(
  [Parameter(Mandatory)][System.Management.Automation.Runspaces.PSSession] $Session,
  [Parameter(Mandatory)][string] $GuestEvidence,
  [Parameter(Mandatory)][string] $HostEvidence,
  [Parameter(Mandatory)][string] $RunId,
  [Parameter(Mandatory)][string] $CaseId,
  [ValidateRange(1, 900)][int] $DeadlineSeconds = 900
)
$ErrorActionPreference = 'Stop'
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
  param($Evidence, $Action, $Name, $Bytes)
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
  $job = Invoke-Command -Session $Session -ScriptBlock $remote -ArgumentList $GuestEvidence, $Action, $Name, $Bytes -AsJob
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
    if ($event.runId -cne $RunId -or $event.caseId -cne $CaseId -or $event.sequence -ne $sequence) { throw 'Observation identity mismatch.' }
    if ($event.cutpoint -isnot [string] -or $event.phase -isnot [string] -or $event.outcome -isnot [string]) { throw 'Observation shape mismatch.' }
    $ack = [ordered]@{ runId = $event.runId; caseId = $event.caseId; sequence = $event.sequence; cutpoint = $event.cutpoint; phase = $event.phase; outcome = $event.outcome }
    $ackBytes = [Text.Encoding]::UTF8.GetBytes(($ack | ConvertTo-Json -Compress))
    # This action rechecks the deadline immediately before dispatching the ACK.
    $delivery = Invoke-ObserverAction 'ack' $name $ackBytes
    if ($delivery.status -cne 'ack-delivered') { throw 'ACK delivery is unconfirmed.' }
    if ($event.cutpoint -ceq 'run' -and $event.phase -ceq 'terminal') {
      # Runner must separately verify guest exit, result.json and failure.json absence.
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
