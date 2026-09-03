param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$Message) {
    throw "[Spondee G3 LocalStorage] $Message"
}

function Tail-File([string]$Path, [int]$Count = 30) {
    if (Test-Path $Path) {
        Get-Content $Path -Tail $Count -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    }
}

$initialLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$agentData = Join-Path $repoRoot 'reference-agents\health-factor\app\agent\.agent-data'
$serverScript = Join-Path $scriptDir 'local-erc8183-deliverable-server.mjs'
$innerRunner = Join-Path $scriptDir 'g3-megafuel-live-e2e.ps1'
$serverPort = 9100
$serverBase = "http://127.0.0.1:$serverPort"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempRoot = [System.IO.Path]::GetTempPath()
$serverOut = Join-Path $tempRoot "spondee-g3-deliverable-$stamp.out.log"
$serverErr = Join-Path $tempRoot "spondee-g3-deliverable-$stamp.err.log"
$serverProcess = $null

Write-Host 'Spondee G3 - MegaFuel + LocalStorage HTTP E2E' -ForegroundColor Green
Write-Host 'This wrapper starts the ERC-8183 LocalStorage HTTP bridge before the canonical live runner.'
Write-Host 'BSC Testnet only. Existing encrypted seller wallet only. No mainnet.' -ForegroundColor Yellow

try {
    if (-not (Test-Path $serverScript)) {
        Fail "Missing deliverable server: $serverScript"
    }
    if (-not (Test-Path $innerRunner)) {
        Fail "Missing canonical G3 live runner: $innerRunner"
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Fail 'Node.js is not installed.'
    }

    New-Item -ItemType Directory -Force -Path $agentData | Out-Null
    $env:SPONDEE_LOCAL_DELIVERABLE_HOST = '127.0.0.1'
    $env:SPONDEE_LOCAL_DELIVERABLE_PORT = "$serverPort"
    $env:SPONDEE_LOCAL_DELIVERABLE_DIR = $agentData
    $env:ERC8183_AGENT_URL = "$serverBase/erc8183"

    Write-Host "`n==> Starting local ERC-8183 deliverable bridge" -ForegroundColor Cyan
    $serverProcess = Start-Process `
        -FilePath (Get-Command node).Source `
        -ArgumentList @($serverScript) `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $serverOut `
        -RedirectStandardError $serverErr `
        -PassThru `
        -WindowStyle Hidden

    $ready = $false
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ($serverProcess.HasExited) {
            Write-Host '--- deliverable server stdout ---'
            Tail-File $serverOut
            Write-Host '--- deliverable server stderr ---'
            Tail-File $serverErr
            Fail "Deliverable server exited with code $($serverProcess.ExitCode)."
        }
        try {
            $health = Invoke-RestMethod -Uri "$serverBase/health" -Method Get -TimeoutSec 2
            if ($health.status -eq 'HEALTHY') {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ready) {
        Write-Host '--- deliverable server stdout ---'
        Tail-File $serverOut
        Write-Host '--- deliverable server stderr ---'
        Tail-File $serverErr
        Fail 'Local ERC-8183 deliverable bridge did not become healthy.'
    }
    Write-Host "Deliverable URL base: $env:ERC8183_AGENT_URL" -ForegroundColor Green

    Write-Host "`n==> Launching canonical G3 live E2E" -ForegroundColor Cyan
    $args = @('-ExecutionPolicy', 'Bypass', '-File', $innerRunner)
    if ($SkipInstall) {
        $args += '-SkipInstall'
    }
    & powershell @args
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Fail "Canonical G3 live runner exited with code $exitCode. Do not retry blindly."
    }
}
finally {
    Remove-Item Env:ERC8183_AGENT_URL -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_DIR -ErrorAction SilentlyContinue

    if ($serverProcess -and -not $serverProcess.HasExited) {
        try {
            & taskkill /PID $serverProcess.Id /T /F 2>$null | Out-Null
        }
        catch {
            try { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
    Set-Location $initialLocation
    Write-Host "`nLocal deliverable bridge stopped; environment cleared." -ForegroundColor DarkGray
}
