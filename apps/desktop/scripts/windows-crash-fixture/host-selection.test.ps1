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
