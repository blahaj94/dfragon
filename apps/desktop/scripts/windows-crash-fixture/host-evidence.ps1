# Offline evidence only. Dot-sourcing defines readers; it does not manage a run.
function Assert-EvidenceDirectory([string] $Path) {
  $isAbsolute = $Path -match '^[A-Za-z]:\\'
  $isCanonical = [IO.Path]::GetFullPath($Path) -ceq $Path
  if (-not $isAbsolute -or -not $isCanonical) {
    throw 'Evidence directory must be a canonical local path.'
  }
  $current = $Path
  while (-not [string]::IsNullOrEmpty($current)) {
    $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
    $isDirectory = $item.PSIsContainer -eq $true
    $isReparse = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
    if (-not $isDirectory -or $isReparse) {
      throw 'Evidence directory or ancestor is not plain.'
    }
    $current = [IO.Path]::GetDirectoryName($current)
  }
}
function Read-EvidenceBytes([string] $Path) {
  Assert-EvidenceDirectory ([IO.Path]::GetDirectoryName($Path))
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  $isDirectory = $item.PSIsContainer -eq $true
  $isReparse = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  $isBounded = $item.Length -le 16777216
  if ($isDirectory -or $isReparse -or -not $isBounded) {
    throw 'Evidence is not a bounded plain file.'
  }
  return ,([IO.File]::ReadAllBytes($Path))
}
function Get-EvidenceInventory([string] $Directory) {
  Assert-EvidenceDirectory $Directory
  foreach ($item in Get-ChildItem -LiteralPath $Directory -Force -ErrorAction Stop) {
    $isReparse = ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
    if ($isReparse) {
      throw 'Evidence inventory contains a reparse point.'
    }
    if ($item.PSIsContainer) {
      Get-EvidenceInventory $item.FullName
    } else {
      $bytes = Read-EvidenceBytes $item.FullName
      $sha = [Security.Cryptography.SHA256]::Create()
      try {
        $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '')
      } finally {
        $sha.Dispose()
      }
      [pscustomobject]@{Path=$item.FullName;SHA256=$hash;Bytes=$bytes}
    }
  }
}
function Get-CrashEvidenceReport {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string] $HostEvidence,
    [Parameter(Mandatory)][string] $CollectionDirectory,
    [Parameter(Mandatory)][string] $SnapshotFile,
    [Parameter(Mandatory)][string] $SnapshotSHA256,
    [Parameter(Mandatory)][string] $HeldSHA256,
    [Parameter(Mandatory)] $Expected
  )
  $ErrorActionPreference = 'Stop'
  $hostFiles = @(Get-EvidenceInventory $HostEvidence)
  $collected = @(Get-EvidenceInventory $CollectionDirectory)
  $snapshotBytes = Read-EvidenceBytes $SnapshotFile
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $snapshotHash = [BitConverter]::ToString($sha.ComputeHash($snapshotBytes)).Replace('-', '')
  } finally {
    $sha.Dispose()
  }
  $isSnapshotHash = $snapshotHash -ieq $SnapshotSHA256
  if (-not $isSnapshotHash) {
    throw 'Collection snapshot hash mismatch.'
  }
  $snapshot = [Text.Encoding]::UTF8.GetString($snapshotBytes) | ConvertFrom-Json
  $isInventoryComplete = $snapshot.Files.Count -eq $collected.Count
  $hasManifest = $snapshot.ManifestExists -eq $true
  if (-not $isInventoryComplete -or -not $hasManifest) {
    throw 'Collection inventory or manifest is incomplete.'
  }
  $files = @{}
  foreach ($file in $collected) {
    $relative = $file.Path.Substring($CollectionDirectory.Length + 1)
    $files[$relative] = $file
  }
  $seen = @{}
  foreach ($record in $snapshot.Files) {
    $relative = [string] $record.RelativePath
    $isListed = $files.ContainsKey($relative)
    $isDuplicate = $seen.ContainsKey($relative)
    if (-not $isListed -or $isDuplicate) {
      throw 'Collection snapshot path is missing, duplicate or outside the inventory.'
    }
    $isSameHash = $files[$relative].SHA256 -ieq $record.SHA256
    if (-not $isSameHash) {
      throw 'Collected bytes differ from the snapshot.'
    }
    $seen[$relative] = $true
  }
  $guestPrefix = [string] $Expected.GuestEvidenceRelativePath + '\'
  $expectedDirectory = 'native-lab\' + $Expected.RootName + '-' + $Expected.RunId + '-evidence\'
  $isGuestPath = $guestPrefix -ceq $expectedDirectory
  $isRootName = $Expected.RootName -cmatch '^ldb-crash-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  $isRunName = $Expected.RunId -cmatch '^[a-z0-9-]{1,80}$'
  $hasOwner = -not [string]::IsNullOrWhiteSpace($Expected.InvocationOwner)
  if (-not $isGuestPath -or -not $isRootName -or -not $isRunName -or -not $hasOwner) {
    throw 'Expected original evidence identity or path is invalid.'
  }
  $manifestPath = $guestPrefix + 'manifest.json'
  if (-not $files.ContainsKey($manifestPath)) {
    throw 'Original guest manifest is missing.'
  }
  $manifest = [Text.Encoding]::UTF8.GetString($files[$manifestPath].Bytes) | ConvertFrom-Json
  $heldPath = Join-Path $HostEvidence 'held.json'
  $heldFile = @($hostFiles | Where-Object Path -CEQ $heldPath)
  $isHeldPresent = $heldFile.Count -eq 1
  if (-not $isHeldPresent) {
    throw 'Original host hold is missing.'
  }
  $isHeldHash = $heldFile[0].SHA256 -ieq $HeldSHA256
  if (-not $isHeldHash) {
    throw 'Original host hold hash mismatch.'
  }
  $held = [Text.Encoding]::UTF8.GetString($heldFile[0].Bytes) | ConvertFrom-Json
  $isKind = $held.kind -ceq 'ldb-synthetic-windows-hold-v1'
  $isOwner = $held.invocationOwner -ceq $Expected.InvocationOwner
  $isCase = $Expected.CaseId -ceq 'normal-control'
  $isSequenceNumber = $Expected.Sequence -is [int] -or $Expected.Sequence -is [long]
  $isSequence = $isSequenceNumber -and $Expected.Sequence -ge 1 -and $Expected.Sequence -le 10000
  $hasPrefix = $held.rawRecords.Count -eq $Expected.Sequence -and $held.observations.Count -eq $Expected.Sequence
  if (-not $isKind -or -not $isOwner -or -not $isCase -or -not $isSequence -or -not $hasPrefix) {
    throw 'Host hold identity or contiguous prefix is invalid.'
  }
  $adapters = @('create-directory', 'create-exclusive', 'write', 'flush', 'rename', 'remove', 'sync-directory', 'close')
  $isAdapter = @($adapters | ForEach-Object {'adapter.' + $_}) -ccontains $Expected.Cutpoint
  $isBefore = $Expected.Phase -ceq 'before' -and $Expected.Outcome -ceq 'not-called'
  $isAfter = $Expected.Phase -ceq 'after' -and @('returned', 'threw') -ccontains $Expected.Outcome
  if (-not $isAdapter -or (-not $isBefore -and -not $isAfter)) {
    throw 'Unsupported selected adapter boundary.'
  }
  $hostRecords = @{}
  foreach ($file in $hostFiles) {
    $isDirectChild = [IO.Path]::GetDirectoryName($file.Path) -ceq $HostEvidence
    if (-not $isDirectChild) {
      throw 'Host evidence contains an unexpected nested artifact.'
    }
    $hostRecords[[IO.Path]::GetFileName($file.Path)] = $file
  }
  $releaseNames = @('released.json', 'release.request.json', 'released.json.pending', 'release.request.json.pending', 'held.json.pending')
  foreach ($name in $releaseNames) {
    if ($hostRecords.ContainsKey($name)) {
      throw 'Original hold has release evidence.'
    }
  }
  $identityFields = @('runId', 'caseId', 'sequence', 'cutpoint', 'phase', 'outcome')
  foreach ($field in $identityFields) {
    if ($held.selection.$field -cne $Expected.$field) {
      throw 'Selected boundary differs from the expected identity.'
    }
  }
  $observations = @()
  for ($index = 0; $index -lt $Expected.Sequence; $index++) {
    $sequence = $index + 1
    $name = '{0:D6}' -f $sequence
    $recordName = $name + '.record.json'
    if (-not $hostRecords.ContainsKey($recordName)) {
      throw 'Host record prefix is incomplete.'
    }
    $raw = [Convert]::ToBase64String($hostRecords[$recordName].Bytes)
    if ($raw -cne $held.rawRecords[$index]) {
      throw 'Host raw record differs from the sealed hold.'
    }
    $event = [Text.Encoding]::UTF8.GetString($hostRecords[$recordName].Bytes) | ConvertFrom-Json
    $eventJson = $event | ConvertTo-Json -Depth 30 -Compress
    $heldJson = $held.observations[$index] | ConvertTo-Json -Depth 30 -Compress
    $isSameObservation = $eventJson -ceq $heldJson
    $isEventIdentity = $event.runId -ceq $Expected.RunId -and $event.caseId -ceq $Expected.CaseId -and $event.sequence -eq $sequence
    if (-not $isSameObservation -or -not $isEventIdentity) {
      throw 'Host observation bytes or sequence identity conflict.'
    }
    $isSelected = $sequence -eq $Expected.Sequence
    $ackName = $name + '.ack-delivered.json'
    if ($isSelected -and $hostRecords.ContainsKey($ackName)) {
      throw 'Selected host ACK was delivered.'
    }
    if (-not $isSelected) {
      if (-not $hostRecords.ContainsKey($ackName)) {
        throw 'Prior host ACK delivery is missing.'
      }
      $ack = [Text.Encoding]::UTF8.GetString($hostRecords[$ackName].Bytes) | ConvertFrom-Json
      foreach ($field in $identityFields) {
        if ($ack.$field -cne $event.$field) {
          throw 'Host ACK identity conflicts with its request.'
        }
      }
    }
    foreach ($suffix in @('.request.json', '.request.json.pending', '.ack.json', '.ack.pending')) {
      $path = $guestPrefix + $name + $suffix
      $present = $files.ContainsKey($path)
      $isAck = $suffix.StartsWith('.ack')
      if ($present) {
        if ($isSelected -and $isAck) {
          throw 'Selected guest ACK exists.'
        }
        $expectedBytes = $hostRecords[$recordName].Bytes
        if ($isAck) {
          $expectedBytes = $hostRecords[$ackName].Bytes
        }
        $actual = [Convert]::ToBase64String($files[$path].Bytes)
        if ($actual -cne [Convert]::ToBase64String($expectedBytes)) {
          throw 'Guest protocol bytes conflict with the host record.'
        }
      }
      $isPending = $suffix.EndsWith('pending')
      $isFinding = ($present -and $isPending) -or (-not $present -and -not $isPending -and -not ($isSelected -and $isAck))
      $observations += [pscustomobject]@{Sequence=$sequence;Artifact=($name + $suffix);Present=$present;NamespaceFinding=$isFinding}
    }
  }
  $last = $held.observations[-1]
  foreach ($field in $identityFields) {
    if ($last.$field -cne $held.selection.$field) {
      throw 'Host prefix does not end at the selected boundary.'
    }
  }
  $first = $held.observations[0]
  $isManifestEvent = $first.cutpoint -ceq 'run-manifest' -and $first.phase -ceq 'initial' -and $first.outcome -ceq 'recorded'
  $isManifestKind = $manifest.kind -ceq 'ldb-synthetic-windows-crash-v1' -and $manifest.mode -ceq 'normal'
  $isHostManifestKind = $first.detail.kind -ceq $manifest.kind -and $first.detail.mode -ceq $manifest.mode
  if (-not $isManifestEvent -or -not $isManifestKind -or -not $isHostManifestKind) {
    throw 'Original manifest event is invalid.'
  }
  foreach ($field in @('runId', 'caseId', 'rootName', 'invocationOwner')) {
    $isManifestIdentity = $manifest.$field -ceq $Expected.$field -and $first.detail.$field -ceq $manifest.$field
    if (-not $isManifestIdentity) {
      throw 'Original guest and host manifest identity conflict.'
    }
  }
  $protocolPaths = @($hostRecords.Keys) + @($files.Keys | Where-Object {$_.StartsWith($guestPrefix, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object {$_.Substring($guestPrefix.Length)})
  foreach ($name in $protocolPaths) {
    $isNested = $name.Contains('\') -or $name.Contains('/')
    if ($isNested) {
      throw 'Guest evidence contains an unexpected nested artifact.'
    }
    if ($name -match '^(\d{6})\.(record|request|ack)\.') {
      $isOutsidePrefix = [int] $Matches[1] -lt 1 -or [int] $Matches[1] -gt $Expected.Sequence
      $isSelectedAck = [int] $Matches[1] -eq $Expected.Sequence -and $Matches[2] -ceq 'ack'
      $isHostPending = $hostRecords.ContainsKey($name) -and $name.EndsWith('.pending')
      if ($isOutsidePrefix -or $isHostPending -or $isSelectedAck) {
        throw 'Unexpected future or incomplete host protocol artifact.'
      }
    }
  }
  $findings = @($observations | Where-Object NamespaceFinding -EQ $true)
  $status = 'evidence-consistent'
  if ($findings.Count -gt 0) {
    $status = 'namespace-findings'
  }
  return [pscustomobject]@{Status=$status;HostHistoryVerified=$true;GuestNamespace=$observations;RecoveryEligibility='not-evaluated';NamespaceDurability='unverified';OriginalRunReclassified=$false}
}
