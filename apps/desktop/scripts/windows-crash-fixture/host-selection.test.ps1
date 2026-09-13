# Pure AST-selected validation functions only; no session/process/VM/file mutation.
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'host-observer.ps1'), [ref] $tokens, [ref] $errors)
if ($errors.Count -ne 0) { throw 'Observer parser failed.' }
$functions = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-HoldSelection' }, $true))
if ($functions.Count -ne 1) { throw 'Selected hold validation is not implemented.' }
$select = $functions[0].Body.GetScriptBlock()
$event = [pscustomobject]@{ runId = 'run'; caseId = 'normal-control'; sequence = 12; cutpoint = 'adapter.rename'; phase = 'after'; outcome = 'returned' }
$selection = [pscustomobject]@{ runId = 'run'; caseId = 'normal-control'; sequence = 12; cutpoint = 'adapter.rename'; phase = 'after' }
if (-not (& $select $event $selection)) { throw 'Exact selected event was not reached.' }
$earlier = [pscustomobject]@{ runId = 'run'; caseId = 'normal-control'; sequence = 11; cutpoint = 'adapter.rename'; phase = 'after'; outcome = 'returned' }
if (& $select $earlier $selection) { throw 'Earlier event was selected.' }
foreach ($field in @('runId', 'caseId', 'cutpoint', 'phase')) {
  $wrong = [pscustomobject]@{ runId = 'run'; caseId = 'normal-control'; sequence = 12; cutpoint = 'adapter.rename'; phase = 'after'; outcome = 'returned' }
  $wrong.$field = 'wrong'
  $rejected = $false
  try { & $select $wrong $selection | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Selected identity mismatch was not rejected.' }
}
foreach ($cutpoint in @('FileDispositionInfo-to-CloseHandle', 'store.removeTransition', 'adapter.unsupported')) {
  $unsupported = [pscustomobject]@{ runId = 'run'; caseId = 'normal-control'; sequence = 12; cutpoint = $cutpoint; phase = 'after' }
  $rejected = $false
  try { & $select $event $unsupported | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Unsupported boundary was selected.' }
}
'9 selected hold identity regressions passed'

$holdFunctions = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-SelectedRelease' }, $true))
if ($holdFunctions.Count -ne 1) { throw 'Host hold/release is not implemented.' }
$waitForRelease = $holdFunctions[0].Body.GetScriptBlock()
$script:actions = [Collections.Generic.List[string]]::new()
$script:heldValue = $null
function Write-HostArtifact {
  param($Name, $Value)
  $script:actions.Add($Name)
  if ($Name -ceq 'held.json') { $script:heldValue = $Value }
}
function Start-Sleep { param($Milliseconds); $script:actions.Add('withheld-ack') }
$InvocationOwner = 'synthetic-owner'
$RunId = 'run'
$CaseId = 'normal-control'
$HoldSeconds = 600
$DemonstrateHoldMilliseconds = 1000
& $waitForRelease $event @($event) @('raw-request-bytes')
if (($script:actions -join ',') -cne 'held.json,withheld-ack,released.json') { throw 'Host evidence was not persisted before withholding and releasing ACK.' }
if ($script:heldValue.invocationOwner -cne $InvocationOwner -or $script:heldValue.selection.sequence -ne 12 -or $script:heldValue.rawRecords[0] -cne 'raw-request-bytes') { throw 'Host hold lost its owner/selection/raw request provenance.' }
'1 host hold persistence/release regression passed'
