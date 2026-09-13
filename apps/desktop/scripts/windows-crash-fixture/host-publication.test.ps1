# Own fresh temporary directory only. Preserve it and all earlier runs.
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'host-observer.ps1'), [ref] $tokens, [ref] $errors)
if ($errors.Count -ne 0) { throw 'Observer parser failed.' }
$writer = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Write-HostArtifact' }, $true))[0]
$plain = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-PlainDirectory' }, $true))[0]
Set-Item Function:Assert-PlainDirectory -Value $plain.Body.GetScriptBlock()
$body = $writer.Body.Extent.Text
$flush = '$stream.Flush($true)'
if (($body.Split(@($flush), [StringSplitOptions]::None)).Count -ne 2) { throw 'Update publication test for changed flush boundary.' }
# Insert a read-only observation immediately before the actual writer's flush.
$probe = 'if (Test-Path -LiteralPath (Join-Path $HostEvidence $Name)) { throw "Final artifact became visible before flush/close." }; $stream.Flush($true)'
$instrumented = $body.Replace($flush, $probe)
$publish = [scriptblock]::Create($instrumented.Substring(1, $instrumented.Length - 2))
$HostEvidence = Join-Path $env:TEMP ('ldb-host-publication-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $HostEvidence | Out-Null
& $publish 'held.json' @{ status = 'complete'; sequence = 1 }
$final = Join-Path $HostEvidence 'held.json'
$before = [IO.File]::ReadAllBytes($final)
$result = [Text.Encoding]::UTF8.GetString($before) | ConvertFrom-Json
if ($result.status -cne 'complete' -or $result.sequence -ne 1 -or (Test-Path -LiteralPath ($final + '.pending'))) { throw 'Final artifact was not completely published.' }
$rejected = $false
try { & $publish 'held.json' @{ status = 'overwritten' } } catch { $rejected = $true }
$after = [IO.File]::ReadAllBytes($final)
if (-not $rejected -or [Convert]::ToBase64String($before) -cne [Convert]::ToBase64String($after)) { throw 'Existing final artifact was overwritten.' }
'2 real host artifact publication regressions passed; temporary evidence preserved'
