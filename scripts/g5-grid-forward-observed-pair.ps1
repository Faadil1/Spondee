param(
    [switch]$Execute,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Fail([string]$m) { throw "[Spondee G5 Grid Forward] $m" }
function Tail([string]$p,[int]$n=30){ if(Test-Path $p){Get-Content $p -Tail $n -ErrorAction SilentlyContinue|ForEach-Object{Write-Host $_}}}
function Kill($p){if($p -and -not $p.HasExited){try{& taskkill /PID $p.Id /T /F 2>$null|Out-Null}catch{try{Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue}catch{}}}}
function Remove-Junction([string]$p){if(Test-Path $p){$i=Get-Item -LiteralPath $p -Force;if(($i.Attributes-band[System.IO.FileAttributes]::ReparsePoint)-eq 0){Fail "Refusing to remove non-junction wallet path: $p"};& cmd.exe /c rmdir "$p"|Out-Null}}
function Password-To-Env([Security.SecureString]$s){$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{$env:WALLET_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{if($b-ne[IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}}}
function Clear-Sensitive { @('WALLET_PASSWORD','BUYER_WALLET_PASSWORD','SPONDEE_WALLETS_DIR','SPONDEE_LIVE_TESTNET_ENABLED','SPONDEE_SELLER_A2A_URL','SPONDEE_PROVIDER_ADDRESS','SPONDEE_LIVE_EVIDENCE_PATH','SPONDEE_G4_CATEGORY','SPONDEE_G4_TASK_PATH','BNBAGENT_USE_PAYMASTER','AGENT_BIND_HOST','AGENT_PORT','ERC8183_AGENT_URL','SPONDEE_LOCAL_DELIVERABLE_HOST','SPONDEE_LOCAL_DELIVERABLE_PORT','SPONDEE_LOCAL_DELIVERABLE_DIR','SPONDEE_G5_FORWARD_MODE','SPONDEE_G5_FORWARD_PLAN_PATH','SPONDEE_G5_FORWARD_ACTIVATION_PATH')|ForEach-Object{Remove-Item "Env:$_" -ErrorAction SilentlyContinue} }

$initial=Get-Location
$scriptDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$root=(Resolve-Path (Join-Path $scriptDir '..')).Path
$backend=Join-Path $root 'backend'
$healthRoot=Join-Path $root 'reference-agents\health-factor'
$healthAgent=Join-Path $healthRoot 'app\agent'
$walletDir=Join-Path $healthRoot '.studio\wallets'
$gridRoot=Join-Path $root 'reference-agents\grid'
$gridAgent=Join-Path $gridRoot 'app\agent'
$gridData=Join-Path $gridAgent '.agent-data'
$gridStudio=Join-Path $gridRoot '.studio'
$walletJunction=Join-Path $gridStudio 'wallets'
$bridgeScript=Join-Path $scriptDir 'local-erc8183-deliverable-server.mjs'
$provider='0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8'
$pnpm='10.24.0'
$agentPort=9000
$bridgePort=9100
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$temp=Join-Path ([System.IO.Path]::GetTempPath()) "spondee-g5-grid-forward-$stamp"
$planPath=Join-Path $temp 'forward-plan.json'
$taskPath=Join-Path $temp 'marketplace-task.json'
$activationPath=Join-Path $temp 'activation-evidence.json'
$sellerOut=Join-Path $temp 'seller.out.log';$sellerErr=Join-Path $temp 'seller.err.log';$bridgeOut=Join-Path $temp 'bridge.out.log';$bridgeErr=Join-Path $temp 'bridge.err.log'
$seller=$null;$bridge=$null;$secure=$null

Write-Host 'Spondee G5 - Grid Forward OBSERVED Pair Runner' -ForegroundColor Green
Write-Host 'Preflight is read-only. Execution is a separate protected gate.' -ForegroundColor Yellow
Write-Host 'Closed jobs 949/954/955/957 must never be touched.' -ForegroundColor Yellow
Write-Host 'No mainnet write. No user capital. Forward Chainlink data only.' -ForegroundColor Yellow

try {
    Step 'Repository and runtime checks'
    $branch=(& git -C $root rev-parse --abbrev-ref HEAD).Trim();if($branch-ne'build/g4-sequential-live-e2e'){Fail "Wrong branch: $branch"}
    $node=(& node --version).Trim();if([int](($node-replace'^v','').Split('.')[0])-lt22){Fail 'Node 22+ required'}
    if(-not(Test-Path $bridgeScript)){Fail 'Missing local deliverable bridge'}
    if(-not(Test-Path $walletDir)){Fail 'Canonical seller wallet directory missing; do not create a new wallet'}
    New-Item -ItemType Directory -Force -Path $temp|Out-Null

    if(-not $SkipInstall){Step 'Installing backend dependencies';Set-Location $backend;& npm install --no-audit --no-fund;if($LASTEXITCODE-ne0){Fail 'Backend install failed'}}

    Step 'Freezing forward Grid plan from current read-only Chainlink anchor'
    $env:SPONDEE_G5_OUTPUT_DIR=$temp
    $env:SPONDEE_G5_FORWARD_MODE='preflight'
    Set-Location $backend
    & npx tsx src/g5-grid-forward-observed.ts
    if($LASTEXITCODE-ne0-or-not(Test-Path $planPath)-or-not(Test-Path $taskPath)){Fail 'Forward plan preflight failed'}
    $plan=Get-Content $planPath -Raw|ConvertFrom-Json
    if($plan.chain_write_attempted-ne$false-or$plan.wallet_used-ne$false-or$plan.countable_before_execution-ne$false){Fail 'Preflight truth boundary failed'}
    $task=Get-Content $taskPath -Raw|ConvertFrom-Json
    if($task.schema-ne'spondee.grid.task.v1'-or$task.evidence_class-ne'SIMULATION'){Fail 'Marketplace task truth class/schema mismatch'}
    if($task.declared_price_path.Count-ne2-or$task.declared_price_path[0].price-ne$task.declared_price_path[1].price){Fail 'Forward task contains future/look-ahead price data'}
    Write-Host "Frozen pair: $($plan.pair_id)" -ForegroundColor Green
    Write-Host "Anchor round: $($plan.anchor.round_id) @ $($plan.anchor.price_usd) USD" -ForegroundColor Green

    if(-not $Execute){
        Write-Host "`nSPONDEE G5 GRID FORWARD RUNNER PREFLIGHT: PASS" -ForegroundColor Green
        Write-Host "Plan: $planPath"
        Write-Host 'Execution was not attempted. Wallet was not unlocked. Chain write = false.' -ForegroundColor Green
        return
    }

    $required='I_AUTHORIZE_ONE_ZERO_PRICE_BSC_TESTNET_GRID_FORWARD_OBSERVED_ACTIVATION'
    if($env:SPONDEE_G5_GRID_FORWARD_EXECUTION_AUTHORIZATION-ne$required){Fail 'Execution gate is sealed. Missing exact one-run human authorization token.'}

    Step 'Unlocking and verifying canonical seller wallet locally'
    $secure=Read-Host 'Seller wallet password' -AsSecureString
    if($secure.Length-lt12){Fail 'Wallet password too short'}
    $env:SPONDEE_WALLETS_DIR=$walletDir;Password-To-Env $secure;Set-Location $healthAgent
    $verify=@(& npx --yes "pnpm@$pnpm" wallet:verify 2>&1);$exit=$LASTEXITCODE;Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue;Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue
    if($exit-ne0){$verify|ForEach-Object{Write-Host $_};Fail 'Seller wallet verification failed'}
    $addr=($verify|Where-Object{$_-match'^public_address=0x[a-fA-F0-9]{40}$'}|Select-Object -Last 1)-replace'^public_address=',''
    if($addr.ToLowerInvariant()-ne$provider.ToLowerInvariant()){Fail 'Canonical seller address mismatch'}

    if(-not $SkipInstall){Step 'Installing frozen Grid workspace';Set-Location $gridRoot;& npx --yes "pnpm@$pnpm" install --frozen-lockfile;if($LASTEXITCODE-ne0){Fail 'Grid workspace install failed'}}
    New-Item -ItemType Directory -Force -Path $gridStudio,$gridData|Out-Null
    if(Test-Path $walletJunction){Remove-Junction $walletJunction};New-Item -ItemType Junction -Path $walletJunction -Target $walletDir|Out-Null

    $env:SPONDEE_LOCAL_DELIVERABLE_HOST='127.0.0.1';$env:SPONDEE_LOCAL_DELIVERABLE_PORT="$bridgePort";$env:SPONDEE_LOCAL_DELIVERABLE_DIR=$gridData;$env:ERC8183_AGENT_URL="http://127.0.0.1:$bridgePort/erc8183"
    Step 'Starting local deliverable bridge'
    $bridge=Start-Process -FilePath (Get-Command node).Source -ArgumentList @($bridgeScript) -WorkingDirectory $root -RedirectStandardOutput $bridgeOut -RedirectStandardError $bridgeErr -PassThru -WindowStyle Hidden
    $deadline=(Get-Date).AddSeconds(20);$ok=$false;while((Get-Date)-lt$deadline){try{$h=Invoke-RestMethod -Uri "http://127.0.0.1:$bridgePort/health" -TimeoutSec 2;if($h.status-eq'HEALTHY'){$ok=$true;break}}catch{Start-Sleep -Milliseconds 500}};if(-not$ok){Tail $bridgeErr;Fail 'Bridge not healthy'}

    Step 'Starting Grid seller'
    $env:BNBAGENT_USE_PAYMASTER='1';$env:AGENT_BIND_HOST='127.0.0.1';$env:AGENT_PORT="$agentPort";$env:SPONDEE_WALLETS_DIR=$walletDir;Password-To-Env $secure
    $npx=Get-Command npx.cmd -ErrorAction SilentlyContinue;if(-not$npx){$npx=Get-Command npx -ErrorAction Stop}
    $seller=Start-Process -FilePath $npx.Source -ArgumentList @('--yes',"pnpm@$pnpm",'dev') -WorkingDirectory $gridAgent -RedirectStandardOutput $sellerOut -RedirectStandardError $sellerErr -PassThru -WindowStyle Hidden
    Remove-Item Env:WALLET_PASSWORD -ErrorAction SilentlyContinue;Remove-Item Env:SPONDEE_WALLETS_DIR -ErrorAction SilentlyContinue
    $deadline=(Get-Date).AddSeconds(75);$ok=$false;while((Get-Date)-lt$deadline){if($seller.HasExited){Tail $sellerOut;Tail $sellerErr;Fail 'Grid seller exited early'};try{$h=Invoke-RestMethod -Uri "http://127.0.0.1:$agentPort/ping" -TimeoutSec 3;if($h.status-eq'HEALTHY'-or$h.status-eq'HEALTHY_BUSY'){$ok=$true;break}}catch{Start-Sleep -Seconds 2}};if(-not$ok){Fail 'Grid seller not healthy'}

    Step 'Executing one zero-price BSC-testnet marketplace hire for the frozen forward scenario'
    $env:SPONDEE_LIVE_TESTNET_ENABLED='true';$env:SPONDEE_SELLER_A2A_URL="http://127.0.0.1:$agentPort/";$env:SPONDEE_PROVIDER_ADDRESS=$provider;$env:SPONDEE_LIVE_EVIDENCE_PATH=$activationPath;$env:SPONDEE_G4_CATEGORY='grid';$env:SPONDEE_G4_TASK_PATH=$taskPath;$env:BNBAGENT_USE_PAYMASTER='1'
    Set-Location $backend;& npm run --silent live:g4-category;$liveExit=$LASTEXITCODE
    if($liveExit-ne0-or-not(Test-Path $activationPath)){Tail $sellerOut;Tail $sellerErr;Fail 'Forward marketplace activation failed; do not retry blindly'}
    $act=Get-Content $activationPath -Raw|ConvertFrom-Json
    if($act.conclusion-ne'SPONDEE_G4_GRID_MEGAFUEL_LIVE_E2E_PASS'){Fail 'Marketplace activation did not end in Grid PASS'}
    if($act.scenario_id-ne$plan.scenario_id){Fail 'Activation scenario does not match frozen forward plan'}
    if($act.buyer_balance_before_wei-ne'0'-or$act.buyer_balance_after_wei-ne'0'){Fail 'Buyer zero-balance boundary failed'}

    Step 'Collecting strictly future Chainlink rounds and finalizing countable pair'
    $env:SPONDEE_G5_FORWARD_MODE='finalize';$env:SPONDEE_G5_FORWARD_PLAN_PATH=$planPath;$env:SPONDEE_G5_FORWARD_ACTIVATION_PATH=$activationPath;$env:SPONDEE_G5_OUTPUT_DIR=$temp
    & npx tsx src/g5-grid-forward-observed.ts
    if($LASTEXITCODE-ne0){Fail 'Forward observed pair finalization failed; preserve evidence and do not create another job'}
    $pairPath=Join-Path $temp 'pair-bundle.json';if(-not(Test-Path $pairPath)){Fail 'No pair bundle produced'}
    $pair=Get-Content $pairPath -Raw|ConvertFrom-Json
    if($pair.marketplace_hire.countable_for_final_report-ne$true){Fail 'Pair did not become countable'}
    Write-Host "`nSPONDEE G5 GRID FORWARD OBSERVED PAIR: PASS" -ForegroundColor Green
    Write-Host "Job ID: $($act.result.job_id)"
    Write-Host "Promise ID: $($act.result.promise_id)"
    Write-Host "Submit: $($act.result.transactions.submit)"
    Write-Host "Pair: $pairPath" -ForegroundColor Cyan
    Write-Host 'No realized mainnet PnL is claimed.' -ForegroundColor Yellow
}
finally {
    Clear-Sensitive;$secure=$null;Kill $seller;Kill $bridge;if(Test-Path $walletJunction){Remove-Junction $walletJunction};Set-Location $initial
    Write-Host "`nSensitive environment variables cleared." -ForegroundColor DarkGray
}
