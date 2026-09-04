param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[Spondee G4 Sequential Live] $Message"
}

function Tail-File([string]$Path, [int]$Count = 40) {
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

function Clear-LiveEnvironment {
    @(
        'WALLET_PASSWORD',
        'BUYER_WALLET_PASSWORD',
        'SPONDEE_WALLETS_DIR',
        'SPONDEE_LIVE_TESTNET_ENABLED',
        'SPONDEE_SELLER_A2A_URL',
        'SPONDEE_PROVIDER_ADDRESS',
        'SPONDEE_LIVE_EVIDENCE_PATH',
        'SPONDEE_G4_CATEGORY',
        'SPONDEE_G4_TASK_PATH',
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
$serverScript = Join-Path $scriptDir 'local-erc8183-deliverable-server.mjs'
$expectedProvider = '0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8'
$pnpmVersion = '10.24.0'
$agentPort = 9000
$bridgePort = 9100
$sellerUrl = "http://127.0.0.1:$agentPort/"
$bridgeBase = "http://127.0.0.1:$bridgePort"
$tempRoot = [System.IO.Path]::GetTempPath()
$securePassword = $null
$results = @()

$categories = @(
    @{
        slug = 'grid'
        schema = 'spondee.grid.task.v1'
        scenario = 'reference-agents\grid\demo\g4-live-scenario.json'
        pass = 'SPONDEE_G4_GRID_MEGAFUEL_LIVE_E2E_PASS'
    },
    @{
        slug = 'rebalancing'
        schema = 'spondee.rebalancing.task.v1'
        scenario = 'reference-agents\rebalancing\demo\g4-live-scenario.json'
        pass = 'SPONDEE_G4_REBALANCING_MEGAFUEL_LIVE_E2E_PASS'
    },
    @{
        slug = 'yield'
        schema = 'spondee.yield.task.v1'
        scenario = 'reference-agents\yield\demo\g4-live-scenario.json'
        pass = 'SPONDEE_G4_YIELD_MEGAFUEL_LIVE_E2E_PASS'
    }
)

Write-Host 'Spondee G4 - Sequential Grid -> Rebalancing -> Yield LIVE E2E' -ForegroundColor Green
Write-Host 'BSC Testnet only. Zero service price. MegaFuel primary. Stop-on-first-failure.'
Write-Host 'No mainnet, no user capital, no x402 payment, no final submission.' -ForegroundColor Yellow
Write-Host 'Never paste the seller password, keystore, seed phrase, or private key into chat.' -ForegroundColor Yellow

try {
    Write-Step 'Checking repository gate branch'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is not installed.' }
    $branch = (& git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { Fail 'Unable to read current branch.' }
    if ($branch -ne 'build/g4-sequential-live-e2e') {
        Fail "Current branch is '$branch'. Use build/g4-sequential-live-e2e for this gate."
    }
    Write-Host "Branch: $branch" -ForegroundColor Green

    if (-not (Test-Path $canonicalWalletDir)) {
        Fail "Canonical seller wallet directory is missing: $canonicalWalletDir. Do not create a new seller wallet."
    }
    if (-not (Test-Path $serverScript)) { Fail "Missing deliverable bridge: $serverScript" }
    if (-not (Test-Path (Join-Path $backendDir 'src\live-g4-category.ts'))) {
        Fail 'backend/src/live-g4-category.ts is missing. Pull the latest gate branch.'
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

        foreach ($category in $categories) {
            $root = Join-Path $repoRoot "reference-agents\$($category.slug)"
            Write-Step "Installing frozen $($category.slug) Agent Studio workspace"
            Set-Location $root
            & npx --yes "pnpm@$pnpmVersion" install --frozen-lockfile
            if ($LASTEXITCODE -ne 0) { Fail "$($category.slug) dependency installation failed." }
        }
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
        Fail 'Seller wallet verification failed. Check the local password; do not send it to ChatGPT.'
    }
    $addressLine = $verifyOutput | Where-Object { $_ -match '^public_address=0x[a-fA-F0-9]{40}$' } | Select-Object -Last 1
    if (-not $addressLine) { Fail 'Seller wallet verified but public address could not be parsed.' }
    $sellerAddress = ($addressLine -replace '^public_address=', '').Trim()
    if ($sellerAddress.ToLowerInvariant() -ne $expectedProvider.ToLowerInvariant()) {
        Fail "Seller keystore address $sellerAddress does not match canonical provider $expectedProvider."
    }
    Write-Host "Seller wallet: $sellerAddress" -ForegroundColor Green
    Write-Host 'Local signing verification: PASS' -ForegroundColor Green

    foreach ($category in $categories) {
        $slug = [string]$category.slug
        $agentRoot = Join-Path $repoRoot "reference-agents\$slug"
        $agentDir = Join-Path $agentRoot 'app\agent'
        $agentData = Join-Path $agentDir '.agent-data'
        $taskPath = Join-Path $repoRoot ([string]$category.scenario)
        $walletStudioDir = Join-Path $agentRoot '.studio'
        $walletJunction = Join-Path $walletStudioDir 'wallets'
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $sellerOut = Join-Path $tempRoot "spondee-g4-$slug-seller-$stamp.out.log"
        $sellerErr = Join-Path $tempRoot "spondee-g4-$slug-seller-$stamp.err.log"
        $bridgeOut = Join-Path $tempRoot "spondee-g4-$slug-bridge-$stamp.out.log"
        $bridgeErr = Join-Path $tempRoot "spondee-g4-$slug-bridge-$stamp.err.log"
        $evidencePath = Join-Path $tempRoot "spondee-g4-$slug-live-e2e-$stamp.json"
        $sellerProcess = $null
        $bridgeProcess = $null

        Write-Host "`n============================================================" -ForegroundColor Magenta
        Write-Host "G4 LIVE CATEGORY: $slug" -ForegroundColor Magenta
        Write-Host '============================================================' -ForegroundColor Magenta

        try {
            if (-not (Test-Path $taskPath)) { Fail "$slug scenario missing: $taskPath" }
            $task = Get-Content $taskPath -Raw | ConvertFrom-Json
            if ($task.schema -ne [string]$category.schema) {
                Fail "$slug scenario schema mismatch: $($task.schema)"
            }

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

            Write-Step "$slug: starting LocalStorage HTTP deliverable bridge"
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
                    Fail "$slug deliverable bridge exited with code $($bridgeProcess.ExitCode)."
                }
                try {
                    $health = Invoke-RestMethod -Uri "$bridgeBase/health" -Method Get -TimeoutSec 2
                    if ($health.status -eq 'HEALTHY') { $bridgeReady = $true; break }
                } catch { Start-Sleep -Milliseconds 500 }
            }
            if (-not $bridgeReady) { Fail "$slug deliverable bridge did not become healthy." }

            Write-Step "$slug: starting seller with MegaFuel enabled"
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

            Write-Step "$slug: waiting for seller /ping"
            $sellerReady = $false
            $sellerDeadline = (Get-Date).AddSeconds(75)
            while ((Get-Date) -lt $sellerDeadline) {
                if ($sellerProcess.HasExited) {
                    Write-Host '--- seller stdout ---'
                    Tail-File $sellerOut
                    Write-Host '--- seller stderr ---'
                    Tail-File $sellerErr
                    Fail "$slug seller exited with code $($sellerProcess.ExitCode)."
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
                Fail "$slug seller did not become healthy within 75 seconds."
            }
            Write-Host "$slug seller A2A: HEALTHY" -ForegroundColor Green

            Write-Step "$slug: executing Promise -> signed quote -> MegaFuel ERC-8183 -> verified Outcome Receipt"
            $env:SPONDEE_LIVE_TESTNET_ENABLED = 'true'
            $env:SPONDEE_SELLER_A2A_URL = $sellerUrl
            $env:SPONDEE_PROVIDER_ADDRESS = $expectedProvider
            $env:SPONDEE_LIVE_EVIDENCE_PATH = $evidencePath
            $env:SPONDEE_G4_CATEGORY = $slug
            $env:SPONDEE_G4_TASK_PATH = $taskPath
            $env:BNBAGENT_USE_PAYMASTER = '1'

            Set-Location $backendDir
            & npm run --silent live:g4-category
            $liveExit = $LASTEXITCODE

            if (-not (Test-Path $evidencePath)) {
                Write-Host '--- seller stdout ---'
                Tail-File $sellerOut
                Write-Host '--- seller stderr ---'
                Tail-File $sellerErr
                Fail "$slug live runner produced no public evidence file (exit=$liveExit)."
            }

            $evidence = Get-Content $evidencePath -Raw | ConvertFrom-Json
            if ($liveExit -ne 0 -or $evidence.conclusion -ne [string]$category.pass) {
                Write-Host "`n$slug failed closed. Public evidence:" -ForegroundColor Red
                Get-Content $evidencePath | ForEach-Object { Write-Host $_ }
                Write-Host '--- seller stdout tail ---'
                Tail-File $sellerOut
                Write-Host '--- seller stderr tail ---'
                Tail-File $sellerErr
                Fail "$slug did not pass. Sequential execution is stopped. Do not retry blindly."
            }

            if ($evidence.buyer_balance_before_wei -ne '0' -or $evidence.buyer_balance_after_wei -ne '0') {
                Fail "$slug buyer zero-balance MegaFuel boundary was not preserved."
            }
            if ($evidence.result.deliverable.manifest_hash_verified -ne $true) { Fail "$slug manifest hash was not verified." }
            if ($evidence.result.deliverable.spondee_receipt_verified -ne $true) { Fail "$slug Outcome Receipt was not verified." }
            if ($evidence.result.deliverable.receipt.evidence_class -ne 'SIMULATION') { Fail "$slug receipt truth class changed unexpectedly." }
            if ($evidence.observed_agent_advantage_claimed -ne $false) { Fail "$slug incorrectly claimed observed Agent Advantage." }

            $results += [PSCustomObject]@{
                category = $slug
                job_id = $evidence.result.job_id
                create_job = $evidence.result.transactions.create_job
                register_job = $evidence.result.transactions.register_job
                set_budget = $evidence.result.transactions.set_budget
                fund = $evidence.result.transactions.fund
                submit = $evidence.result.transactions.submit
                promise_id = $evidence.result.promise_id
                deliverable_url = $evidence.result.deliverable.url
                evidence_path = $evidencePath
            }

            Write-Host "`nSPONDEE G4 $($slug.ToUpperInvariant()) LIVE E2E: PASS" -ForegroundColor Green
            Write-Host "Job ID: $($evidence.result.job_id)"
            Write-Host "Promise ID: $($evidence.result.promise_id)"
            Write-Host "submit: $($evidence.result.transactions.submit)"
            Write-Host "Evidence: $evidencePath" -ForegroundColor Cyan
        }
        finally {
            Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_LIVE_TESTNET_ENABLED -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_SELLER_A2A_URL -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_PROVIDER_ADDRESS -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_LIVE_EVIDENCE_PATH -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_G4_CATEGORY -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_G4_TASK_PATH -ErrorAction SilentlyContinue
            Remove-Item Env:BNBAGENT_USE_PAYMASTER -ErrorAction SilentlyContinue
            Remove-Item Env:AGENT_BIND_HOST -ErrorAction SilentlyContinue
            Remove-Item Env:AGENT_PORT -ErrorAction SilentlyContinue
            Remove-Item Env:ERC8183_AGENT_URL -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_HOST -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_PORT -ErrorAction SilentlyContinue
            Remove-Item Env:SPONDEE_LOCAL_DELIVERABLE_DIR -ErrorAction SilentlyContinue
            Stop-ProcessTree $sellerProcess
            Stop-ProcessTree $bridgeProcess
            if (Test-Path $walletJunction) { Remove-WalletJunction $walletJunction }
            Start-Sleep -Milliseconds 500
        }
    }

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G4 THREE-CATEGORY SEQUENTIAL LIVE E2E: PASS' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    $results | Format-Table category, job_id, promise_id, submit -AutoSize
    Write-Host 'All receipts remain SIMULATION evidence; no observed Agent Advantage is claimed.' -ForegroundColor Green
    Write-Host 'Send ChatGPT only the PASS table and/or the public evidence JSON contents.' -ForegroundColor Yellow
    Write-Host 'Do NOT send the wallet password, keystore, seed phrase, or private key.' -ForegroundColor Yellow
}
finally {
    Clear-LiveEnvironment
    $securePassword = $null
    Set-Location $initialLocation
    Write-Host "`nSensitive environment variables cleared." -ForegroundColor DarkGray
}
