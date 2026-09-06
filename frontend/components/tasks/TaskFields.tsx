import type { GridTask, HealthFactorTask, RebalancingTask, TimedPrice, YieldOption, YieldTask } from "@/lib/api/types";

type FieldProps<T> = {
  task: T;
  onChange: (task: T) => void;
};

export function HealthTaskFields({ task, onChange }: FieldProps<HealthFactorTask>) {
  return (
    <>
      <fieldset className="form-grid">
        <legend>Position</legend>
        <NumberField label="Collateral USD" value={task.position.collateral_usd} onChange={(value) => onChange({ ...task, position: { ...task.position, collateral_usd: value } })} />
        <NumberField label="Debt USD" value={task.position.debt_usd} onChange={(value) => onChange({ ...task, position: { ...task.position, debt_usd: value } })} />
        <NumberField label="Liquidation Threshold" value={task.position.liquidation_threshold} step="0.01" onChange={(value) => onChange({ ...task, position: { ...task.position, liquidation_threshold: value } })} />
        <NumberField label="HF Floor" value={task.hf_floor} step="0.01" onChange={(value) => onChange({ ...task, hf_floor: value })} />
        <NumberField label="Warning Lead Seconds" value={task.desired_warning_lead_seconds} onChange={(value) => onChange({ ...task, desired_warning_lead_seconds: value })} />
      </fieldset>
      <StressPathFields rows={task.stress_path} onChange={(stress_path) => onChange({ ...task, stress_path })} />
    </>
  );
}

export function GridTaskFields({ task, onChange }: FieldProps<GridTask>) {
  return (
    <>
      <fieldset className="form-grid">
        <legend>Grid Bounds</legend>
        <NumberField label="Capital USD" value={task.capital_usd} onChange={(value) => onChange({ ...task, capital_usd: value })} />
        <NumberField label="Lower Price" value={task.lower_price} onChange={(value) => onChange({ ...task, lower_price: value })} />
        <NumberField label="Upper Price" value={task.upper_price} onChange={(value) => onChange({ ...task, upper_price: value })} />
        <NumberField label="Levels" value={task.levels} min={2} max={50} onChange={(value) => onChange({ ...task, levels: value })} />
        <NumberField label="Fee BPS" value={task.fee_bps} onChange={(value) => onChange({ ...task, fee_bps: value })} />
        <NumberField label="Slippage BPS" value={task.slippage_bps} onChange={(value) => onChange({ ...task, slippage_bps: value })} />
      </fieldset>
      <PricePathFields rows={task.declared_price_path} onChange={(declared_price_path) => onChange({ ...task, declared_price_path })} />
    </>
  );
}

export function RebalancingTaskFields({ task, onChange }: FieldProps<RebalancingTask>) {
  return (
    <>
      <fieldset className="form-grid">
        <legend>Rebalance Policy</legend>
        <NumberField label="Capital USD" value={task.position.capital_usd} onChange={(value) => onChange({ ...task, position: { ...task.position, capital_usd: value } })} />
        <NumberField label="Lower Price" value={task.position.lower_price} onChange={(value) => onChange({ ...task, position: { ...task.position, lower_price: value } })} />
        <NumberField label="Upper Price" value={task.position.upper_price} onChange={(value) => onChange({ ...task, position: { ...task.position, upper_price: value } })} />
        <NumberField label="Target Width BPS" value={task.target_width_bps} onChange={(value) => onChange({ ...task, target_width_bps: value })} />
        <NumberField label="Reset Latency Seconds" value={task.reset_latency_seconds} onChange={(value) => onChange({ ...task, reset_latency_seconds: value })} />
        <NumberField label="Estimated Reset Cost USD" value={task.estimated_reset_cost_usd} step="0.01" onChange={(value) => onChange({ ...task, estimated_reset_cost_usd: value })} />
      </fieldset>
      <PricePathFields rows={task.declared_price_path} onChange={(declared_price_path) => onChange({ ...task, declared_price_path })} />
    </>
  );
}

