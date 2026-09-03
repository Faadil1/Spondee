param(
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[Spondee G3] $Message"
}

$initialLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$agentDir = Join-Path $workspaceRoot 'app\agent'
$walletDir = Join-Path $workspaceRoot '.studio\wallets'
$packageJson = Join-Path $agentDir 'package.json'
$pnpmVersion = '10.24.0'

Write-Host 'Spondee G3 - local BSC-testnet wallet setup' -ForegroundColor Green
Write-Host 'Uses the official @bnbagent/sdk wallet provider already pinned by Spondee.'
Write-Host 'No global Agent Studio CLI installation is required.' -ForegroundColor Green
Write-Host 'This script NEVER prints, commits, or uploads your wallet password/private key.'
Write-Host 'This wallet is testnet-only. Never reuse it on mainnet.' -ForegroundColor Yellow

if (-not (Test-Path $packageJson)) {
    Fail "package.json not found at $packageJson. Use the Spondee build/g3-health-factor checkout."
}

Write-Step 'Checking Node.js 22+'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js is not installed. Install Node.js 22+ first.'
}
$nodeRaw = (& node --version)
$nodeMajor = [int](($nodeRaw -replace '^v','').Split('.')[0])
if ($nodeMajor -lt 22) {
    Fail "Node.js $nodeRaw detected; Spondee requires Node.js 22+."
}
Write-Host "Node $nodeRaw"

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Fail 'npx is not available. Reinstall Node.js with npm/npx support.'
}

Write-Step "Installing frozen Spondee workspace dependencies with pnpm $pnpmVersion"
Set-Location $workspaceRoot
& npx --yes "pnpm@$pnpmVersion" install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Fail 'Frozen workspace dependency installation failed. No wallet was created.'
}

New-Item -ItemType Directory -Force -Path $walletDir | Out-Null

try {
    if ($VerifyOnly) {
        $prompt = 'Existing wallet password'
    }
    else {
        $prompt = 'NEW throwaway wallet password'
    }

    Write-Step "Enter $prompt"
    Write-Host 'Input is masked and stays only in this PowerShell process.' -ForegroundColor Yellow
    $secure = Read-Host $prompt -AsSecureString
    if ($secure.Length -lt 12) {
        Fail 'Use a wallet password of at least 12 characters.'
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

    if (-not $VerifyOnly) {
        Write-Step 'Creating encrypted Keystore V3 with the official BNB SDK'
        $createOutput = @(& npx --yes "pnpm@$pnpmVersion" wallet:create 2>&1)
        $createExit = $LASTEXITCODE
        $createOutput | ForEach-Object { Write-Host $_ }
        if ($createExit -ne 0) {
            Fail 'BNB SDK wallet creation failed. Do not fund any address unless this script reaches VERIFIED.'
        }

        Write-Step 'Reloading the encrypted keystore and proving local signing'
    }
    else {
        Write-Step 'Reloading the encrypted keystore and proving local signing'
    }

    $verifyOutput = @(& npx --yes "pnpm@$pnpmVersion" wallet:verify 2>&1)
    $verifyExit = $LASTEXITCODE
    $verifyOutput | ForEach-Object { Write-Host $_ }
    if ($verifyExit -ne 0) {
        Fail 'Wallet verification failed. Check the local password; do not send it to ChatGPT.'
    }

    $addressLine = $verifyOutput | Where-Object { $_ -match '^public_address=0x[a-fA-F0-9]{40}$' } | Select-Object -Last 1
    if (-not $addressLine) {
        Fail 'Wallet verified but the public address could not be parsed from the SDK output.'
    }
    $address = ($addressLine -replace '^public_address=', '').Trim()

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G3 TESTNET WALLET VERIFIED' -ForegroundColor Green
    Write-Host "Public address: $address" -ForegroundColor White
    Write-Host "Encrypted keystore directory: $walletDir" -ForegroundColor DarkGray
    Write-Host 'Local EIP-191 signing check: PASS (no transaction sent)' -ForegroundColor Green
    Write-Host 'Do NOT send the password, keystore, seed phrase, or private key.' -ForegroundColor Yellow
    Write-Host 'Send ChatGPT ONLY the public 0x address above.' -ForegroundColor Yellow
    Write-Host '============================================================' -ForegroundColor Green

    Write-Host "`nOfficial BSC testnet faucet:"
    Write-Host 'https://testnet.bnbchain.org/faucet-smart'
    Write-Host 'After funding, you may rerun this script with -VerifyOnly. It will not create a second wallet.'
}
finally {
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue
    Set-Location $initialLocation
    Write-Host "`nWALLET_PASSWORD removed from this PowerShell process." -ForegroundColor DarkGray
}
