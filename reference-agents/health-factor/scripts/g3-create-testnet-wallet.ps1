param(
    [switch]$SkipCliInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    throw "[Spondee G3] $Message"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$agentDir = Join-Path $workspaceRoot 'app\agent'
$studioDir = Join-Path $workspaceRoot '.studio'
$walletDir = Join-Path $studioDir 'wallets'
$studioToml = Join-Path $agentDir 'studio.toml'

Write-Host "Spondee G3 — local BSC-testnet wallet setup" -ForegroundColor Green
Write-Host "This script NEVER prints, commits, or uploads your wallet password/private key."
Write-Host "It creates a throwaway testnet wallet only. Never reuse it on mainnet." -ForegroundColor Yellow

if (-not (Test-Path $studioToml)) {
    Fail "studio.toml not found at $studioToml. Run this script from the Spondee build/g3-health-factor checkout."
}

Write-Step 'Checking Node.js 22+'
$nodeRaw = (& node --version 2>$null)
if (-not $nodeRaw) {
    Fail 'Node.js is not installed. Install Node.js 22+ first.'
}
$nodeMajor = [int](($nodeRaw -replace '^v','').Split('.')[0])
if ($nodeMajor -lt 22) {
    Fail "Node.js $nodeRaw detected; Agent Studio requires Node.js 22+."
}
Write-Host "Node $nodeRaw"

$bag = Get-Command bag -ErrorAction SilentlyContinue
if (-not $bag) {
    if ($SkipCliInstall) {
        Fail 'bag CLI not found and -SkipCliInstall was supplied.'
    }
    Write-Step 'Installing current BNB Agent Studio CLI'
    & npm install --global '@bnbagent/studio-cli'
    if ($LASTEXITCODE -ne 0) {
        Fail 'npm install --global @bnbagent/studio-cli failed.'
    }
}

Write-Step 'Checking Agent Studio CLI'
& bag --version
if ($LASTEXITCODE -ne 0) {
    Fail 'bag --version failed.'
}

New-Item -ItemType Directory -Force -Path $walletDir | Out-Null
Set-Location $agentDir

try {
    Write-Step 'Enter a NEW password for this throwaway testnet keystore'
    Write-Host 'The password is masked and stays only in this PowerShell process.' -ForegroundColor Yellow
    $secure = Read-Host 'Wallet password' -AsSecureString
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

    Write-Step 'Creating throwaway BSC-testnet wallet with bag wallet new'
    & bag wallet new
    if ($LASTEXITCODE -ne 0) {
        Fail 'bag wallet new failed.'
    }

    Write-Step 'Verifying public wallet identity'
    & bag wallet show
    if ($LASTEXITCODE -ne 0) {
        Fail 'bag wallet show failed.'
    }

    $toml = Get-Content -Raw $studioToml
    $match = [regex]::Match($toml, '(?m)^address\s*=\s*"(0x[a-fA-F0-9]{40})"\s*$')
    if (-not $match.Success) {
        Fail 'Wallet was created but [wallet].address was not found in studio.toml.'
    }
    $address = $match.Groups[1].Value

    Write-Step 'Running Agent Studio diagnostics'
    & bag doctor
    $doctorExit = $LASTEXITCODE

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G3 TESTNET WALLET CREATED' -ForegroundColor Green
    Write-Host "Public address: $address" -ForegroundColor White
    Write-Host "Keystore directory: $walletDir" -ForegroundColor DarkGray
    Write-Host 'Do NOT send the password, keystore, seed phrase, or private key.' -ForegroundColor Yellow
    Write-Host 'Send ChatGPT ONLY the public 0x address above.' -ForegroundColor Yellow
    Write-Host '============================================================' -ForegroundColor Green

    if ($doctorExit -ne 0) {
        Write-Warning 'bag doctor returned non-zero. This can be expected before the wallet receives tBNB; share only the public address and the non-secret warning text if needed.'
    }

    Write-Host "`nNext funding step (after sharing the public address):"
    Write-Host 'Official BSC testnet faucet: https://testnet.bnbchain.org/faucet-smart'
}
finally {
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue
    Write-Host "`nWALLET_PASSWORD removed from this PowerShell process." -ForegroundColor DarkGray
}
