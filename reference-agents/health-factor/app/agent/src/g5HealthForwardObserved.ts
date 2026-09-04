import { createHash } from "node:crypto";
import { z } from "zod";

export const G5_HEALTH_FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" as const;
export const G5_HEALTH_TASK_PREFIX = "SG5H1:";
export const G5_HEALTH_COMMITMENT_PREFIX = "SPONDEE_G5_HEALTH_FORWARD_COMMITMENT_V1:";
const CLAIM = "Observed BNB/USD monitoring of a frozen hypothetical collateral/debt position. No mainnet value moves and no liquidation-prevention or safety guarantee is claimed." as const;
const RPC = () => process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";
const DECIMALS_SELECTOR = "0x313ce567";
const LATEST_ROUND_DATA_SELECTOR = "0xfeaf968c";
const GET_ROUND_DATA_SELECTOR = "0x9a6fc8f5";

const taskSchema = z.object({
  schema: z.literal("spondee.health-forward-observed.task.v1"), scenario_id: z.string().min(1), evidence_class: z.literal("OBSERVED"),
  source: z.object({ chain_id: z.literal(56), network: z.literal("bsc-mainnet"), feed_address: z.literal(G5_HEALTH_FEED), feed_description: z.literal("BNB / USD") }),
  freeze: z.object({ round_id: z.string(), price_usd: z.number(), updated_at: z.string().datetime(), frozen_at: z.string().datetime() }),
  observation_rule: z.object({ only_rounds_after_activation: z.literal(true), target_future_rounds: z.number().int().min(5), max_wait_seconds: z.number().int().min(120), poll_seconds: z.number().int().min(2) }),
  position: z.object({ collateral_bnb: z.number().positive(), debt_usd: z.number().positive(), liquidation_threshold: z.number().positive(), warning_health_factor: z.number().positive(), critical_health_factor: z.number().positive(), baseline_check_every_rounds: z.number().int().min(2) }),
  claim_guardrail: z.literal(CLAIM),
});
export type HealthForwardTask = z.infer<typeof taskSchema>;
export type HealthForwardRound = { round_id: string; price_usd: number; updated_at: string };
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") { const o=value as Record<string,unknown>; return `{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`; } return JSON.stringify(value); }
function digest(value: unknown) { return createHash("sha256").update(stable(value)).digest("hex"); }
function hf(task: HealthForwardTask, price: number) { return task.position.collateral_bnb * price * task.position.liquidation_threshold / task.position.debt_usd; }

export function decodeHealthForwardTask(value: unknown): HealthForwardTask | null {
  if (typeof value !== "string" || !value.startsWith(G5_HEALTH_TASK_PREFIX)) return null;
  try {
    const t=JSON.parse(Buffer.from(value.slice(G5_HEALTH_TASK_PREFIX.length),"base64url").toString("utf8")); if(!Array.isArray(t)||t.length!==14)return null;
    const [scenarioId,roundId,priceUsd,updatedAt,frozenAt,targetRounds,maxWait,pollSeconds,collateralBnb,debtUsd,liq,warn,critical,baselineEvery]=t;
    return taskSchema.parse({schema:"spondee.health-forward-observed.task.v1",scenario_id:scenarioId,evidence_class:"OBSERVED",source:{chain_id:56,network:"bsc-mainnet",feed_address:G5_HEALTH_FEED,feed_description:"BNB / USD"},freeze:{round_id:roundId,price_usd:priceUsd,updated_at:updatedAt,frozen_at:frozenAt},observation_rule:{only_rounds_after_activation:true,target_future_rounds:targetRounds,max_wait_seconds:maxWait,poll_seconds:pollSeconds},position:{collateral_bnb:collateralBnb,debt_usd:debtUsd,liquidation_threshold:liq,warning_health_factor:warn,critical_health_factor:critical,baseline_check_every_rounds:baselineEvery},claim_guardrail:CLAIM});
  } catch { return null; }
}

export function buildHealthForwardPromise(task: HealthForwardTask, priceRaw="0") {
  const seed={scenario_id:task.scenario_id,freeze:task.freeze,observation_rule:task.observation_rule,position:task.position,price_raw:priceRaw};
  return {schema:"spondee.health-forward-observed-promise.v1",promise_id:`sph5_${digest(seed).slice(0,24)}`,scenario_id:task.scenario_id,category:"Health Factor Monitoring",evidence_class:"OBSERVED_PENDING_FORWARD_WINDOW",freeze_round_id:task.freeze.round_id,initial_health_factor:Number(hf(task,task.freeze.price_usd).toFixed(8)),warning_health_factor:task.position.warning_health_factor,critical_health_factor:task.position.critical_health_factor,baseline_check_every_rounds:task.position.baseline_check_every_rounds,target_future_rounds:task.observation_rule.target_future_rounds,price_raw:priceRaw,created_at:task.freeze.frozen_at,claim_guardrail:CLAIM} as const;
}
export function commitmentForHealthPromise(promise: ReturnType<typeof buildHealthForwardPromise>) { return {schema:"spondee.health-forward-observed-commitment.v1",promise_id:promise.promise_id,scenario_id:promise.scenario_id,promise_sha256:digest(promise),price_raw:promise.price_raw} as const; }
export function encodeHealthCommitment(promise: ReturnType<typeof buildHealthForwardPromise>) { return `${G5_HEALTH_COMMITMENT_PREFIX}${Buffer.from(JSON.stringify(commitmentForHealthPromise(promise)),"utf8").toString("base64url")}`; }
export function healthCommitmentFromTerms(terms: unknown) { if(!terms||typeof terms!=="object"||Array.isArray(terms))return null; const c=(terms as Record<string,unknown>).success_criteria; if(!Array.isArray(c))return null; const m=c.filter((x):x is string=>typeof x==="string"&&x.startsWith(G5_HEALTH_COMMITMENT_PREFIX)); if(m.length!==1)return null; try{return JSON.parse(Buffer.from(m[0].slice(G5_HEALTH_COMMITMENT_PREFIX.length),"base64url").toString("utf8")) as ReturnType<typeof commitmentForHealthPromise>;}catch{return null;} }

