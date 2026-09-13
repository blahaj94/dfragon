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
$script:LdbCrashRun = 'same-run'
$script:LdbCrashOwner = 'previous-invocation'
$script:LdbCrashProcess = New-ProcessStub
$previous = $script:LdbCrashProcess
$rejected = $false
try { & $start '' '' '' '' 'same-run' 'new-invocation' } catch { $rejected = $_.Exception.Message -eq 'This session already owns a crash fixture process.' }
if (-not $rejected) { throw 'Existing run was not rejected before startup.' }
& $cleanup 'same-run' 'new-invocation'
if ($previous.kills -ne 0 -or $previous.disposals -ne 0 -or $script:LdbCrashProcess -ne $previous) { throw 'Rejected rerun modified the preceding process.' }

$script:LdbCrashRun = 'foreign-run'
$script:LdbCrashOwner = 'current-invocation'
$rejected = $false
try { & $cleanup 'same-run' 'current-invocation' } catch { $rejected = $_.Exception.Message -eq 'Refusing to stop a different run.' }
if (-not $rejected -or $previous.kills -ne 0) { throw 'Foreign run was not preserved.' }

$script:LdbCrashRun = 'same-run'
$script:LdbCrashOwner = 'current-invocation'
& $cleanup 'same-run' 'current-invocation'
if ($previous.kills -ne 1 -or $previous.waits -ne 1 -or $previous.disposals -ne 1 -or $null -ne $script:LdbCrashProcess) { throw 'Owned live process was not terminated and released exactly once.' }

$script:LdbCrashRun = 'same-run'
$script:LdbCrashOwner = 'current-invocation'
$script:LdbCrashProcess = New-ProcessStub
$script:LdbCrashProcess.HasExited = $true
$exited = $script:LdbCrashProcess
& $cleanup 'same-run' 'current-invocation'
if ($exited.kills -ne 0 -or $exited.disposals -ne 1) { throw 'Exited process was killed or not released.' }
'4 process ownership regressions passed'
