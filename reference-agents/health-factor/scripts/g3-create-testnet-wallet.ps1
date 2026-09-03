param(
    [switch]$SkipCliInstall,
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
$studioDir = Join-Path $workspaceRoot '.studio'
$walletDir = Join-Path $studioDir 'wallets'
$studioToml = Join-Path $agentDir 'studio.toml'
$studioCliVersion = '0.0.13'

Write-Host 'Spondee G3 - local BSC-testnet wallet setup' -ForegroundColor Green
Write-Host 'This script NEVER prints, commits, or uploads your wallet password/private key.'
Write-Host 'This wallet is testnet-only. Never reuse it on mainnet.' -ForegroundColor Yellow

if (-not (Test-Path $studioToml)) {
    Fail "studio.toml not found at $studioToml. Use the Spondee build/g3-health-factor checkout."
}

Write-Step 'Checking Node.js 22+'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js is not installed. Install Node.js 22+ first.'
}
$nodeRaw = (& node --version)
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
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Fail 'npm is not available; install Node.js 22+ with npm first.'
    }

    Write-Step "Installing BNB Agent Studio CLI $studioCliVersion"
    Write-Host 'Using --legacy-peer-deps to bypass a temporary upstream AI SDK peer-version mismatch.' -ForegroundColor DarkGray
    & npm install --global "@bnbagent/studio-cli@$studioCliVersion" --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Fail "npm install --global @bnbagent/studio-cli@$studioCliVersion --legacy-peer-deps failed. Do not create a wallet yet."
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
    $existingToml = Get-Content -Raw $studioToml
    $existingAddressMatch = [regex]::Match(
        $existingToml,
        '(?m)^address\s*=\s*"(0x[a-fA-F0-9]{40})"\s*$'
    )
    $existingKeystores = @(Get-ChildItem -Path $walletDir -Filter '*.json' -File -ErrorAction SilentlyContinue)

    if (-not $VerifyOnly -and ($existingAddressMatch.Success -or $existingKeystores.Count -gt 0)) {
        Write-Host 'An existing local wallet was detected. Refusing to create another one.' -ForegroundColor Yellow
        Write-Host 'Use -VerifyOnly to inspect the existing throwaway wallet.' -ForegroundColor Yellow
        if ($existingAddressMatch.Success) {
            Write-Host "Existing public address: $($existingAddressMatch.Groups[1].Value)"
        }
        exit 2
    }

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

    if (-not $VerifyOnly) {
        Write-Step 'Creating throwaway BSC-testnet wallet with bag wallet new'
        & bag wallet new
        if ($LASTEXITCODE -ne 0) {
            Fail 'bag wallet new failed.'
        }
    }

    Write-Step 'Verifying public wallet identity'
    & bag wallet show
    if ($LASTEXITCODE -ne 0) {
        Fail 'bag wallet show failed. Check that the password matches the local keystore.'
    }

    $toml = Get-Content -Raw $studioToml
    $match = [regex]::Match($toml, '(?m)^address\s*=\s*"(0x[a-fA-F0-9]{40})"\s*$')
    if (-not $match.Success) {
        Fail '[wallet].address was not found in studio.toml after wallet verification.'
    }
    $address = $match.Groups[1].Value

    Write-Step 'Running Agent Studio diagnostics'
    & bag doctor
    $doctorExit = $LASTEXITCODE

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host 'SPONDEE G3 TESTNET WALLET VERIFIED' -ForegroundColor Green
    Write-Host "Public address: $address" -ForegroundColor White
    Write-Host "Keystore directory: $walletDir" -ForegroundColor DarkGray
    Write-Host 'Do NOT send the password, keystore, seed phrase, or private key.' -ForegroundColor Yellow
    Write-Host 'Send ChatGPT ONLY the public 0x address above.' -ForegroundColor Yellow
    Write-Host '============================================================' -ForegroundColor Green

    if ($doctorExit -ne 0) {
        Write-Warning 'bag doctor returned non-zero. Before funding, a missing or zero tBNB balance can be expected. Share only the public address and non-secret warning text if needed.'
    }

    Write-Host "`nOfficial BSC testnet faucet:"
    Write-Host 'https://testnet.bnbchain.org/faucet-smart'
    Write-Host 'After funding, rerun this same script with -VerifyOnly to re-check the wallet and diagnostics.'
}
finally {
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable secure -ErrorAction SilentlyContinue
    Set-Location $initialLocation
    Write-Host "`nWALLET_PASSWORD removed from this PowerShell process." -ForegroundColor DarkGray
}