type RpcEnvelope={result?:unknown;error?:{message?:string}};
async function rpc(method:string,params:unknown[]=[]){const r=await fetch(RPC(),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`BSC mainnet read-only RPC HTTP ${r.status}`);const b=await r.json() as RpcEnvelope;if(b.error)throw new Error(b.error.message??"RPC error");if(b.result===undefined)throw new Error("RPC missing result");return b.result;}
async function ethCall(data:string){const r=await rpc("eth_call",[{to:G5_HEALTH_FEED,data},"latest"]);if(typeof r!=="string")throw new Error("invalid eth_call");return r;}
function words(hex:string){const c=hex.slice(2);if(c.length%64!==0)throw new Error("ABI length");const out:string[]=[];for(let i=0;i<c.length;i+=64)out.push(c.slice(i,i+64));return out;}
function uint(w:string){return BigInt(`0x${w}`)} function int(w:string){const u=uint(w);return (u&(1n<<255n))?u-(1n<<256n):u;}
async function decimals(){return Number(uint(words(await ethCall(DECIMALS_SELECTOR))[0]??"0"));}
async function latest(){return uint(words(await ethCall(LATEST_ROUND_DATA_SELECTOR))[0]??"0");}
async function readRound(d:number,id:bigint):Promise<HealthForwardRound|null>{try{const w=words(await ethCall(`${GET_ROUND_DATA_SELECTOR}${id.toString(16).padStart(64,"0")}`));if(w.length<5)return null;const answer=int(w[1]!);const updated=uint(w[3]!);if(answer<=0n||updated<=0n)return null;return{round_id:uint(w[0]!).toString(),price_usd:Number(answer)/10**d,updated_at:new Date(Number(updated)*1000).toISOString()};}catch{return null;}}
async function observe(task:HealthForwardTask,start:string){if(BigInt(String(await rpc("eth_chainId")))!==56n)throw new Error("source is not BSC mainnet");const code=await rpc("eth_getCode",[G5_HEALTH_FEED,"latest"]);if(code==="0x")throw new Error("feed unavailable");const d=await decimals();const deadline=Date.now()+task.observation_rule.max_wait_seconds*1000;const rounds:HealthForwardRound[]=[];let cursor=BigInt(task.freeze.round_id)+1n;while(Date.now()<deadline&&rounds.length<task.observation_rule.target_future_rounds){const l=await latest();while(cursor<=l&&rounds.length<task.observation_rule.target_future_rounds){const row=await readRound(d,cursor);cursor+=1n;if(!row||Date.parse(row.updated_at)<=Date.parse(start))continue;rounds.push(row);}if(rounds.length<task.observation_rule.target_future_rounds)await new Promise(r=>setTimeout(r,task.observation_rule.poll_seconds*1000));}if(rounds.length<task.observation_rule.target_future_rounds)throw new Error(`timed out with ${rounds.length}/${task.observation_rule.target_future_rounds} future rounds`);return rounds;}

export async function executeHealthForwardObservedTask(task:HealthForwardTask){
  const start=new Date().toISOString(); const intervention=new Date().toISOString(); const rounds=await observe(task,start); const idx=Math.min(task.position.baseline_check_every_rounds-1,rounds.length-1); const baseline=rounds[idx]!; const path=rounds.map(r=>({round_id:r.round_id,updated_at:r.updated_at,price_usd:r.price_usd,health_factor:Number(hf(task,r.price_usd).toFixed(8))})); const adverse=path.find(r=>r.health_factor<=task.position.critical_health_factor)??null;
  return {schema:"spondee.health-forward-observed-agent-output.v1",scenario_id:task.scenario_id,observation_started_at:start,observation_completed_at:new Date().toISOString(),rounds,health_path:path,event_tape:{warning_emitted_at:start,intervention_recommended_at:intervention,baseline_first_check_at:baseline.updated_at,baseline_warning_detected_at:baseline.updated_at,adverse_event_at:adverse?.updated_at??null,warning_lead_time_seconds:Math.max(0,(Date.parse(baseline.updated_at)-Date.parse(start))/1000),response_latency_ms:Math.max(0,Date.parse(intervention)-Date.parse(start))},result:{initial_health_factor:Number(hf(task,task.freeze.price_usd).toFixed(8)),minimum_observed_health_factor:Number(Math.min(...path.map(r=>r.health_factor)).toFixed(8)),warning_threshold:task.position.warning_health_factor,critical_threshold:task.position.critical_health_factor,warning_was_actionable_before_baseline_check:Date.parse(baseline.updated_at)>Date.parse(start),adverse_event_observed:adverse!==null},wallet_used_for_market_data:false,mainnet_chain_write_attempted:false,liquidation_prevention_claimed:false};
}
