import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createPublicClient, getAddress, http } from "viem";
import { buildValidatedObservedAdvantageReport, sha256Evidence, validateObservedPairBundle } from "./observed-evidence.js";

const RPC = process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";
const FEED = getAddress("0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE");
const OUTPUT_DIR = resolve(process.env.SPONDEE_G5_OUTPUT_DIR?.trim() || ".g5-grid-forward");
const ROUND_TARGET = Number(process.env.SPONDEE_G5_FORWARD_ROUND_TARGET || "12");
const CAPITAL_USD = 10_000;
const LEVELS = 9;
const HALF_WIDTH_PCT = 0.15;
const FEE_BPS = 10;
const SLIPPAGE_BPS = 5;

const abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ]},
  { type: "function", name: "getRoundData", stateMutability: "view", inputs: [{ name: "_roundId", type: "uint80" }], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ]},
] as const;

export type ForwardRound = { round_id: string; price_usd: number; updated_at: string };
export type ForwardPlan = {
  schema: "spondee.g5-grid-forward-plan.v1";
  pair_id: string;
  scenario_id: string;
  frozen_at: string;
  anchor: ForwardRound;
  strategy: { capital_usd: number; levels: number; half_width_pct: number; fee_bps: number; slippage_bps: number; lower_price: number; upper_price: number };
  marketplace: { network: "bsc-testnet"; service_price_raw: "0"; category: "grid"; task_schema: "spondee.grid.task.v1"; execution_authorized: false };
  forward_window: { starts_only_after_provider_submit: true; minimum_rounds: number };
  chain_write_attempted: false;
  wallet_used: false;
  countable_before_execution: false;
};

type ActivationEvidence = {
  category: string;
  network: string;
  started_at: string;
  completed_at: string;
  task_schema: string;
  scenario_id: string;
  service_price_raw: string;
  result: {
    job_id: string;
    promise_id: string;
    promise_sha256: string;
    status: string;
    transactions: { create_job: string; register_job: string; set_budget: string; fund: string; submit: string };
    deliverable?: { manifest_hash_verified?: boolean; spondee_receipt_verified?: boolean };
  };
};

type StrategyResult = {
  strategy: string; initial_equity_usd: number; terminal_equity_usd: number; gross_return_pct: number; net_return_pct: number; max_drawdown_pct: number;
  estimated_execution_friction_usd: number; fill_count: number; wins: number; losses: number; flat: number; final_cash_usd: number; final_bnb: number; parameters: Record<string, unknown>;
};

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function r(value: number, digits = 8): number { const p = 10 ** digits; return Math.round(value * p) / p; }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") { const o = value as Record<string, unknown>; return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`; } return JSON.stringify(value); }
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function maxDrawdown(equity: number[]): number { let peak = equity[0] ?? 0; let max = 0; for (const v of equity) { peak = Math.max(peak, v); if (peak > 0) max = Math.max(max, ((peak - v) / peak) * 100); } return r(max, 6); }

