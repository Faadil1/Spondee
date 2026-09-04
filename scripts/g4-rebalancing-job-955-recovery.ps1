param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[Spondee G4 Rebalancing 955 Recovery] $Message"
}

function Tail-File([string]$Path, [int]$Count = 50) {
    if (Test-Path $Path) {
        Get-Content $Path -Tail $Count -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    }
}

function Stop-ProcessTree($Process) {
    if ($Process -and -not $Process.HasExited) {
        try { & taskkill /PID $Process.Id /T /F 2>$null | Out-Null }
        catch { try { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue } catch {} }
    }
}

function Remove-WalletJunction([string]$Path) {
    if (Test-Path $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
            Fail "Refusing to remove non-junction wallet path: $Path"
        }
        & cmd.exe /c rmdir "$Path" | Out-Null
        if ($LASTEXITCODE -ne 0 -and (Test-Path $Path)) {
            Fail "Failed to remove temporary wallet junction: $Path"
        }
    }
}

function Set-WalletPasswordForChild([Security.SecureString]$SecurePassword) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $env:WALLET_PASSWORD = $plain
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
        Remove-Variable plain -ErrorAction SilentlyContinue
    }
}

function Clear-RecoveryEnvironment {
    @(
        'WALLET_PASSWORD',
        'SPONDEE_WALLETS_DIR',
        'SPONDEE_SELLER_A2A_URL',
        'SPONDEE_PROVIDER_ADDRESS',
        'SPONDEE_LIVE_EVIDENCE_PATH',
        'BNBAGENT_USE_PAYMASTER',
        'AGENT_BIND_HOST',
        'AGENT_PORT',
        'ERC8183_AGENT_URL',
        'SPONDEE_LOCAL_DELIVERABLE_HOST',
        'SPONDEE_LOCAL_DELIVERABLE_PORT',
        'SPONDEE_LOCAL_DELIVERABLE_DIR'
    ) | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
}

$initialLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$backendDir = Join-Path $repoRoot 'backend'
$healthRoot = Join-Path $repoRoot 'reference-agents\health-factor'
$healthAgentDir = Join-Path $healthRoot 'app\agent'
$canonicalWalletDir = Join-Path $healthRoot '.studio\wallets'
$agentRoot = Join-Path $repoRoot 'reference-agents\rebalancing'
$agentDir = Join-Path $agentRoot 'app\agent'
$agentData = Join-Path $agentDir '.agent-data'
$walletStudioDir = Join-Path $agentRoot '.studio'
$walletJunction = Join-Path $walletStudioDir 'wallets'
$serverScript = Join-Path $scriptDir 'local-erc8183-deliverable-server.mjs'
$expectedProvider = '0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8'
$pnpmVersion = '10.24.0'
$agentPort = 9000
$bridgePort = 9100
$sellerUrl = "http://127.0.0.1:$agentPort/"
$bridgeBase = "http://127.0.0.1:$bridgePort"
$tempRoot = [System.IO.Path]::GetTempPath()
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sellerOut = Join-Path $tempRoot "spondee-g4-rebalancing-955-seller-$stamp.out.log"
$sellerErr = Join-Path $tempRoot "spondee-g4-rebalancing-955-seller-$stamp.err.log"
$bridgeOut = Join-Path $tempRoot "spondee-g4-rebalancing-955-bridge-$stamp.out.log"
$bridgeErr = Join-Path $tempRoot "spondee-g4-rebalancing-955-bridge-$stamp.err.log"
$evidencePath = Join-Path $tempRoot "spondee-g4-rebalancing-job-955-recovery-$stamp.json"
$sellerProcess = $null
$bridgeProcess = $null
$securePassword = $null

Write-Host 'Spondee G4 - Rebalancing job 955 FUNDED recovery' -ForegroundColor Green
Write-Host 'Existing job 955 only. No create/register/setBudget/fund. Provider submit recovery only.' -ForegroundColor Yellow
Write-Host 'BSC Testnet only. Zero service price. MegaFuel seller submit. No Grid/Yield execution.'
Write-Host 'Never paste the seller password, keystore, seed phrase, or private key into chat.' -ForegroundColor Yellow