export function YieldTaskFields({ task, onChange }: FieldProps<YieldTask>) {
  return (
    <>
      <fieldset className="form-grid">
        <legend>Allocation</legend>
        <NumberField label="Capital USD" value={task.capital_usd} onChange={(value) => onChange({ ...task, capital_usd: value })} />
        <NumberField label="Horizon Days" value={task.horizon_days} onChange={(value) => onChange({ ...task, horizon_days: value })} />
        <NumberField label="Max Risk Score" value={task.max_risk_score} onChange={(value) => onChange({ ...task, max_risk_score: value })} />
      </fieldset>
      <YieldOptionFields title="Current Option" option={task.current} onChange={(current) => onChange({ ...task, current })} />
      <fieldset className="path-table">
        <legend>Candidate Options</legend>
        {task.candidates.map((candidate, index) => (
          <div className="yield-row" key={`${candidate.id}-${index}`}>
            <TextField label="ID" value={candidate.id} onChange={(id) => updateCandidate(task, onChange, index, { ...candidate, id })} />
            <NumberField label="Gross APR %" value={candidate.gross_apr_pct} step="0.01" onChange={(gross_apr_pct) => updateCandidate(task, onChange, index, { ...candidate, gross_apr_pct })} />
            <NumberField label="Risk Score" value={candidate.risk_score} onChange={(risk_score) => updateCandidate(task, onChange, index, { ...candidate, risk_score })} />
            <NumberField label="Switch Cost USD" value={candidate.switch_cost_usd} step="0.01" onChange={(switch_cost_usd) => updateCandidate(task, onChange, index, { ...candidate, switch_cost_usd })} />
          </div>
        ))}
      </fieldset>
    </>
  );
}

function YieldOptionFields({ title, option, onChange }: { title: string; option: YieldOption; onChange: (option: YieldOption) => void }) {
  return (
    <fieldset className="form-grid">
      <legend>{title}</legend>
      <TextField label="ID" value={option.id} onChange={(id) => onChange({ ...option, id })} />
      <NumberField label="Gross APR %" value={option.gross_apr_pct} step="0.01" onChange={(gross_apr_pct) => onChange({ ...option, gross_apr_pct })} />
      <NumberField label="Risk Score" value={option.risk_score} onChange={(risk_score) => onChange({ ...option, risk_score })} />
      <NumberField label="Switch Cost USD" value={option.switch_cost_usd} step="0.01" onChange={(switch_cost_usd) => onChange({ ...option, switch_cost_usd })} />
    </fieldset>
  );
}

function PricePathFields({ rows, onChange }: { rows: TimedPrice[]; onChange: (rows: TimedPrice[]) => void }) {
  return (
    <fieldset className="path-table">
      <legend>Declared Price Path</legend>
      {rows.map((row, index) => (
        <div className="path-row" key={`${row.at_seconds}-${index}`}>
          <NumberField label="At Seconds" value={row.at_seconds} onChange={(at_seconds) => onChange(updateRow(rows, index, { ...row, at_seconds }))} />
          <NumberField label="Price" value={row.price} onChange={(price) => onChange(updateRow(rows, index, { ...row, price }))} />
        </div>
      ))}
    </fieldset>
  );
}

function StressPathFields({
  rows,
  onChange,
}: {
  rows: HealthFactorTask["stress_path"];
  onChange: (rows: HealthFactorTask["stress_path"]) => void;
}) {
  return (
    <fieldset className="path-table">
      <legend>Stress Path</legend>
      {rows.map((row, index) => (
        <div className="path-row stress-row" key={`${row.at_seconds}-${index}`}>
          <NumberField label="At Seconds" value={row.at_seconds} onChange={(at_seconds) => onChange(updateRow(rows, index, { ...row, at_seconds }))} />
          <NumberField label="Collateral Multiplier" value={row.collateral_multiplier} step="0.01" onChange={(collateral_multiplier) => onChange(updateRow(rows, index, { ...row, collateral_multiplier }))} />
          <NumberField label="Debt Multiplier" value={row.debt_multiplier} step="0.01" onChange={(debt_multiplier) => onChange(updateRow(rows, index, { ...row, debt_multiplier }))} />
        </div>
      ))}
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function updateRow<T>(rows: T[], index: number, next: T) {
  return rows.map((row, rowIndex) => (rowIndex === index ? next : row));
}

function updateCandidate(task: YieldTask, onChange: (task: YieldTask) => void, index: number, candidate: YieldOption) {
  onChange({ ...task, candidates: updateRow(task.candidates, index, candidate) });
}
