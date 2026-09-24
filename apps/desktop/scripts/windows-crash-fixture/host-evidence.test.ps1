# Synthetic files in a new directory only. Preserve every fixture, including failures.
$ErrorActionPreference = 'Stop'
$implementation = Join-Path $PSScriptRoot 'host-evidence.ps1'
$isImplemented = Test-Path -LiteralPath $implementation
if (-not $isImplemented) {
  throw 'Read-only host history and guest namespace verification is not implemented.'
}
. $implementation

$testRoot = Join-Path $env:TEMP ('dfragon-host-evidence-' + [guid]::NewGuid().ToString())
$null = New-Item -ItemType Directory -Path $testRoot
function Write-SyntheticJson($Path, $Value) {
  $text = $Value | ConvertTo-Json -Depth 20 -Compress
  [IO.File]::WriteAllText($Path, $text)
}
function New-EvidenceFixture([string] $Variant) {
  $directory = Join-Path $testRoot $Variant
  $hostDirectory = Join-Path $directory 'host'
  $collection = Join-Path $directory 'collection'
  $rootName = 'dfragon-crash-11111111-1111-4111-8111-111111111111'
  $relative = 'native-lab\' + $rootName + '-run-evidence'
  $guest = Join-Path $collection $relative
  if ($Variant -ceq 'case-variant-future-request') {
    $guest = Join-Path $collection ($relative.Replace('native-lab', 'Native-lab'))
  }
  $null = New-Item -ItemType Directory -Path $hostDirectory, $guest
  $manifest = @{kind='dfragon-synthetic-windows-crash-v1';runId='run';caseId='normal-control';mode='normal';rootName=$rootName;invocationOwner='owner'}
  $events = @(
    @{runId='run';caseId='normal-control';sequence=1;cutpoint='run-manifest';phase='initial';outcome='recorded';detail=$manifest},
    @{runId='run';caseId='normal-control';sequence=2;cutpoint='store.prepare';phase='protocol-start';outcome='called'},
    @{runId='run';caseId='normal-control';sequence=3;cutpoint='adapter.create-directory';phase='before';outcome='not-called'}
  )
  $raw = @()
  foreach ($event in $events) {
    $name = '{0:D6}' -f $event.sequence
    $record = Join-Path $hostDirectory ($name + '.record.json')
    $isHostGap = $Variant -ceq 'host-gap' -and $event.sequence -eq 2
    if (-not $isHostGap) {
      Write-SyntheticJson $record $event
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($event | ConvertTo-Json -Depth 20 -Compress))
    $raw += [Convert]::ToBase64String($bytes)
    $isMissing = $Variant -ceq 'guest-missing' -and $event.sequence -eq 1
    $isPendingOnly = $Variant -ceq 'pending-only' -and $event.sequence -eq 3
    if (-not $isMissing -and -not $isPendingOnly) {
      [IO.File]::WriteAllBytes((Join-Path $guest ($name + '.request.json')), $bytes)
    }
    $hasPending = $event.sequence -eq 3 -and $Variant -in @('pending-only', 'both-matching', 'pending-conflict')
    if ($hasPending) {
      [IO.File]::WriteAllBytes((Join-Path $guest ($name + '.request.json.pending')), $bytes)
    }
    $isPrior = $event.sequence -lt 3
    $isMissingAck = $Variant -ceq 'host-ack-missing' -and $event.sequence -eq 2
    if ($isPrior -and -not $isMissingAck) {
      Write-SyntheticJson (Join-Path $hostDirectory ($name + '.ack-delivered.json')) $event
    }
    if ($isPrior -and -not $isMissing) {
      Write-SyntheticJson (Join-Path $guest ($name + '.ack.json')) $event
    }
  }
  Write-SyntheticJson (Join-Path $guest 'manifest.json') $manifest
  $hold = @{kind='dfragon-synthetic-windows-hold-v1';invocationOwner='owner';selection=$events[2];observations=$events;rawRecords=$raw}
  if ($Variant -ceq 'host-observation-conflict') {
    $hold.observations[1].outcome = 'different'
  }
  Write-SyntheticJson (Join-Path $hostDirectory 'held.json') $hold
  Write-SyntheticJson (Join-Path $hostDirectory 'failure.json') @{Status='FAILED';GuestExit='unknown'}
  if ($Variant -ceq 'canonical') {
    Write-SyntheticJson (Join-Path $hostDirectory 'hold-expired.json') @{status='expired-not-success'}
  }
  if ($Variant -ceq 'host-expiry-pending') {
    Write-SyntheticJson (Join-Path $hostDirectory 'hold-expired.json.pending') @{status='expired-not-success'}
  }
  if ($Variant -ceq 'pending-conflict') {
    Write-SyntheticJson (Join-Path $guest '000003.request.json.pending') @{sequence=3}
  }
  if ($Variant -ceq 'canonical-conflict') {
    Write-SyntheticJson (Join-Path $guest '000003.request.json') @{sequence=3}
  }
  if ($Variant -ceq 'selected-ack') {
    Write-SyntheticJson (Join-Path $guest '000003.ack.json') $events[2]
  }
  if ($Variant -in @('future-request', 'case-variant-future-request')) {
    Write-SyntheticJson (Join-Path $guest '000004.request.json.pending') $events[2]
  }
  if ($Variant -ceq 'host-release') {
    Write-SyntheticJson (Join-Path $hostDirectory 'released.json') @{action='resume'}
  }
  if ($Variant -ceq 'manifest-conflict') {
    $manifest.rootName = 'another-root'
    Write-SyntheticJson (Join-Path $guest 'manifest.json') $manifest
  }
  $files = @(Get-ChildItem -LiteralPath $collection -Recurse -File | ForEach-Object {
    @{RelativePath=$_.FullName.Substring($collection.Length + 1);SHA256=(Get-FileHash -LiteralPath $_.FullName).Hash}
  })
  $snapshot = Join-Path $directory 'snapshot.json'
  if ($Variant -ceq 'snapshot-path-escape') {
    $files[0].RelativePath = '..\outside.json'
  }
  Write-SyntheticJson $snapshot @{Files=$files;ManifestExists=$true;RootExists=$false}
  $expected = @{RunId='run';CaseId='normal-control';RootName=$rootName;InvocationOwner='owner';Sequence=3;Cutpoint='adapter.create-directory';Phase='before';Outcome='not-called';GuestEvidenceRelativePath=$relative}
  if ($Variant -ceq 'owner-conflict') {
    $expected.InvocationOwner = 'another-owner'
  }
  if ($Variant -ceq 'snapshot-content-changed') {
    [IO.File]::WriteAllText((Join-Path $guest '000001.request.json'), 'changed after snapshot')
  }
  if ($Variant -ceq 'unlisted-file') {
    [IO.File]::WriteAllText((Join-Path $guest 'unlisted.json'), 'unlisted')
  }
  $heldHash = (Get-FileHash -LiteralPath (Join-Path $hostDirectory 'held.json')).Hash
  if ($Variant -ceq 'held-hash-conflict') {
    $heldHash = '0' * 64
  }
  return @{HostEvidence=$hostDirectory;CollectionDirectory=$collection;SnapshotFile=$snapshot;SnapshotSHA256=(Get-FileHash -LiteralPath $snapshot).Hash;HeldSHA256=$heldHash;Expected=$expected}
}
function Assert-Condition([bool] $Condition, [string] $Message) {
  if (-not $Condition) {
    throw $Message
  }
}
$positive = @('canonical', 'pending-only', 'guest-missing', 'both-matching')
foreach ($variant in $positive) {
  $fixture = New-EvidenceFixture $variant
  $before = @(Get-ChildItem -LiteralPath (Split-Path $fixture.HostEvidence) -Recurse -File | Get-FileHash | ForEach-Object Hash)
  $report = Get-CrashEvidenceReport @fixture
  Assert-Condition ($report.HostHistoryVerified -eq $true) 'Complete host history was not verified.'
  Assert-Condition ($report.RecoveryEligibility -ceq 'not-evaluated') 'Evidence verification granted operational recovery permission.'
  $status = 'evidence-consistent'
  if ($variant -cne 'canonical') {
    $status = 'namespace-findings'
  }
  Assert-Condition ($report.Status -ceq $status) 'Guest namespace finding was hidden or conflated with host history.'
  $after = @(Get-ChildItem -LiteralPath (Split-Path $fixture.HostEvidence) -Recurse -File | Get-FileHash | ForEach-Object Hash)
  Assert-Condition (($before -join ',') -ceq ($after -join ',')) 'Verifier changed collected files or original failure.'
}
$negative = @('host-gap', 'host-ack-missing', 'host-observation-conflict', 'owner-conflict', 'held-hash-conflict', 'canonical-conflict', 'pending-conflict', 'selected-ack', 'future-request', 'case-variant-future-request', 'host-release', 'host-expiry-pending', 'manifest-conflict', 'snapshot-content-changed', 'snapshot-path-escape', 'unlisted-file', 'unreadable-file', 'reparse-directory')
foreach ($variant in $negative) {
  $fixture = New-EvidenceFixture $variant
  $locked = $null
  if ($variant -ceq 'unreadable-file') {
    $path = Join-Path $fixture.HostEvidence '000001.record.json'
    $locked = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
  }
  if ($variant -ceq 'reparse-directory') {
    $link = Join-Path $fixture.CollectionDirectory 'linked'
    $target = Join-Path $fixture.CollectionDirectory $fixture.Expected.GuestEvidenceRelativePath
    $null = New-Item -ItemType Junction -Path $link -Target $target
  }
  $rejected = $false
  try {
    Get-CrashEvidenceReport @fixture | Out-Null
  } catch {
    $rejected = $true
  } finally {
    if ($null -ne $locked) {
      $locked.Dispose()
    }
  }
  Assert-Condition $rejected ('Evidence contradiction was accepted: ' + $variant)
}
'Host history and guest namespace regressions passed; synthetic evidence preserved.'
