param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[Spondee G3 Live] $Message"
}

function Tail-File([string]$Path, [int]$Count = 30) {
    if (Test-Path $Path) {
        Get-Content $Path -Tail $Count -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    }
}

function Clear-SensitiveEnvironment {
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:BUYER_WALLET_PASSWORD -ErrorAction SilentlyContinue
}

$initialLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$hfRoot = Join-Path $repoRoot 'reference-agents\health-factor'
$agentDir = Join-Path $hfRoot 'app\agent'
$backendDir = Join-Path $repoRoot 'backend'
$walletDir = Join-Path $hfRoot '.studio\wallets'
$expectedProvider = '0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8'
$pnpmVersion = '10.24.0'
$agentPort = 9000
$sellerUrl = "http://127.0.0.1:$agentPort/"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempRoot = [System.IO.Path]::GetTempPath()
$sellerOut = Join-Path $tempRoot "spondee-g3-seller-$stamp.out.log"
$sellerErr = Join-Path $tempRoot "spondee-g3-seller-$stamp.err.log"
$evidencePath = Join-Path $tempRoot "spondee-g3-live-e2e-$stamp.json"
$sellerProcess = $null

Write-Host 'Spondee G3 - MegaFuel-backed Health Factor LIVE E2E' -ForegroundColor Green
Write-Host 'BSC Testnet only (chain 97). Service price is fixed at zero.'
Write-Host 'MegaFuel is the primary gas path. No tBNB or mainnet funds are required for this test.' -ForegroundColor Green
Write-Host 'The existing Spondee seller keystore stays local. A temporary buyer is destroyed after the run.'
Write-Host 'Never paste the wallet password, keystore, seed phrase, or private key into chat.' -ForegroundColor Yellow