try {
    Write-Step 'Checking repository gate branch'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is not installed.' }
    $branch = (& git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { Fail 'Unable to read current branch.' }
    if ($branch -ne 'build/g4-sequential-live-e2e') {
        Fail "Current branch is '$branch'. Use build/g4-sequential-live-e2e for this recovery gate."
    }
    Write-Host "Branch: $branch" -ForegroundColor Green

    if (-not (Test-Path $canonicalWalletDir)) { Fail 'Canonical seller wallet directory is missing. Do not create a new wallet.' }
    if (-not (Test-Path $serverScript)) { Fail "Missing local deliverable bridge: $serverScript" }
    if (-not (Test-Path (Join-Path $backendDir 'src\resume-g4-rebalancing-955.ts'))) {
        Fail 'Missing backend/src/resume-g4-rebalancing-955.ts. Pull the latest branch.'
    }

    Write-Step 'Checking Node.js 22+ and npx'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js is not installed.' }
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { Fail 'npx is not available.' }
    $nodeRaw = (& node --version).Trim()
    $nodeMajor = [int](($nodeRaw -replace '^v','').Split('.')[0])
    if ($nodeMajor -lt 22) { Fail "Node.js $nodeRaw detected; Node 22+ is required." }
    Write-Host "Node $nodeRaw" -ForegroundColor Green

    if (-not $SkipInstall) {
        Write-Step 'Installing backend dependencies'
        Set-Location $backendDir
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Fail 'Backend dependency installation failed.' }

        Write-Step 'Installing frozen Rebalancing Agent Studio workspace'
        Set-Location $agentRoot
        & npx --yes "pnpm@$pnpmVersion" install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { Fail 'Rebalancing dependency installation failed.' }
    }

    Write-Step 'Read-only precheck: job 955 must still be FUNDED'
    Set-Location $backendDir
    $probeOutput = @(& npx tsx src/probe-g4-rebalancing-955.ts 2>&1)
    $probeExit = $LASTEXITCODE
    $probeOutput | ForEach-Object { Write-Host $_ }
    if ($probeExit -ne 0 -or -not ($probeOutput -match 'SPONDEE_G4_REBALANCING_JOB_955_READ_ONLY_FUNDED_PROBE_PASS')) {
        Fail 'Job 955 is not in the expected FUNDED state. No recovery write was attempted.'
    }

    Write-Step 'Unlocking and verifying the existing canonical seller wallet locally'
    $securePassword = Read-Host 'Seller wallet password' -AsSecureString
    if ($securePassword.Length -lt 12) { Fail 'Wallet password must contain at least 12 characters.' }
    $env:SPONDEE_WALLETS_DIR = $canonicalWalletDir
    Set-WalletPasswordForChild $securePassword
    Set-Location $healthAgentDir
    $verifyOutput = @(& npx --yes "pnpm@$pnpmVersion" wallet:verify 2>&1)
    $verifyExit = $LASTEXITCODE
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue
    if ($verifyExit -ne 0) {
        $verifyOutput | ForEach-Object { Write-Host $_ }
        Fail 'Seller wallet verification failed. Do not send the password to ChatGPT.'
    }
    $addressLine = $verifyOutput | Where-Object { $_ -match '^public_address=0x[a-fA-F0-9]{40}$' } | Select-Object -Last 1
    if (-not $addressLine) { Fail 'Seller wallet verified but public address could not be parsed.' }
    $sellerAddress = ($addressLine -replace '^public_address=', '').Trim()
    if ($sellerAddress.ToLowerInvariant() -ne $expectedProvider.ToLowerInvariant()) {
        Fail "Seller keystore address $sellerAddress does not match canonical provider $expectedProvider."
    }
    Write-Host "Seller wallet: $sellerAddress" -ForegroundColor Green
    Write-Host 'Local signing verification: PASS' -ForegroundColor Green

    New-Item -ItemType Directory -Force -Path $walletStudioDir | Out-Null
    if (Test-Path $walletJunction) {
        $existingWalletPath = Get-Item -LiteralPath $walletJunction -Force
        if (($existingWalletPath.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
            Fail "Unexpected real wallet directory exists at $walletJunction. Refusing to overwrite it."
        }
        Remove-WalletJunction $walletJunction
    }
    New-Item -ItemType Junction -Path $walletJunction -Target $canonicalWalletDir | Out-Null
    Write-Host 'Canonical encrypted seller wallet linked locally; no copy/new wallet created.' -ForegroundColor Green

    New-Item -ItemType Directory -Force -Path $agentData | Out-Null
    $env:SPONDEE_LOCAL_DELIVERABLE_HOST = '127.0.0.1'
    $env:SPONDEE_LOCAL_DELIVERABLE_PORT = "$bridgePort"
    $env:SPONDEE_LOCAL_DELIVERABLE_DIR = $agentData
    $env:ERC8183_AGENT_URL = "$bridgeBase/erc8183"

    Write-Step 'Starting Rebalancing LocalStorage HTTP deliverable bridge'
    $bridgeProcess = Start-Process `
        -FilePath (Get-Command node).Source `
        -ArgumentList @($serverScript) `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $bridgeOut `
        -RedirectStandardError $bridgeErr `
        -PassThru `
        -WindowStyle Hidden

    $bridgeReady = $false
    $bridgeDeadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $bridgeDeadline) {
        if ($bridgeProcess.HasExited) {
            Tail-File $bridgeOut
            Tail-File $bridgeErr
            Fail "Deliverable bridge exited with code $($bridgeProcess.ExitCode)."
        }
        try {
            $health = Invoke-RestMethod -Uri "$bridgeBase/health" -Method Get -TimeoutSec 2
            if ($health.status -eq 'HEALTHY') { $bridgeReady = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $bridgeReady) { Fail 'Deliverable bridge did not become healthy.' }
    Write-Host 'Local manifest bridge: HEALTHY' -ForegroundColor Green

    Write-Step 'Starting Rebalancing seller for existing job 955 only'
    $env:BNBAGENT_USE_PAYMASTER = '1'
    $env:AGENT_BIND_HOST = '127.0.0.1'
    $env:AGENT_PORT = "$agentPort"
    $env:SPONDEE_WALLETS_DIR = $canonicalWalletDir
    Set-WalletPasswordForChild $securePassword

    $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npxCommand) { $npxCommand = Get-Command npx -ErrorAction Stop }
    $sellerProcess = Start-Process `
        -FilePath $npxCommand.Source `
        -ArgumentList @('--yes', "pnpm@$pnpmVersion", 'dev') `
        -WorkingDirectory $agentDir `
        -RedirectStandardOutput $sellerOut `
        -RedirectStandardError $sellerErr `
        -PassThru `
        -WindowStyle Hidden

    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue

    Write-Step 'Waiting for Rebalancing seller /ping'
    $sellerReady = $false
    $sellerDeadline = (Get-Date).AddSeconds(75)
    while ((Get-Date) -lt $sellerDeadline) {
        if ($sellerProcess.HasExited) {
            Write-Host '--- seller stdout ---'
            Tail-File $sellerOut
            Write-Host '--- seller stderr ---'
            Tail-File $sellerErr
            Fail "Seller exited with code $($sellerProcess.ExitCode)."
        }
        try {
            $ping = Invoke-RestMethod -Uri "http://127.0.0.1:$agentPort/ping" -Method Get -TimeoutSec 3
            if ($ping.status -eq 'HEALTHY' -or $ping.status -eq 'HEALTHY_BUSY') {
                $sellerReady = $true
                break
            }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $sellerReady) {
        Tail-File $sellerOut
        Tail-File $sellerErr
        Fail 'Rebalancing seller did not become healthy within 75 seconds.'
    }
    Write-Host 'Rebalancing seller A2A: HEALTHY' -ForegroundColor Green

    Write-Step 'Recovering existing FUNDED job 955 -> provider submit -> exact receipt -> manifest -> Outcome Receipt'
    $env:SPONDEE_SELLER_A2A_URL = $sellerUrl
    $env:SPONDEE_PROVIDER_ADDRESS = $expectedProvider
    $env:SPONDEE_LIVE_EVIDENCE_PATH = $evidencePath

    Set-Location $backendDir
    & npx tsx src/resume-g4-rebalancing-955.ts
    $recoveryExit = $LASTEXITCODE

    if (-not (Test-Path $evidencePath)) {
        Write-Host '--- seller stdout tail ---'
        Tail-File $sellerOut
        Write-Host '--- seller stderr tail ---'
        Tail-File $sellerErr
        Fail "Recovery produced no public evidence file (exit=$recoveryExit)."
    }

    $evidence = Get-Content $evidencePath -Raw | ConvertFrom-Json
    Get-Content $evidencePath | ForEach-Object { Write-Host $_ }
    if ($recoveryExit -ne 0 -or $evidence.conclusion -ne 'SPONDEE_G4_REBALANCING_JOB_955_RECOVERY_PASS') {
        Write-Host '--- seller stdout tail ---'
        Tail-File $sellerOut
        Write-Host '--- seller stderr tail ---'
        Tail-File $sellerErr
        Fail 'Job 955 recovery did not pass. Do not retry blindly.'
    }
    if ($evidence.new_job_created_during_recovery -ne $false) { Fail 'Recovery unexpectedly reported a new job.' }
    if ($evidence.buyer_balance_before_wei -ne '0' -or $evidence.buyer_balance_after_wei -ne '0') { Fail 'Buyer zero-balance boundary changed.' }
    if ($evidence.manifest_hash_verified -ne $true) { Fail 'Manifest hash was not verified.' }
    if ($evidence.spondee_receipt_verified -ne $true) { Fail 'Outcome Receipt was not verified.' }
    if ($evidence.evidence_class -ne 'SIMULATION') { Fail 'Receipt truth boundary changed.' }
    if ($evidence.observed_agent_advantage_claimed -ne $false) { Fail 'Observed Agent Advantage was incorrectly claimed.' }

    Write-Host "`nSPONDEE G4 REBALANCING JOB 955 RECOVERY: PASS" -ForegroundColor Green
    Write-Host "Job ID: $($evidence.job_id)"
    Write-Host "Status: $($evidence.status)"
    Write-Host "Promise ID: $($evidence.promise_id)"
    Write-Host "submit: $($evidence.transactions.submit)"
    Write-Host "Evidence: $evidencePath" -ForegroundColor Cyan
    Write-Host 'Yield remains blocked until this PASS is recorded canonically.' -ForegroundColor Yellow
}
finally {
    Clear-RecoveryEnvironment
    $securePassword = $null
    Stop-ProcessTree $sellerProcess
    Stop-ProcessTree $bridgeProcess
    if (Test-Path $walletJunction) { Remove-WalletJunction $walletJunction }
    Set-Location $initialLocation
    Write-Host "`nSensitive environment variables cleared." -ForegroundColor DarkGray
}