export function buildForwardPlan(anchor: ForwardRound, frozenAt: string): ForwardPlan {
  const lower = anchor.price_usd * (1 - HALF_WIDTH_PCT / 100);
  const upper = anchor.price_usd * (1 + HALF_WIDTH_PCT / 100);
  const suffix = `${anchor.round_id}-${frozenAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
  return {
    schema: "spondee.g5-grid-forward-plan.v1",
    pair_id: `g5-grid-forward-${suffix}`,
    scenario_id: `g5-grid-forward-${suffix}`,
    frozen_at: frozenAt,
    anchor,
    strategy: { capital_usd: CAPITAL_USD, levels: LEVELS, half_width_pct: HALF_WIDTH_PCT, fee_bps: FEE_BPS, slippage_bps: SLIPPAGE_BPS, lower_price: r(lower), upper_price: r(upper) },
    marketplace: { network: "bsc-testnet", service_price_raw: "0", category: "grid", task_schema: "spondee.grid.task.v1", execution_authorized: false },
    forward_window: { starts_only_after_provider_submit: true, minimum_rounds: ROUND_TARGET },
    chain_write_attempted: false,
    wallet_used: false,
    countable_before_execution: false,
  };
}

export function buildMarketplaceTask(plan: ForwardPlan) {
  return {
    schema: "spondee.grid.task.v1",
    scenario_id: plan.scenario_id,
    evidence_class: "SIMULATION",
    capital_usd: plan.strategy.capital_usd,
    lower_price: plan.strategy.lower_price,
    upper_price: plan.strategy.upper_price,
    levels: plan.strategy.levels,
    fee_bps: plan.strategy.fee_bps,
    slippage_bps: plan.strategy.slippage_bps,
    declared_price_path: [
      { at_seconds: 0, price: plan.anchor.price_usd },
      { at_seconds: 1, price: plan.anchor.price_usd },
    ],
  } as const;
}

export function validateActivationForPlan(plan: ForwardPlan, activation: ActivationEvidence): ActivationEvidence {
  assert(activation.category === "grid", "activation category must be grid");
  assert(activation.network === "bsc-testnet", "activation must be on bsc-testnet");
  assert(activation.task_schema === "spondee.grid.task.v1", "activation task schema mismatch");
  assert(activation.scenario_id === plan.scenario_id, "activation scenario must match frozen forward plan");
  assert(activation.service_price_raw === "0", "forward observed activation must remain zero-price");
  assert(/^0x[0-9a-fA-F]{64}$/.test(activation.result.transactions.submit), "activation requires exact provider submit tx");
  assert(activation.result.job_id.length > 0, "activation requires job id");
  assert(activation.result.promise_id.length > 0, "activation requires promise id");
  assert(Date.parse(activation.started_at) >= Date.parse(plan.frozen_at), "activation cannot predate frozen plan");
  return activation;
}

function crossed(a: number, b: number, level: number): "UP" | "DOWN" | null { if (a < level && b >= level) return "UP"; if (a > level && b <= level) return "DOWN"; return null; }
export function evaluateForwardGrid(plan: ForwardPlan, rounds: ForwardRound[]): StrategyResult {
  const levels = Array.from({ length: plan.strategy.levels }, (_, i) => plan.strategy.lower_price + i * ((plan.strategy.upper_price - plan.strategy.lower_price) / (plan.strategy.levels - 1)));
  const perFillQuote = plan.strategy.capital_usd / (plan.strategy.levels * 4);
  const frictionRate = (plan.strategy.fee_bps + plan.strategy.slippage_bps) / 10_000;
  const first = rounds[0]!.price_usd;
  let cash = plan.strategy.capital_usd / 2;
  let bnb = (plan.strategy.capital_usd / 2) / first;
  let friction = 0; let fills = 0;
  const equity = [cash + bnb * first]; const interval: number[] = [];
  for (let i = 1; i < rounds.length; i++) {
    const prev = rounds[i - 1]!.price_usd; const next = rounds[i]!.price_usd;
    const events = levels.map(level => ({ level, direction: crossed(prev, next, level) })).filter((x): x is { level:number; direction:"UP"|"DOWN" } => x.direction !== null).sort((a,b) => next >= prev ? a.level-b.level : b.level-a.level);
    for (const e of events) {
      if (e.direction === "DOWN") { const quote = Math.min(perFillQuote, cash/(1+frictionRate)); if (quote <= 0) continue; const cost = quote*frictionRate; cash -= quote+cost; bnb += quote/e.level; friction += cost; fills++; }
      else { const units = Math.min(perFillQuote/e.level, bnb); if (units <= 0) continue; const gross = units*e.level; const cost = gross*frictionRate; cash += gross-cost; bnb -= units; friction += cost; fills++; }
    }
    const current = cash + bnb*next; interval.push(current-equity[equity.length-1]!); equity.push(current);
  }
  const terminal = equity.at(-1)!; const net = ((terminal/plan.strategy.capital_usd)-1)*100; const gross = net + (friction/plan.strategy.capital_usd)*100; const eps=1e-8;
  return { strategy:"bounded_symmetric_paper_grid_committed_before_forward_window", initial_equity_usd:plan.strategy.capital_usd, terminal_equity_usd:r(terminal,6), gross_return_pct:r(gross,6), net_return_pct:r(net,6), max_drawdown_pct:maxDrawdown(equity), estimated_execution_friction_usd:r(friction,6), fill_count:fills, wins:interval.filter(v=>v>eps).length, losses:interval.filter(v=>v< -eps).length, flat:interval.filter(v=>Math.abs(v)<=eps).length, final_cash_usd:r(cash,6), final_bnb:r(bnb,10), parameters:{...plan.strategy,no_lookahead_configuration:true,anchor_round_id:plan.anchor.round_id} };
}

export function evaluateForwardBaseline(plan: ForwardPlan, rounds: ForwardRound[]): StrategyResult {
  const first=rounds[0]!.price_usd; const cash=plan.strategy.capital_usd/2; const bnb=(plan.strategy.capital_usd/2)/first; const eq=rounds.map(x=>cash+bnb*x.price_usd); const terminal=eq.at(-1)!; const interval=eq.slice(1).map((v,i)=>v-eq[i]!); const eps=1e-8;
  return { strategy:"without_agent_static_50_50_buy_and_hold", initial_equity_usd:plan.strategy.capital_usd, terminal_equity_usd:r(terminal,6), gross_return_pct:r(((terminal/plan.strategy.capital_usd)-1)*100,6), net_return_pct:r(((terminal/plan.strategy.capital_usd)-1)*100,6), max_drawdown_pct:maxDrawdown(eq), estimated_execution_friction_usd:0, fill_count:0, wins:interval.filter(v=>v>eps).length, losses:interval.filter(v=>v< -eps).length, flat:interval.filter(v=>Math.abs(v)<=eps).length, final_cash_usd:cash, final_bnb:r(bnb,10), parameters:{capital_usd:plan.strategy.capital_usd,starting_allocation:"50% USD / 50% BNB",rebalance_or_grid_actions:0} };
}

export function buildCountableForwardBundle(plan: ForwardPlan, activation: ActivationEvidence, rounds: ForwardRound[], agentSeconds: number, baselineSeconds: number, artifactUris: Record<string,{uri:string;sha256:string}>) {
  validateActivationForPlan(plan, activation);
  assert(rounds.length >= plan.forward_window.minimum_rounds, `need at least ${plan.forward_window.minimum_rounds} forward rounds`);
  const submittedAt = Date.parse(activation.completed_at);
  assert(rounds.every(x => Date.parse(x.updated_at) > submittedAt), "all observed rounds must be strictly after marketplace activation completion");
  const startAt=rounds[0]!.updated_at; const endAt=rounds.at(-1)!.updated_at; assert(Date.parse(endAt)>Date.parse(startAt), "forward observation window must be positive");
  const agent=evaluateForwardGrid(plan,rounds); const baseline=evaluateForwardBaseline(plan,rounds);
  const mkArtifact=(kind:string,id:string,key:string,source_type:string,source_locator:string)=>({artifact_id:id,kind,uri:artifactUris[key]!.uri,sha256:artifactUris[key]!.sha256,captured_at:endAt,source_type,source_locator});
  const baselineId=`${plan.pair_id}-baseline`; const agentId=`${plan.pair_id}-agent`;
  const bundle={
    schema:"spondee.agent-advantage-pair.v1", pair_id:plan.pair_id, frozen_at:plan.frozen_at, category:"Grid Trading", scenario_id:plan.scenario_id, observation_mode:"LIVE_PUBLIC_DATA_TASK",
    observation_window:{start_at:startAt,end_at:endAt}, initial_state_sha256:digest({anchor:plan.anchor,strategy:plan.strategy}), input_snapshot_sha256:artifactUris.input.sha256,
    marketplace_hire:{mode:"LIVE_BSC_TESTNET_MARKETPLACE",agent_transport:"ERC8183_BSC_TESTNET",promise_before_observation:true,activation_reference:`bsc-testnet:erc8183:job:${activation.result.job_id}:submit:${activation.result.transactions.submit}`,countable_for_final_report:true},
    agent_run:{run_id:agentId,category:"Grid Trading",scenario_id:plan.scenario_id,agent_id:"spondee-grid-agent",version:"g5-forward-v1",evidence_class:"OBSERVED",promise_timestamp:activation.started_at,expected_outcome:{strategy:"grid committed before forward market window"},confidence:null,expected_downside:{bounded_testnet_hire:true,paper_market_evaluation:true},expected_cost:{service_price_raw:"0"},tx_hashes:Object.values(activation.result.transactions),actual_outcome:agent,actual_cost:{service_price_raw:"0",paper_execution_friction_usd:agent.estimated_execution_friction_usd},output_artifacts:[artifactUris.agent.uri],baseline_type:"WITHOUT_AGENT_STATIC_50_50",baseline_run_id:baselineId,advantage_delta:{terminal_equity_usd:r(agent.terminal_equity_usd-baseline.terminal_equity_usd,6),net_return_percentage_points:r(agent.net_return_pct-baseline.net_return_pct,6),max_drawdown_percentage_points:r(agent.max_drawdown_pct-baseline.max_drawdown_pct,6)},calibration_error:null,notes:"Observed forward public market-data evaluation after a zero-price BSC-testnet marketplace hire; no realized mainnet trade."},
    baseline_run:{run_id:baselineId,category:"Grid Trading",scenario_id:plan.scenario_id,agent_id:"without-agent",version:"g5-forward-v1",evidence_class:"OBSERVED",promise_timestamp:plan.frozen_at,expected_outcome:{strategy:"static 50/50 baseline"},confidence:null,expected_downside:{market_exposure:true},expected_cost:{amount_usd:0},tx_hashes:[],actual_outcome:baseline,actual_cost:{amount_usd:0},output_artifacts:[artifactUris.baseline.uri],baseline_type:null,baseline_run_id:null,advantage_delta:null,calibration_error:null,notes:"Without-agent baseline on the exact same forward window and starting allocation."},
    time_seconds:{name:"measured_execution_time",unit:"seconds",agent_value:agentSeconds,baseline_value:baselineSeconds,higher_is_better:false}, cost:{name:"user_paid_marketplace_cost",unit:"usd",agent_value:0,baseline_value:0,higher_is_better:false}, output_quality:{name:"terminal_equity",unit:"usd",agent_value:agent.terminal_equity_usd,baseline_value:baseline.terminal_equity_usd,higher_is_better:true},
    artifacts:[mkArtifact("INPUT_SNAPSHOT",`${plan.pair_id}-input`,"input","BSC_MAINNET_RPC_READ_ONLY",`chainlink:${FEED}`),mkArtifact("MARKET_DATA",`${plan.pair_id}-market`,"market","BSC_MAINNET_RPC_READ_ONLY",`chainlink:${FEED}`),mkArtifact("AGENT_OUTPUT",`${plan.pair_id}-agent-output`,"agent","LOCAL_RUNTIME_MEASUREMENT","g5-forward-grid"),mkArtifact("BASELINE_OUTPUT",`${plan.pair_id}-baseline-output`,"baseline","MANUAL_BASELINE_MEASUREMENT","static-50-50"),mkArtifact("TIMING_LOG",`${plan.pair_id}-timing`,"timing","LOCAL_RUNTIME_MEASUREMENT","node-performance"),mkArtifact("COST_LOG",`${plan.pair_id}-cost`,"cost","LOCAL_RUNTIME_MEASUREMENT","zero-price-plus-paper-friction"),mkArtifact("TRANSACTION_TAPE",`${plan.pair_id}-tx`,"tx","BSC_TESTNET_RPC",`job:${activation.result.job_id}`)],
    trading_record:{window_start_at:startAt,window_end_at:endAt,wins:agent.wins,losses:agent.losses,flat:agent.flat,max_drawdown_pct:agent.max_drawdown_pct,gross_return_pct:agent.gross_return_pct,net_return_pct:agent.net_return_pct,risk_basis:"$10,000 paper notional evaluated on forward Chainlink BNB/USD after zero-price BSC-testnet marketplace hire; no mainnet capital moved",execution_environment:"OBSERVED_MARKET_DATA_REPLAY"},
    limitations:["Marketplace hire is on BSC testnet at zero service price.","Trading result is a forward public-market-data paper evaluation, not realized mainnet PnL.","Agent strategy parameters were frozen from the anchor round before the observation window."], claim_guardrail:"OBSERVED means the task inputs, execution measurements and attached outputs are preserved from an actual measured run or observed-data replay. It does not imply realized mainnet profit or guarantee future performance."
  };
  return validateObservedPairBundle(bundle);
}

async function latestRound(): Promise<{round:ForwardRound;block:string;decimals:number;description:string}> {
  const client=createPublicClient({transport:http(RPC,{timeout:15_000})}); assert(await client.getChainId()===56,"expected BSC mainnet chain 56");
  const [block,decimals,description,latest]=await Promise.all([client.getBlockNumber(),client.readContract({address:FEED,abi,functionName:"decimals"}),client.readContract({address:FEED,abi,functionName:"description"}),client.readContract({address:FEED,abi,functionName:"latestRoundData"})]);
  const [roundId,answer,,updatedAt]=latest; assert(answer>0n&&updatedAt>0n,"invalid Chainlink anchor round");
  return {round:{round_id:roundId.toString(),price_usd:Number(answer)/10**Number(decimals),updated_at:new Date(Number(updatedAt)*1000).toISOString()},block:block.toString(),decimals:Number(decimals),description:String(description)};
}

async function save(name:string,value:unknown){await mkdir(OUTPUT_DIR,{recursive:true}); const content=`${JSON.stringify(value,null,2)}\n`; const path=resolve(OUTPUT_DIR,name); await writeFile(path,content,"utf8"); return {path,uri:`file://${path.replaceAll("\\","/")}`,sha256:sha256Evidence(content)};}

async function preflightMain(){const anchor=await latestRound(); const plan=buildForwardPlan(anchor.round,new Date().toISOString()); const task=buildMarketplaceTask(plan); const planFile=await save("forward-plan.json",plan); const taskFile=await save("marketplace-task.json",task); console.log(JSON.stringify({schema:"spondee.g5-grid-forward-runner-preflight.v1",plan,source_block:anchor.block,feed_description:anchor.description,plan_path:planFile.path,task_path:taskFile.path,wallet_used:false,chain_write_attempted:false,user_capital_used:false,execution_authorized:false,countable_pair_created:false,conclusion:"SPONDEE_G5_GRID_FORWARD_RUNNER_PREFLIGHT_PASS"},null,2));}

async function collectForwardRounds(afterIso:string):Promise<ForwardRound[]> { const client=createPublicClient({transport:http(RPC,{timeout:15_000})}); const decimals=await client.readContract({address:FEED,abi,functionName:"decimals"}); const found=new Map<string,ForwardRound>(); while(found.size<ROUND_TARGET){ const latest=await client.readContract({address:FEED,abi,functionName:"latestRoundData"}); const latestId=latest[0]; for(let off=BigInt(Math.max(ROUND_TARGET*3,36));off>=0n;off--){try{const x=await client.readContract({address:FEED,abi,functionName:"getRoundData",args:[latestId-off]});const[id,answer,,updatedAt]=x;if(answer>0n&&updatedAt>0n){const item={round_id:id.toString(),price_usd:Number(answer)/10**Number(decimals),updated_at:new Date(Number(updatedAt)*1000).toISOString()};if(Date.parse(item.updated_at)>Date.parse(afterIso))found.set(item.round_id,item);}}catch{} if(off===0n)break;} if(found.size>=ROUND_TARGET)break; await new Promise(r=>setTimeout(r,15_000)); } return [...found.values()].sort((a,b)=>Date.parse(a.updated_at)-Date.parse(b.updated_at)).slice(0,ROUND_TARGET); }

async function finalizeMain(){const planPath=process.env.SPONDEE_G5_FORWARD_PLAN_PATH; const activationPath=process.env.SPONDEE_G5_FORWARD_ACTIVATION_PATH; assert(planPath&&activationPath,"finalize requires plan and activation paths"); const plan=JSON.parse(await readFile(planPath,"utf8")) as ForwardPlan; const activation=validateActivationForPlan(plan,JSON.parse(await readFile(activationPath,"utf8")) as ActivationEvidence); const rounds=await collectForwardRounds(activation.completed_at); const input=await save("input-snapshot.json",{plan,activation_reference:{job_id:activation.result.job_id,promise_id:activation.result.promise_id,submit_tx:activation.result.transactions.submit},rounds}); const market=await save("market-data.json",{feed:FEED,rounds}); const a0=performance.now(); const agent=evaluateForwardGrid(plan,rounds); const agentSeconds=(performance.now()-a0)/1000; const b0=performance.now(); const baseline=evaluateForwardBaseline(plan,rounds); const baselineSeconds=(performance.now()-b0)/1000; const agentF=await save("agent-output.json",agent); const baseF=await save("baseline-output.json",baseline); const timing=await save("timing-log.json",{agent_value:agentSeconds,baseline_value:baselineSeconds,unit:"seconds"}); const cost=await save("cost-log.json",{agent_user_paid_marketplace_cost_usd:0,baseline_cost_usd:0,agent_paper_execution_friction_usd:agent.estimated_execution_friction_usd}); const tx=await save("transaction-tape.json",activation.result.transactions); const uris={input,market,agent:agentF,baseline:baseF,timing,cost,tx}; const bundle=buildCountableForwardBundle(plan,activation,rounds,agentSeconds,baselineSeconds,uris); await save("pair-bundle.json",bundle); const report=buildValidatedObservedAdvantageReport([bundle]); assert(report.paired_run_count===1,"forward countable Grid pair should contribute exactly one pair"); console.log(JSON.stringify({schema:"spondee.g5-grid-forward-observed-pair.pass.v1",pair_id:plan.pair_id,job_id:activation.result.job_id,promise_id:activation.result.promise_id,submit_tx:activation.result.transactions.submit,observed_round_count:rounds.length,observation_window:bundle.observation_window,agent_output:agent,baseline_output:baseline,countable_for_final_report:true,paired_run_count_after_execution:report.paired_run_count,report_status_after_execution:report.status,wallet_secret_printed:false,mainnet_chain_write_attempted:false,user_capital_used:false,realized_mainnet_pnl_claimed:false,conclusion:"SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_PASS"},null,2));}

const mode=process.env.SPONDEE_G5_FORWARD_MODE?.trim()||"preflight"; if(mode==="preflight") await preflightMain(); else if(mode==="finalize") await finalizeMain(); else throw new Error(`unsupported SPONDEE_G5_FORWARD_MODE: ${mode}`);