try {
    Write-Step 'Checking repository and branch'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Fail 'git is not installed.'
    }
    $branch = (& git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        Fail 'Unable to read the current git branch.'
    }
    if ($branch -ne 'build/backend-complete') {
        Fail "Current branch is '$branch'. First run: git fetch origin; git checkout build/backend-complete; git pull --ff-only"
    }
    Write-Host "Branch: $branch" -ForegroundColor Green

    if (-not (Test-Path (Join-Path $agentDir 'studio.toml'))) {
        Fail "Health Factor seller not found at $agentDir"
    }
    if (-not (Test-Path (Join-Path $backendDir 'src\live-g3.ts'))) {
        Fail 'backend/src/live-g3.ts is missing. Pull the latest build/backend-complete branch.'
    }
    if (-not (Test-Path $walletDir)) {
        Fail "Seller wallet directory not found at $walletDir. Do not create a new seller wallet."
    }

    Write-Step 'Checking Node.js 22+ and npx'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Fail 'Node.js is not installed.'
    }
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        Fail 'npx is not available.'
    }
    $nodeRaw = (& node --version).Trim()
    $nodeMajor = [int](($nodeRaw -replace '^v','').Split('.')[0])
    if ($nodeMajor -lt 22) {
        Fail "Node.js $nodeRaw detected; Spondee requires Node.js 22+."
    }
    Write-Host "Node $nodeRaw" -ForegroundColor Green

    if (-not $SkipInstall) {
        Write-Step "Installing frozen Health Factor workspace dependencies with pnpm $pnpmVersion"
        Set-Location $hfRoot
        & npx --yes "pnpm@$pnpmVersion" install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            Fail 'Health Factor dependency installation failed.'
        }

        Write-Step 'Installing backend dependencies'
        Set-Location $backendDir
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Fail 'Backend dependency installation failed.'
        }
    }

    Write-Step 'Unlocking and verifying the existing Spondee seller wallet locally'
    Write-Host 'Enter the SAME password used when the Spondee testnet wallet was created.' -ForegroundColor Yellow
    $secure = Read-Host 'Seller wallet password' -AsSecureString
    if ($secure.Length -lt 12) {
        Fail 'Wallet password must contain at least 12 characters.'
    }

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
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

    Set-Location $agentDir
    $verifyOutput = @(& npx --yes "pnpm@$pnpmVersion" wallet:verify 2>&1)
    $verifyExit = $LASTEXITCODE
    if ($verifyExit -ne 0) {
        $verifyOutput | ForEach-Object { Write-Host $_ }
        Fail 'Seller wallet verification failed. Check the local password; do not send it to ChatGPT.'
    }
    $addressLine = $verifyOutput | Where-Object { $_ -match '^public_address=0x[a-fA-F0-9]{40}$' } | Select-Object -Last 1
    if (-not $addressLine) {
        Fail 'Seller wallet verified but public address could not be parsed.'
    }
    $sellerAddress = ($addressLine -replace '^public_address=', '').Trim()
    if ($sellerAddress.ToLowerInvariant() -ne $expectedProvider.ToLowerInvariant()) {
        Fail "Seller keystore address $sellerAddress does not match canonical Spondee provider $expectedProvider."
    }
    Write-Host "Seller wallet: $sellerAddress" -ForegroundColor Green
    Write-Host 'Local signing verification: PASS' -ForegroundColor Green

    Write-Step 'Starting the local Health Factor seller with MegaFuel enabled'
    $env:BNBAGENT_USE_PAYMASTER = '1'
    $env:AGENT_BIND_HOST = '127.0.0.1'
    $env:AGENT_PORT = "$agentPort"

    $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npxCommand) {
        $npxCommand = Get-Command npx -ErrorAction Stop
    }
    $sellerProcess = Start-Process `
        -FilePath $npxCommand.Source `
        -ArgumentList @('--yes', "pnpm@$pnpmVersion", 'dev') `
        -WorkingDirectory $agentDir `
        -RedirectStandardOutput $sellerOut `
        -RedirectStandardError $sellerErr `
        -PassThru `
        -WindowStyle Hidden

    # Child process has inherited the password. Remove it from the parent immediately.
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue

    Write-Step 'Waiting for seller /ping readiness'
    $ready = $false
    $deadline = (Get-Date).AddSeconds(75)
    while ((Get-Date) -lt $deadline) {
        if ($sellerProcess.HasExited) {
            Write-Host 'Seller exited before becoming ready.' -ForegroundColor Red
            Write-Host '--- seller stdout ---'
            Tail-File $sellerOut
            Write-Host '--- seller stderr ---'
            Tail-File $sellerErr
            Fail "Seller process exited with code $($sellerProcess.ExitCode)."
        }
        try {
            $ping = Invoke-RestMethod -Uri "http://127.0.0.1:$agentPort/ping" -Method Get -TimeoutSec 3
            if ($ping.status -eq 'HEALTHY' -or $ping.status -eq 'HEALTHY_BUSY') {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $ready) {
        Write-Host '--- seller stdout ---'
        Tail-File $sellerOut
        Write-Host '--- seller stderr ---'
        Tail-File $sellerErr
        Fail 'Seller did not become healthy within 75 seconds.'
    }
    Write-Host 'Seller A2A: HEALTHY' -ForegroundColor Green

    Write-Step 'Executing Promise -> signed quote -> MegaFuel ERC-8183 -> submit -> verified Outcome Receipt'
    $env:SPONDEE_LIVE_TESTNET_ENABLED = 'true'
    $env:SPONDEE_SELLER_A2A_URL = $sellerUrl
    $env:SPONDEE_PROVIDER_ADDRESS = $expectedProvider
    $env:SPONDEE_LIVE_EVIDENCE_PATH = $evidencePath
    $env:SPONDEE_G3_TASK_PATH = Join-Path $hfRoot 'demo\health-factor-scenario.json'
    $env:BNBAGENT_USE_PAYMASTER = '1'

    Set-Location $backendDir
    & npm run --silent live:g3
    $liveExit = $LASTEXITCODE

    if (-not (Test-Path $evidencePath)) {
        Write-Host '--- seller stdout ---'
        Tail-File $sellerOut
        Write-Host '--- seller stderr ---'
        Tail-File $sellerErr
        Fail "Live runner produced no public evidence file (exit=$liveExit)."
    }

    $evidence = Get-Content $evidencePath -Raw | ConvertFrom-Json
    if ($liveExit -ne 0 -or $evidence.conclusion -ne 'SPONDEE_G3_MEGAFUEL_BACKED_HEALTH_FACTOR_LIVE_E2E_PASS') {
        Write-Host "`nLive E2E failed closed. Public partial evidence:" -ForegroundColor Red
        Get-Content $evidencePath | ForEach-Object { Write-Host $_ }
        Write-Host '--- seller stdout tail ---'
        Tail-File $sellerOut
        Write-Host '--- seller stderr tail ---'
        Tail-File $sellerErr
        Fail 'The bounded live E2E did not pass. Do not retry blindly; share only the public evidence/error output.'
    }

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G3 MEGAFUEL LIVE E2E: PASS' -ForegroundColor Green
    Write-Host "Provider: $($evidence.provider_address)"
    Write-Host "Ephemeral buyer: $($evidence.buyer_address)"
    Write-Host "Buyer balance before: $($evidence.buyer_balance_before_wei) wei"
    Write-Host "Buyer balance after:  $($evidence.buyer_balance_after_wei) wei"
    Write-Host "Job ID: $($evidence.result.job_id)"
    Write-Host "Promise ID: $($evidence.result.promise_id)"
    Write-Host "createJob:   $($evidence.result.transactions.create_job)"
    Write-Host "registerJob: $($evidence.result.transactions.register_job)"
    Write-Host "setBudget:   $($evidence.result.transactions.set_budget)"
    Write-Host "fund:        $($evidence.result.transactions.fund)"
    Write-Host "submit:      $($evidence.result.transactions.submit)"
    Write-Host "Manifest hash verified: $($evidence.result.deliverable.manifest_hash_verified)"
    Write-Host "Outcome Receipt verified: $($evidence.result.deliverable.spondee_receipt_verified)"
    Write-Host "Public evidence file: $evidencePath" -ForegroundColor Cyan
    Write-Host 'No buyer private key/password was retained or printed.' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green

    Write-Host "`nSend ChatGPT either the PASS block above or the public evidence JSON file contents." -ForegroundColor Yellow
    Write-Host 'Do NOT send any wallet password, keystore, seed phrase, or private key.' -ForegroundColor Yellow
}
finally {
    Clear-SensitiveEnvironment
    Remove-Item Env:SPONDEE_LIVE_TESTNET_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_SELLER_A2A_URL -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_PROVIDER_ADDRESS -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_LIVE_EVIDENCE_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_G3_TASK_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:BNBAGENT_USE_PAYMASTER -ErrorAction SilentlyContinue
    Remove-Item Env:AGENT_BIND_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:AGENT_PORT -ErrorAction SilentlyContinue

    if ($sellerProcess -and -not $sellerProcess.HasExited) {
        try {
            & taskkill /PID $sellerProcess.Id /T /F 2>$null | Out-Null
        }
        catch {
            try { Stop-Process -Id $sellerProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
    }

    Set-Location $initialLocation
    Write-Host "`nSensitive environment variables cleared. Local seller stopped." -ForegroundColor DarkGray
}
