param(
    [int]$JobId = 948,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[Spondee G3 Recovery] $Message"
}

function Tail-File([string]$Path, [int]$Count = 35) {
    if (Test-Path $Path) {
        Get-Content $Path -Tail $Count -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    }
}

function Clear-SensitiveEnvironment {
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
}

$initialLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$hfRoot = Join-Path $repoRoot 'reference-agents\health-factor'
$agentDir = Join-Path $hfRoot 'app\agent'
$backendDir = Join-Path $repoRoot 'backend'
$walletDir = Join-Path $hfRoot '.studio\wallets'
$deliverableDir = Join-Path $agentDir '.agent-data'
$deliverableServerScript = Join-Path $repoRoot 'scripts\local-erc8183-deliverable-server.mjs'
$expectedProvider = '0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8'
$pnpmVersion = '10.24.0'
$agentPort = 9000
$deliverablePort = 9100
$sellerUrl = "http://127.0.0.1:$agentPort/"
$erc8183AgentUrl = "http://127.0.0.1:$deliverablePort/erc8183"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempRoot = [System.IO.Path]::GetTempPath()
$sellerOut = Join-Path $tempRoot "spondee-g3-recovery-seller-$stamp.out.log"
$sellerErr = Join-Path $tempRoot "spondee-g3-recovery-seller-$stamp.err.log"
$serverOut = Join-Path $tempRoot "spondee-g3-recovery-deliverable-$stamp.out.log"
$serverErr = Join-Path $tempRoot "spondee-g3-recovery-deliverable-$stamp.err.log"
$evidencePath = Join-Path $tempRoot "spondee-g3-funded-recovery-$stamp.json"
$sellerProcess = $null
$deliverableProcess = $null

Write-Host 'Spondee G3 - FUNDED job recovery' -ForegroundColor Green
Write-Host "Target job: $JobId (BSC Testnet chain 97)"
Write-Host 'This runner DOES NOT create/register/budget/fund a new job.' -ForegroundColor Green
Write-Host 'It serves the existing LocalStorage deliverable, resumes the FUNDED job, and verifies SUBMITTED + Outcome Receipt.'
Write-Host 'Never paste the wallet password, keystore, seed phrase, or private key into chat.' -ForegroundColor Yellow

