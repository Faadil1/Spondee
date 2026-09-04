$ErrorActionPreference = "Stop"

function Fail($Message) {
    throw "[Spondee G3 Verify 949] $Message"
}

Write-Host "Spondee G3 - READ-ONLY verification for submitted job 949"
Write-Host "No wallet, no seller, no transaction. Reads the known submit receipt and verifies the existing manifest."
Write-Host "BSC Testnet only."

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repo

Write-Host "`n==> Checking repository and branch"
$branch = (git branch --show-current).Trim()
Write-Host "Branch: $branch"
if ($branch -ne "build/backend-complete") {
    Fail "Expected branch build/backend-complete, got $branch"
}

Write-Host "`n==> Checking Node.js 22+"
$nodeVersion = node --version
Write-Host "Node $nodeVersion"
if (-not $nodeVersion) { Fail "Node.js is unavailable" }

$manifest = Join-Path $repo "reference-agents\health-factor\app\agent\.agent-data\erc8183-job-949.json"
if (-not (Test-Path $manifest)) {
    Fail "Existing job 949 manifest not found at $manifest. Do not recreate it."
}

$serverScript = Join-Path $repo "scripts\local-erc8183-deliverable-server.mjs"
$storageDir = Join-Path $repo "reference-agents\health-factor\app\agent\.agent-data"
$env:SPONDEE_LOCAL_DELIVERABLE_DIR = $storageDir
$env:SPONDEE_LOCAL_DELIVERABLE_HOST = "127.0.0.1"
$env:SPONDEE_LOCAL_DELIVERABLE_PORT = "9100"

$server = $null
try {
    Write-Host "`n==> Starting read-only LocalStorage HTTP bridge"
    $server = Start-Process -FilePath "node" -ArgumentList @($serverScript) -PassThru -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:9100/health" -TimeoutSec 2
            if ($health.status -eq "HEALTHY") {
                $ready = $true
                break
            }
        } catch { }
    }
    if (-not $ready) { Fail "Local deliverable bridge did not become healthy" }
    Write-Host "Bridge: HEALTHY"

    Write-Host "`n==> Installing backend dependencies"
    Push-Location (Join-Path $repo "backend")
    try {
        npm install --ignore-scripts
        if ($LASTEXITCODE -ne 0) { Fail "backend npm install failed" }

        Write-Host "`n==> Verifying known submit transaction + job 949 + manifest + Outcome Receipt"
        $verifyOutput = @(& npx tsx src/verify-g3-submitted-cli.ts 2>&1)
        $verifyExit = $LASTEXITCODE
        $verifyOutput | ForEach-Object { Write-Host $_ }

        if ($verifyExit -ne 0) { Fail "read-only verification failed" }

        $passTerminal = "SPONDEE G3 SUBMITTED JOB 949 VERIFICATION: PASS"
        if (-not ($verifyOutput -contains $passTerminal)) {
            Fail "Verifier exited 0 without the required PASS terminal; failing closed instead of accepting silent success."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_PORT -ErrorAction SilentlyContinue
    Write-Host "`nLocal read-only bridge stopped; environment cleared."
}
