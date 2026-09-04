param(
    [switch]$Execute,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Fail([string]$Message) { throw "[Spondee G5 Grid Forward] $Message" }
function Tail-File([string]$Path, [int]$Count = 50) { if (Test-Path $Path) { Get-Content $Path -Tail $Count -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ } } }
function Stop-ProcessTree($Process) {
    if ($Process -and -not $Process.HasExited) {
        try { & taskkill /PID $Process.Id /T /F 2>$null | Out-Null }
        catch { try { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue } catch {} }
    }
}
function Remove-WalletJunction([string]$Path) {
    if (Test-Path $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { Fail "Refusing to remove non-junction wallet path: $Path" }
        & cmd.exe /c rmdir "$Path" | Out-Null
        if ($LASTEXITCODE -ne 0 -and (Test-Path $Path)) { Fail "Failed to remove wallet junction: $Path" }
    }
}
function Set-WalletPasswordForChild([Security.SecureString]$SecurePassword) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try { $env:WALLET_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) } }
}
function Clear-G5Environment {
    @(
        'WALLET_PASSWORD','SPONDEE_WALLETS_DIR','SPONDEE_LIVE_TESTNET_ENABLED','SPONDEE_PROVIDER_ADDRESS',
        'SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED','SPONDEE_G5_GRID_FORWARD_HUMAN_GATE','SPONDEE_G5_GRID_FORWARD_SELLER_URL',
        'SPONDEE_G5_OUTPUT_DIR','BNBAGENT_USE_PAYMASTER','AGENT_PORT','ERC8183_AGENT_URL',
        'SPONDEE_LOCAL_DELIVERABLE_HOST','SPONDEE_LOCAL_DELIVERABLE_PORT','SPONDEE_LOCAL_DELIVERABLE_DIR'
    ) | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
}

$initialLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$backendDir = Join-Path $repoRoot 'backend'
$gridRoot = Join-Path $repoRoot 'reference-agents\grid'
$gridAgentDir = Join-Path $gridRoot 'app\agent'
$healthRoot = Join-Path $repoRoot 'reference-agents\health-factor'
$healthAgentDir = Join-Path $healthRoot 'app\agent'
$canonicalWalletDir = Join-Path $healthRoot '.studio\wallets'
$walletStudioDir = Join-Path $gridRoot '.studio'
$walletJunction = Join-Path $walletStudioDir 'wallets'
$agentData = Join-Path $gridAgentDir '.agent-data'
$serverScript = Join-Path $scriptDir 'local-erc8183-deliverable-server.mjs'
$expectedProvider = '0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8'
$expectedGate = 'SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED'
$pnpmVersion = '10.24.0'
$agentPort = 9000
$bridgePort = 9100
$sellerUrl = "http://127.0.0.1:$agentPort/"
$bridgeBase = "http://127.0.0.1:$bridgePort"
$tempRoot = [System.IO.Path]::GetTempPath()
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDir = Join-Path $tempRoot "spondee-g5-grid-forward-$stamp"
$sellerOut = Join-Path $tempRoot "spondee-g5-grid-forward-seller-$stamp.out.log"
$sellerErr = Join-Path $tempRoot "spondee-g5-grid-forward-seller-$stamp.err.log"
$bridgeOut = Join-Path $tempRoot "spondee-g5-grid-forward-bridge-$stamp.out.log"
$bridgeErr = Join-Path $tempRoot "spondee-g5-grid-forward-bridge-$stamp.err.log"
$securePassword = $null
$sellerProcess = $null
$bridgeProcess = $null

Write-Host 'Spondee G5 - Grid forward observed pair runner' -ForegroundColor Green
Write-Host 'Jobs 949, 954, 955 and 957 are CLOSED and must not be touched.' -ForegroundColor Yellow
Write-Host 'Mainnet access is Chainlink read-only. No mainnet value movement is implemented.' -ForegroundColor Yellow