try {
    if ($JobId -ne 948) {
        Fail 'This recovery gate is canonically bound to funded job 948. Do not target another job without a new PBPD decision.'
    }

    Write-Step 'Checking repository and branch'
    $branch = (& git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { Fail 'Unable to read current git branch.' }
    if ($branch -ne 'build/backend-complete') {
        Fail "Current branch is '$branch'. Use build/backend-complete for this recovery gate."
    }
    Write-Host "Branch: $branch" -ForegroundColor Green

    if (-not (Test-Path $deliverableServerScript)) { Fail 'Local ERC-8183 deliverable server is missing; pull the latest branch.' }
    if (-not (Test-Path (Join-Path $backendDir 'src\resume-g3-funded.ts'))) { Fail 'Funded recovery verifier is missing; pull the latest branch.' }
    if (-not (Test-Path $walletDir)) { Fail 'Existing seller wallet directory is missing. Do not create a new seller wallet.' }
    if (-not (Test-Path $deliverableDir)) {
        New-Item -ItemType Directory -Path $deliverableDir -Force | Out-Null
    }

    Write-Step 'Checking Node.js 22+'
    $nodeCommand = Get-Command node -ErrorAction Stop
    $nodeRaw = (& node --version).Trim()
    $nodeMajor = [int](($nodeRaw -replace '^v','').Split('.')[0])
    if ($nodeMajor -lt 22) { Fail "Node.js $nodeRaw detected; Node.js 22+ is required." }
    Write-Host "Node $nodeRaw" -ForegroundColor Green

    if (-not $SkipInstall) {
        Write-Step "Installing frozen Health Factor workspace dependencies with pnpm $pnpmVersion"
        Set-Location $hfRoot
        & npx --yes "pnpm@$pnpmVersion" install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { Fail 'Health Factor dependency installation failed.' }

        Write-Step 'Installing backend dependencies'
        Set-Location $backendDir
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Fail 'Backend dependency installation failed.' }
    }

    Write-Step 'Unlocking and verifying the existing Spondee seller wallet locally'
    Write-Host 'Enter the SAME password used when the Spondee testnet wallet was created.' -ForegroundColor Yellow
    $secure = Read-Host 'Seller wallet password' -AsSecureString
    if ($secure.Length -lt 12) { Fail 'Wallet password must contain at least 12 characters.' }

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $env:WALLET_PASSWORD = $plain
    }
    finally {
        if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        Remove-Variable plain -ErrorAction SilentlyContinue
    }

    Set-Location $agentDir
    $verifyOutput = @(& npx --yes "pnpm@$pnpmVersion" wallet:verify 2>&1)
    if ($LASTEXITCODE -ne 0) {
        $verifyOutput | ForEach-Object { Write-Host $_ }
        Fail 'Seller wallet verification failed. Check the local password; do not send it to ChatGPT.'
    }
    $addressLine = $verifyOutput | Where-Object { $_ -match '^public_address=0x[a-fA-F0-9]{40}$' } | Select-Object -Last 1
    if (-not $addressLine) { Fail 'Seller wallet address could not be parsed.' }
    $sellerAddress = ($addressLine -replace '^public_address=', '').Trim()
    if ($sellerAddress.ToLowerInvariant() -ne $expectedProvider.ToLowerInvariant()) {
        Fail "Seller keystore $sellerAddress does not match canonical provider $expectedProvider."
    }
    Write-Host "Seller wallet: $sellerAddress" -ForegroundColor Green
    Write-Host 'Local signing verification: PASS' -ForegroundColor Green

    Write-Step 'Starting local ERC-8183 deliverable server'
    $env:SPONDEE_LOCAL_DELIVERABLE_HOST = '127.0.0.1'
    $env:SPONDEE_LOCAL_DELIVERABLE_PORT = "$deliverablePort"
    $env:SPONDEE_LOCAL_DELIVERABLE_DIR = $deliverableDir
    $deliverableProcess = Start-Process `
        -FilePath $nodeCommand.Source `
        -ArgumentList @($deliverableServerScript) `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $serverOut `
        -RedirectStandardError $serverErr `
        -PassThru `
        -WindowStyle Hidden

    $serverReady = $false
    $serverDeadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $serverDeadline) {
        if ($deliverableProcess.HasExited) {
            Tail-File $serverOut
            Tail-File $serverErr
            Fail "Deliverable server exited with code $($deliverableProcess.ExitCode)."
        }
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$deliverablePort/health" -Method Get -TimeoutSec 2
            if ($health.status -eq 'HEALTHY') { $serverReady = $true; break }
        }
        catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $serverReady) { Fail 'Deliverable server did not become healthy.' }
    Write-Host "Deliverable base URL: $erc8183AgentUrl" -ForegroundColor Green

    Write-Step 'Starting seller with LocalStorage URL recovery enabled'
    $env:BNBAGENT_USE_PAYMASTER = '1'
    $env:AGENT_BIND_HOST = '127.0.0.1'
    $env:AGENT_PORT = "$agentPort"
    $env:ERC8183_AGENT_URL = $erc8183AgentUrl

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
    Remove-Variable secure -ErrorAction SilentlyContinue

    Write-Step 'Waiting for seller readiness'
    $ready = $false
    $deadline = (Get-Date).AddSeconds(75)
    while ((Get-Date) -lt $deadline) {
        if ($sellerProcess.HasExited) {
            Tail-File $sellerOut
            Tail-File $sellerErr
            Fail "Seller exited with code $($sellerProcess.ExitCode)."
        }
        try {
            $ping = Invoke-RestMethod -Uri "http://127.0.0.1:$agentPort/ping" -Method Get -TimeoutSec 3
            if ($ping.status -eq 'HEALTHY' -or $ping.status -eq 'HEALTHY_BUSY') { $ready = $true; break }
        }
        catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { Fail 'Seller did not become healthy within 75 seconds.' }
    Write-Host 'Seller A2A: HEALTHY / HEALTHY_BUSY' -ForegroundColor Green

    Write-Step "Resuming existing FUNDED job $JobId and verifying the deliverable"
    $env:SPONDEE_LIVE_TESTNET_ENABLED = 'true'
    $env:SPONDEE_SELLER_A2A_URL = $sellerUrl
    $env:SPONDEE_PROVIDER_ADDRESS = $expectedProvider
    $env:SPONDEE_G3_RESUME_JOB_ID = "$JobId"
    $env:SPONDEE_G3_TASK_PATH = Join-Path $hfRoot 'demo\health-factor-scenario.json'
    $env:SPONDEE_LIVE_EVIDENCE_PATH = $evidencePath

    Set-Location $backendDir
    & npm run --silent resume:g3
    $resumeExit = $LASTEXITCODE

    if (-not (Test-Path $evidencePath)) {
        Tail-File $sellerOut
        Tail-File $sellerErr
        Fail "Recovery verifier produced no public evidence file (exit=$resumeExit)."
    }

    $evidence = Get-Content $evidencePath -Raw | ConvertFrom-Json
    if ($resumeExit -ne 0 -or $evidence.conclusion -ne 'SPONDEE_G3_FUNDED_JOB_RECOVERY_PASS') {
        Write-Host "`nRecovery failed closed. Public evidence:" -ForegroundColor Red
        Get-Content $evidencePath | ForEach-Object { Write-Host $_ }
        Write-Host '--- seller stdout tail ---'
        Tail-File $sellerOut
        Write-Host '--- seller stderr tail ---'
        Tail-File $sellerErr
        Fail 'Funded-job recovery did not pass. Do not retry blindly; return only the public recovery failure block.'
    }

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G3 FUNDED JOB RECOVERY: PASS' -ForegroundColor Green
    Write-Host "Job ID: $($evidence.job_id)"
    Write-Host "Initial status: $($evidence.initial_status)"
    Write-Host "Final status:   $($evidence.final_status)"
    Write-Host "Submit tx:      $($evidence.submit_transaction_hash)"
    Write-Host "Deliverable:    $($evidence.deliverable_url)"
    Write-Host "Promise ID:     $($evidence.promise_id)"
    Write-Host "Promise SHA256: $($evidence.promise_sha256)"
    Write-Host "Manifest hash verified: $($evidence.manifest_hash_verified)"
    Write-Host "Outcome Receipt verified: $($evidence.spondee_receipt_verified)"
    Write-Host "Public evidence file: $evidencePath" -ForegroundColor Cyan
    Write-Host 'No new create/register/budget/fund job was performed by this recovery runner.' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
}
finally {
    Clear-SensitiveEnvironment
    foreach ($name in @(
        'SPONDEE_LIVE_TESTNET_ENABLED','SPONDEE_SELLER_A2A_URL','SPONDEE_PROVIDER_ADDRESS',
        'SPONDEE_G3_RESUME_JOB_ID','SPONDEE_G3_TASK_PATH','SPONDEE_LIVE_EVIDENCE_PATH',
        'BNBAGENT_USE_PAYMASTER','AGENT_BIND_HOST','AGENT_PORT','ERC8183_AGENT_URL',
        'SPONDEE_LOCAL_DELIVERABLE_HOST','SPONDEE_LOCAL_DELIVERABLE_PORT','SPONDEE_LOCAL_DELIVERABLE_DIR'
    )) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }

    foreach ($proc in @($sellerProcess, $deliverableProcess)) {
        if ($proc -and -not $proc.HasExited) {
            try { & taskkill /PID $proc.Id /T /F 2>$null | Out-Null }
            catch { try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {} }
        }
    }

    Set-Location $initialLocation
    Write-Host "`nSensitive environment variables cleared. Recovery processes stopped." -ForegroundColor DarkGray
}
