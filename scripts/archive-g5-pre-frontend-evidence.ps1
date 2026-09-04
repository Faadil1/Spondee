param(
  [string]$HealthSource = "$env:LOCALAPPDATA\Temp\spondee-g5-health-forward-20260904-093446",
  [string]$RebalancingSource = "$env:LOCALAPPDATA\Temp\spondee-g5-rebalancing-forward-20260904-093446"
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) { throw "[Spondee Evidence Archive] $Message" }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$healthDest = Join-Path $repo 'evidence\g5-health-forward-job-971-countable-pass\raw-bundle'
$rebalanceDest = Join-Path $repo 'evidence\g5-rebalancing-forward-job-973-countable-pass\raw-bundle'

if (-not (Test-Path $HealthSource)) { Fail "Health raw bundle not found: $HealthSource" }
if (-not (Test-Path $RebalancingSource)) { Fail "Rebalancing raw bundle not found: $RebalancingSource" }

foreach ($dest in @($healthDest, $rebalanceDest)) {
  if (Test-Path $dest) { Fail "Destination already exists; refusing overwrite: $dest" }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

Copy-Item -Path (Join-Path $HealthSource '*') -Destination $healthDest -Recurse -Force
Copy-Item -Path (Join-Path $RebalancingSource '*') -Destination $rebalanceDest -Recurse -Force

$sensitivePattern = '(?i)(private[_ -]?key|seed phrase|mnemonic|wallet password|keystore password)'
$files = Get-ChildItem -Path $healthDest, $rebalanceDest -Recurse -File
foreach ($file in $files) {
  if ($file.Extension -in @('.json','.txt','.md','.log','.yaml','.yml')) {
    $text = Get-Content -Raw -LiteralPath $file.FullName
    if ($text -match $sensitivePattern) {
      Fail "Potential sensitive material marker found in $($file.FullName). Review manually; nothing was committed automatically."
    }
  }
}

$manifest = [ordered]@{
  schema = 'spondee.g5-pre-frontend-evidence-archive.v1'
  archived_at = (Get-Date).ToUniversalTime().ToString('o')
  health = [ordered]@{
    job_id = '971'
    pair_id = 'g5-health-forward-job-971'
    source = $HealthSource
    destination = $healthDest
    file_count = (Get-ChildItem -Path $healthDest -Recurse -File).Count
  }
  rebalancing = [ordered]@{
    job_id = '973'
    pair_id = 'g5-rebalancing-forward-job-973'
    source = $RebalancingSource
    destination = $rebalanceDest
    file_count = (Get-ChildItem -Path $rebalanceDest -Recurse -File).Count
  }
  secrets_printed = $false
  automatic_git_commit = $false
  conclusion = 'SPONDEE_G5_PRE_FRONTEND_EVIDENCE_ARCHIVE_PASS'
}

$manifestPath = Join-Path $repo 'evidence\g5-agent-advantage-3-of-3-final\raw-archive-manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $manifestPath

Write-Host ''
Write-Host 'SPONDEE G5 PRE-FRONTEND EVIDENCE ARCHIVE: PASS'
Write-Host "Health raw bundle -> $healthDest"
Write-Host "Rebalancing raw bundle -> $rebalanceDest"
Write-Host "Manifest -> $manifestPath"
Write-Host 'No git add/commit/push was performed automatically.'
