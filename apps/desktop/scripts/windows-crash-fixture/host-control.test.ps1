# No session, VM, real process or file mutation: execute the actual cleanup AST against stubs.
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$source = Join-Path $PSScriptRoot 'run-normal-control.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref] $tokens, [ref] $errors)
if ($errors.Count -ne 0) { throw 'Control script parser validation failed.' }
$actions = @($ast.FindAll({
  param($node)
  $node -is [System.Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Invoke-Control'
}, $true))
if ($actions.Count -ne 3) { throw 'Update ownership regression for changed control boundaries.' }
$start = $actions[0].CommandElements[1].ScriptBlock.GetScriptBlock()
$cleanup = $actions[2].CommandElements[1].ScriptBlock.GetScriptBlock()
function New-ProcessStub {
  $process = [pscustomobject]@{ HasExited = $false; kills = 0; waits = 0; disposals = 0 }
  $process | Add-Member ScriptMethod Kill { $this.kills += 1; $this.HasExited = $true }
  $process | Add-Member ScriptMethod WaitForExit { param($timeout); $this.waits += 1; return $this.HasExited }
  $process | Add-Member ScriptMethod Dispose { $this.disposals += 1 }
  return $process
}
$script:DfragonCrashRun = 'same-run'
$script:DfragonCrashOwner = 'previous-invocation'
$script:DfragonCrashProcess = New-ProcessStub
$previous = $script:DfragonCrashProcess
$rejected = $false
try { & $start '' '' '' '' 'same-run' 'new-invocation' } catch { $rejected = $_.Exception.Message -eq 'This session already owns a crash fixture process.' }
if (-not $rejected) { throw 'Existing run was not rejected before startup.' }
& $cleanup 'same-run' 'new-invocation'
if ($previous.kills -ne 0 -or $previous.disposals -ne 0 -or $script:DfragonCrashProcess -ne $previous) { throw 'Rejected rerun modified the preceding process.' }

$script:DfragonCrashRun = 'foreign-run'
$script:DfragonCrashOwner = 'current-invocation'
$rejected = $false
try { & $cleanup 'same-run' 'current-invocation' } catch { $rejected = $_.Exception.Message -eq 'Refusing to stop a different run.' }
if (-not $rejected -or $previous.kills -ne 0) { throw 'Foreign run was not preserved.' }

$script:DfragonCrashRun = 'same-run'
$script:DfragonCrashOwner = 'current-invocation'
& $cleanup 'same-run' 'current-invocation'
if ($previous.kills -ne 1 -or $previous.waits -ne 1 -or $previous.disposals -ne 1 -or $null -ne $script:DfragonCrashProcess) { throw 'Owned live process was not terminated and released exactly once.' }

$script:DfragonCrashRun = 'same-run'
$script:DfragonCrashOwner = 'current-invocation'
$script:DfragonCrashProcess = New-ProcessStub
$script:DfragonCrashProcess.HasExited = $true
$exited = $script:DfragonCrashProcess
& $cleanup 'same-run' 'current-invocation'
if ($exited.kills -ne 0 -or $exited.disposals -ne 1) { throw 'Exited process was killed or not released.' }
'4 process ownership regressions passed'

$hostAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'host-observer.ps1'), [ref] $tokens, [ref] $errors)
if ($errors.Count -ne 0) { throw 'Host observer parser validation failed.' }
$remoteBlocks = @($hostAst.FindAll({
  param($node)
  $node -is [System.Management.Automation.Language.ScriptBlockExpressionAst] -and $null -ne $node.ScriptBlock.ParamBlock -and $node.ScriptBlock.ParamBlock.Parameters.Count -ge 4 -and $node.ScriptBlock.ParamBlock.Parameters[0].Name.VariablePath.UserPath -eq 'Evidence'
}, $true))
if ($remoteBlocks.Count -ne 1) { throw 'Update early-exit regression for changed observer boundaries.' }
$observe = $remoteBlocks[0].ScriptBlock.GetScriptBlock()
$script:DfragonCrashRun = 'same-run'
$script:DfragonCrashOwner = 'current-invocation'
$script:DfragonCrashProcess = New-ProcessStub
$script:DfragonCrashProcess.HasExited = $true
$exited = $script:DfragonCrashProcess
$rejected = $false
try { & $observe '' 'read' '000001' @() 'same-run' 'current-invocation' } catch { $rejected = $_.Exception.Message -eq 'Guest fixture process exited before terminal ACK.' }
if (-not $rejected -or $exited.kills -ne 0 -or $exited.disposals -ne 0) { throw 'Exited guest was not rejected before request polling or was modified.' }
$rejected = $false
try { & $observe '' 'read' '000001' @() 'same-run' 'other-invocation' } catch { $rejected = $_.Exception.Message -eq 'Guest observer process ownership mismatch.' }
if (-not $rejected -or $exited.kills -ne 0) { throw 'Observer accepted an unrelated invocation.' }
$script:DfragonCrashProcess = $null
$script:DfragonCrashRun = $null
$script:DfragonCrashOwner = $null
'2 observer process regressions passed'

# The real terminal action must reject null/string/nonzero exits even with a passed result.
$terminalAction = $actions[1].CommandElements[1].ScriptBlock.GetScriptBlock()
function Get-Content { param($LiteralPath, [switch] $Raw); return $script:terminalResult }
function Test-Path { param($LiteralPath); return $false }
foreach ($code in @($null, '0', 7, 0)) {
  $script:DfragonCrashRun = 'same-run'
  $script:DfragonCrashOwner = 'current-invocation'
  $script:DfragonCrashProcess = New-ProcessStub
  $script:DfragonCrashProcess.HasExited = $true
  $script:DfragonCrashProcess | Add-Member NoteProperty ExitCode $code
  $script:terminalResult = '{"runId":"same-run","caseId":"normal-control","status":"passed"}'
  $accepted = $false
  try {
    $result = & $terminalAction 'same-run' 'C:\evidence' 'current-invocation' 'normal-control' 'normal'
    $accepted = $result.exitCode -is [int] -and $result.exitCode -eq 0
  } catch { }
  $expected = $code -is [int] -and $code -eq 0
  if ($accepted -ne $expected) { throw 'Terminal action misclassified numeric process exit evidence.' }
}
$script:terminalResult = '{"runId":"same-run","caseId":"recovery","status":"observed-consistent","verdict":{"namespaceDurability":"unverified"}}'
$result = & $terminalAction 'same-run' 'C:\evidence' 'current-invocation' 'recovery' 'recover'
if ($result.result -cne 'observed-consistent') { throw 'Recovery result was not retained separately.' }
$script:DfragonCrashProcess = $null
$script:DfragonCrashRun = $null
$script:DfragonCrashOwner = $null
'5 terminal result regressions passed'
