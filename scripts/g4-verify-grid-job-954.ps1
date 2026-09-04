$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
    throw "[Spondee G4 Grid 954 Read-Only Recovery] $Message"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendDir = Join-Path $repoRoot 'backend'
$manifestDir = Join-Path $repoRoot 'reference-agents\grid\app\agent\.agent-data'
$manifestPath = Join-Path $manifestDir 'erc8183-job-954.json'
$serverScript = Join-Path $repoRoot 'scripts\local-erc8183-deliverable-server.mjs'
$bridgeOut = Join-Path $env:TEMP 'spondee-g4-grid-954-bridge.out.log'
$bridgeErr = Join-Path $env:TEMP 'spondee-g4-grid-954-bridge.err.log'
$bridgeProcess = $null

Write-Host 'Spondee G4 Grid job 954 - READ-ONLY receipt + local manifest verification' -ForegroundColor Cyan
Write-Host 'No wallet. No password. No seller. No transaction. No retry of job 954.' -ForegroundColor Yellow

try {
    Set-Location $repoRoot
    $branch = (git branch --show-current).Trim()
    if ($branch -ne 'build/g4-sequential-live-e2e') {
        Fail "Expected branch build/g4-sequential-live-e2e; found $branch"
    }
    Write-Host "Branch: $branch"

    if (-not (Test-Path $manifestPath)) {
        Fail "Existing local Grid manifest missing: $manifestPath"
    }
    if (-not (Test-Path $serverScript)) {
        Fail "Local deliverable bridge script missing: $serverScript"
    }

    $nodeVersionText = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0) { Fail 'Node.js is required.' }
    Write-Host "Node $nodeVersionText"

    Push-Location $backendDir
    try {
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Fail 'Backend dependency install failed.' }
    } finally {
        Pop-Location
    }

    Remove-Item $bridgeOut,$bridgeErr -ErrorAction SilentlyContinue
    $env:SPONDEE_LOCAL_DELIVERABLE_HOST = '127.0.0.1'
    $env:SPONDEE_LOCAL_DELIVERABLE_PORT = '9100'
    $env:SPONDEE_LOCAL_DELIVERABLE_DIR = $manifestDir

    Write-Host 'Starting read-only local manifest bridge...'
    $bridgeProcess = Start-Process `
        -FilePath (Get-Command node).Source `
        -ArgumentList @($serverScript) `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $bridgeOut `
        -RedirectStandardError $bridgeErr `
        -PassThru `
        -WindowStyle Hidden

    $ready = $false
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ($bridgeProcess.HasExited) {
            Fail "Local manifest bridge exited with code $($bridgeProcess.ExitCode)."
        }
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9100/health' -Method Get -TimeoutSec 2
            if ($health.status -eq 'HEALTHY') { $ready = $true; break }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ready) { Fail 'Local manifest bridge did not become healthy.' }
    Write-Host 'Local manifest bridge: HEALTHY' -ForegroundColor Green

    Write-Host 'Verifying known provider submit receipt + getJob(954) + manifest + Outcome Receipt...'
    Push-Location $backendDir
    try {
        $verifyOutput = @(& npx tsx src/verify-g4-grid-954-cli.ts 2>&1)
        $verifyExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    $verifyOutput | ForEach-Object { Write-Host $_ }
    if ($verifyExit -ne 0) {
        Fail "Grid job 954 verifier failed with exit code $verifyExit."
    }
    $requiredTerminal = 'SPONDEE G4 GRID JOB 954 VERIFICATION: PASS'
    if (-not ($verifyOutput -contains $requiredTerminal)) {
        Fail 'Verifier exited 0 without the required PASS terminal; failing closed.'
    }

    Write-Host ''
    Write-Host $requiredTerminal -ForegroundColor Green
} finally {
    if ($bridgeProcess -and -not $bridgeProcess.HasExited) {
        Stop-Process -Id $bridgeProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_DIR -ErrorAction SilentlyContinue
    Write-Host 'Read-only bridge stopped; environment cleared.'
}