try {
    Write-Step 'Checking repository gate branch'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is not installed.' }
    $branch = (& git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { Fail 'Unable to read current branch.' }
    if ($branch -ne 'build/g5-grid-forward-observed') { Fail "Current branch is '$branch'. Use build/g5-grid-forward-observed." }
    Write-Host "Branch: $branch" -ForegroundColor Green

    Write-Step 'Checking Node.js 22+'
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
    }

    if (-not $Execute) {
        Write-Step 'Running read-only forward-window preflight'
        Remove-Item Env:SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED -ErrorAction SilentlyContinue
        Set-Location $backendDir
        & npx tsx src/g5-grid-forward-preflight.ts
        if ($LASTEXITCODE -ne 0) { Fail 'Forward preflight failed.' }
        Write-Host "`nSPONDEE G5 GRID FORWARD RUNNER PREFLIGHT: PASS" -ForegroundColor Green
        Write-Host 'No wallet was unlocked and no chain write was attempted.' -ForegroundColor Green
        return
    }

    if ($env:SPONDEE_G5_GRID_FORWARD_HUMAN_GATE -ne $expectedGate) {
        Fail "-Execute is protected. Set SPONDEE_G5_GRID_FORWARD_HUMAN_GATE=$expectedGate only after that human gate is explicitly opened."
    }
    if (-not (Test-Path $canonicalWalletDir)) { Fail "Canonical seller wallet directory missing: $canonicalWalletDir. Do not create a new seller wallet." }
    if (-not (Test-Path $serverScript)) { Fail "Missing deliverable bridge: $serverScript" }
    if (-not (Test-Path (Join-Path $gridAgentDir 'src\g5ForwardServer.ts'))) { Fail 'G5 forward seller server missing.' }

    if (-not $SkipInstall) {
        Write-Step 'Installing frozen Grid Agent Studio workspace'
        Set-Location $gridRoot
        & npx --yes "pnpm@$pnpmVersion" install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { Fail 'Grid dependency installation failed.' }
    }

    Write-Step 'Unlocking and verifying existing canonical seller wallet locally'
    $securePassword = Read-Host 'Seller wallet password' -AsSecureString
    if ($securePassword.Length -lt 12) { Fail 'Wallet password must contain at least 12 characters.' }
    $env:SPONDEE_WALLETS_DIR = $canonicalWalletDir
    Set-WalletPasswordForChild $securePassword
    Set-Location $healthAgentDir
    $verifyOutput = @(& npx --yes "pnpm@$pnpmVersion" wallet:verify 2>&1)
    $verifyExit = $LASTEXITCODE
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue
    if ($verifyExit -ne 0) { $verifyOutput | ForEach-Object { Write-Host $_ }; Fail 'Seller wallet verification failed.' }
    $addressLine = $verifyOutput | Where-Object { $_ -match '^public_address=0x[a-fA-F0-9]{40}$' } | Select-Object -Last 1
    if (-not $addressLine) { Fail 'Seller wallet address could not be parsed.' }
    $sellerAddress = ($addressLine -replace '^public_address=', '').Trim()
    if ($sellerAddress.ToLowerInvariant() -ne $expectedProvider.ToLowerInvariant()) { Fail "Seller address $sellerAddress does not match canonical provider." }
    Write-Host "Seller wallet: $sellerAddress" -ForegroundColor Green

    New-Item -ItemType Directory -Force -Path $walletStudioDir | Out-Null
    if (Test-Path $walletJunction) {
        $existing = Get-Item -LiteralPath $walletJunction -Force
        if (($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { Fail "Unexpected real wallet directory at $walletJunction" }
        Remove-WalletJunction $walletJunction
    }
    New-Item -ItemType Junction -Path $walletJunction -Target $canonicalWalletDir | Out-Null
    New-Item -ItemType Directory -Force -Path $agentData | Out-Null

    $env:SPONDEE_LOCAL_DELIVERABLE_HOST = '127.0.0.1'
    $env:SPONDEE_LOCAL_DELIVERABLE_PORT = "$bridgePort"
    $env:SPONDEE_LOCAL_DELIVERABLE_DIR = $agentData
    $env:ERC8183_AGENT_URL = "$bridgeBase/erc8183"

    Write-Step 'Starting LocalStorage HTTP deliverable bridge'
    $bridgeProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @($serverScript) -WorkingDirectory $repoRoot -RedirectStandardOutput $bridgeOut -RedirectStandardError $bridgeErr -PassThru -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(20); $ready = $false
    while ((Get-Date) -lt $deadline) {
        if ($bridgeProcess.HasExited) { Tail-File $bridgeOut; Tail-File $bridgeErr; Fail 'Deliverable bridge exited early.' }
        try { $health = Invoke-RestMethod -Uri "$bridgeBase/health" -Method Get -TimeoutSec 2; if ($health.status -eq 'HEALTHY') { $ready = $true; break } } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { Fail 'Deliverable bridge did not become healthy.' }

    Write-Step 'Starting specialized Grid forward observed seller'
    $env:BNBAGENT_USE_PAYMASTER = '1'
    $env:AGENT_PORT = "$agentPort"
    $env:SPONDEE_WALLETS_DIR = $canonicalWalletDir
    Set-WalletPasswordForChild $securePassword
    $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npxCommand) { $npxCommand = Get-Command npx -ErrorAction Stop }
    $sellerProcess = Start-Process -FilePath $npxCommand.Source -ArgumentList @('--yes', "pnpm@$pnpmVersion", 'exec', 'tsx', 'src/g5ForwardServer.ts') -WorkingDirectory $gridAgentDir -RedirectStandardOutput $sellerOut -RedirectStandardError $sellerErr -PassThru -WindowStyle Hidden
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue

    $sellerDeadline = (Get-Date).AddSeconds(75); $sellerReady = $false
    while ((Get-Date) -lt $sellerDeadline) {
        if ($sellerProcess.HasExited) { Tail-File $sellerOut; Tail-File $sellerErr; Fail 'G5 Grid seller exited before ready.' }
        try { $ping = Invoke-RestMethod -Uri "http://127.0.0.1:$agentPort/ping" -Method Get -TimeoutSec 3; if ($ping.status -eq 'HEALTHY') { $sellerReady = $true; break } } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $sellerReady) { Tail-File $sellerOut; Tail-File $sellerErr; Fail 'G5 Grid seller did not become healthy.' }

    Write-Step 'Executing ONE forward Grid marketplace pair'
    $env:SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED = 'true'
    $env:SPONDEE_LIVE_TESTNET_ENABLED = 'true'
    $env:SPONDEE_G5_GRID_FORWARD_SELLER_URL = $sellerUrl
    $env:SPONDEE_PROVIDER_ADDRESS = $expectedProvider
    $env:SPONDEE_G5_OUTPUT_DIR = $outputDir
    $env:BNBAGENT_USE_PAYMASTER = '1'
    Set-Location $backendDir
    & npx tsx src/live-g5-grid-forward.ts
    $liveExit = $LASTEXITCODE
    if ($liveExit -ne 0) {
        Write-Host '--- seller stdout tail ---' -ForegroundColor Yellow; Tail-File $sellerOut
        Write-Host '--- seller stderr tail ---' -ForegroundColor Yellow; Tail-File $sellerErr
        Fail "G5 Grid forward pair failed closed (exit=$liveExit). Do not retry blindly."
    }
    $resultPath = Join-Path $outputDir 'final-result.json'
    if (-not (Test-Path $resultPath)) { Fail 'Execution returned success but final-result.json is missing.' }
    $result = Get-Content $resultPath -Raw | ConvertFrom-Json
    if ($result.conclusion -ne 'SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_PASS' -or $result.countable_for_final_report -ne $true) { Fail 'Final G5 Grid evidence did not satisfy the countable pair contract.' }

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G5 GRID FORWARD OBSERVED PAIR: PASS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host "Job ID: $($result.job_id)"
    Write-Host "Pair ID: $($result.pair_id)"
    Write-Host "Promise ID: $($result.promise_id)"
    Write-Host "Observed rounds: $($result.observed_round_count)"
    Write-Host "Evidence: $resultPath"
    Write-Host 'No mainnet value moved; paper returns are not realized PnL.' -ForegroundColor Yellow
}
finally {
    Stop-ProcessTree $sellerProcess
    Stop-ProcessTree $bridgeProcess
    if (Test-Path $walletJunction) { try { Remove-WalletJunction $walletJunction } catch {} }
    Clear-G5Environment
    Set-Location $initialLocation
    Write-Host 'Sensitive environment variables cleared.' -ForegroundColor Green
}
