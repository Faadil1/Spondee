import pg from "pg";
import type {
  ActivationRecord,
  EvidenceRun,
  OutcomeReceipt,
  PromiseCard,
} from "./contracts.js";

const { Pool } = pg;

function byCreatedAt<T extends { created_at: string }>(values: T[]): T[] {
  return [...values].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export interface SpondeeStore {
  init(): Promise<void>;
  putPromise(value: PromiseCard): Promise<void>;
  getPromise(id: string): Promise<PromiseCard | null>;
  listPromises(): Promise<PromiseCard[]>;
  putActivation(value: ActivationRecord): Promise<void>;
  getActivation(id: string): Promise<ActivationRecord | null>;
  listActivations(): Promise<ActivationRecord[]>;
  putReceipt(value: OutcomeReceipt): Promise<void>;
  getReceipt(id: string): Promise<OutcomeReceipt | null>;
  listReceipts(): Promise<OutcomeReceipt[]>;
  putEvidence(value: EvidenceRun): Promise<void>;
  getEvidence(id: string): Promise<EvidenceRun | null>;
  listEvidence(): Promise<EvidenceRun[]>;
  claimOperation(key: string, ttlSeconds: number): Promise<boolean>;
  releaseOperation(key: string): Promise<void>;
  close(): Promise<void>;
}

export class MemoryStore implements SpondeeStore {
  readonly promises = new Map<string, PromiseCard>();
  readonly activations = new Map<string, ActivationRecord>();
  readonly receipts = new Map<string, OutcomeReceipt>();
  readonly evidence = new Map<string, EvidenceRun>();
  readonly operationLocks = new Map<string, number>();

  async init(): Promise<void> {}
  async close(): Promise<void> {}

  async putPromise(value: PromiseCard): Promise<void> {
    this.promises.set(value.promise_id, structuredClone(value));
  }
  async getPromise(id: string): Promise<PromiseCard | null> {
    const value = this.promises.get(id);
    return value ? structuredClone(value) : null;
  }
  async listPromises(): Promise<PromiseCard[]> {
    return byCreatedAt([...this.promises.values()]).map((value) => structuredClone(value));
  }
  async putActivation(value: ActivationRecord): Promise<void> {
    this.activations.set(value.activation_id, structuredClone(value));
  }
  async getActivation(id: string): Promise<ActivationRecord | null> {
    const value = this.activations.get(id);
    return value ? structuredClone(value) : null;
  }
  async listActivations(): Promise<ActivationRecord[]> {
    return byCreatedAt([...this.activations.values()]).map((value) => structuredClone(value));
  }
  async putReceipt(value: OutcomeReceipt): Promise<void> {
    this.receipts.set(value.receipt_id, structuredClone(value));
  }
  async getReceipt(id: string): Promise<OutcomeReceipt | null> {
    const value = this.receipts.get(id);
    return value ? structuredClone(value) : null;
  }
  async listReceipts(): Promise<OutcomeReceipt[]> {
    return byCreatedAt([...this.receipts.values()]).map((value) => structuredClone(value));
  }
  async putEvidence(value: EvidenceRun): Promise<void> {
    this.evidence.set(value.run_id, structuredClone(value));
  }
  async getEvidence(id: string): Promise<EvidenceRun | null> {
    const value = this.evidence.get(id);
    return value ? structuredClone(value) : null;
  }
  async listEvidence(): Promise<EvidenceRun[]> {
    return [...this.evidence.values()].map((value) => structuredClone(value));
  }
  async claimOperation(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.operationLocks.get(key);
    if (existing && existing > now) return false;
    this.operationLocks.set(key, now + Math.max(1, ttlSeconds) * 1000);
    return true;
  }
  async releaseOperation(key: string): Promise<void> {
    this.operationLocks.delete(key);
  }
}

const DDL = `
CREATE TABLE IF NOT EXISTS spondee_promises (
  promise_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS spondee_activations (
  activation_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  promise_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS spondee_receipts (
  receipt_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  promise_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS spondee_evidence_runs (
  run_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  evidence_class TEXT NOT NULL,
  baseline_run_id TEXT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS spondee_operation_locks (
  operation_key TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spondee_promises_category ON spondee_promises(category);
CREATE INDEX IF NOT EXISTS idx_spondee_activations_status ON spondee_activations(status);
CREATE INDEX IF NOT EXISTS idx_spondee_evidence_class ON spondee_evidence_runs(evidence_class);
CREATE INDEX IF NOT EXISTS idx_spondee_operation_locks_expiry ON spondee_operation_locks(expires_at);
`;

export class PostgresStore implements SpondeeStore {
  private readonly pool: InstanceType<typeof Pool>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5 });
  }

  async init(): Promise<void> {
    await this.pool.query(DDL);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async putPromise(value: PromiseCard): Promise<void> {
    await this.pool.query(
      `INSERT INTO spondee_promises (promise_id, category, scenario_id, agent_id, payload)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (promise_id) DO UPDATE SET payload=EXCLUDED.payload`,
      [value.promise_id, value.category, value.scenario_id, value.agent_id, JSON.stringify(value)],
    );
  }

  async getPromise(id: string): Promise<PromiseCard | null> {
    const result = await this.pool.query<{ payload: PromiseCard }>(
      "SELECT payload FROM spondee_promises WHERE promise_id=$1",
      [id],
    );
    return result.rows[0]?.payload ?? null;
  }

  async listPromises(): Promise<PromiseCard[]> {
    const result = await this.pool.query<{ payload: PromiseCard }>(
      "SELECT payload FROM spondee_promises ORDER BY created_at ASC",
    );
    return result.rows.map((row) => row.payload);
  }

  async putActivation(value: ActivationRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO spondee_activations
       (activation_id, category, scenario_id, agent_id, promise_id, status, payload, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())
       ON CONFLICT (activation_id) DO UPDATE SET status=EXCLUDED.status, payload=EXCLUDED.payload, updated_at=NOW()`,
      [
        value.activation_id,
        value.category,
        value.scenario_id,
        value.agent_id,
        value.promise_id,
        value.status,
        JSON.stringify(value),
      ],
    );
  }

  async getActivation(id: string): Promise<ActivationRecord | null> {
    const result = await this.pool.query<{ payload: ActivationRecord }>(
      "SELECT payload FROM spondee_activations WHERE activation_id=$1",
      [id],
    );
    return result.rows[0]?.payload ?? null;
  }

  async listActivations(): Promise<ActivationRecord[]> {
    const result = await this.pool.query<{ payload: ActivationRecord }>(
      "SELECT payload FROM spondee_activations ORDER BY updated_at ASC",
    );
    return result.rows.map((row) => row.payload);
  }

  async putReceipt(value: OutcomeReceipt): Promise<void> {
    await this.pool.query(
      `INSERT INTO spondee_receipts (receipt_id, category, scenario_id, agent_id, promise_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (receipt_id) DO UPDATE SET payload=EXCLUDED.payload`,
      [
        value.receipt_id,
        value.category,
        value.scenario_id,
        value.agent_id,
        value.promise_id,
        JSON.stringify(value),
      ],
    );
  }

  async getReceipt(id: string): Promise<OutcomeReceipt | null> {
    const result = await this.pool.query<{ payload: OutcomeReceipt }>(
      "SELECT payload FROM spondee_receipts WHERE receipt_id=$1",
      [id],
    );
    return result.rows[0]?.payload ?? null;
  }

  async listReceipts(): Promise<OutcomeReceipt[]> {
    const result = await this.pool.query<{ payload: OutcomeReceipt }>(
      "SELECT payload FROM spondee_receipts ORDER BY created_at ASC",
    );
    return result.rows.map((row) => row.payload);
  }

  async putEvidence(value: EvidenceRun): Promise<void> {
    await this.pool.query(
      `INSERT INTO spondee_evidence_runs
       (run_id, category, scenario_id, agent_id, evidence_class, baseline_run_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (run_id) DO UPDATE SET payload=EXCLUDED.payload`,
      [
        value.run_id,
        value.category,
        value.scenario_id,
        value.agent_id,
        value.evidence_class,
        value.baseline_run_id ?? null,
        JSON.stringify(value),
      ],
    );
  }

  async getEvidence(id: string): Promise<EvidenceRun | null> {
    const result = await this.pool.query<{ payload: EvidenceRun }>(
      "SELECT payload FROM spondee_evidence_runs WHERE run_id=$1",
      [id],
    );
    return result.rows[0]?.payload ?? null;
  }

  async listEvidence(): Promise<EvidenceRun[]> {
    const result = await this.pool.query<{ payload: EvidenceRun }>(
      "SELECT payload FROM spondee_evidence_runs ORDER BY created_at ASC",
    );
    return result.rows.map((row) => row.payload);
  }

  async claimOperation(key: string, ttlSeconds: number): Promise<boolean> {
    const seconds = Math.max(1, Math.trunc(ttlSeconds));
    const result = await this.pool.query<{ operation_key: string }>(
      `INSERT INTO spondee_operation_locks (operation_key, expires_at)
       VALUES ($1, NOW() + ($2::text || ' seconds')::interval)
       ON CONFLICT (operation_key) DO UPDATE
         SET expires_at = EXCLUDED.expires_at, created_at = NOW()
       WHERE spondee_operation_locks.expires_at <= NOW()
       RETURNING operation_key`,
      [key, String(seconds)],
    );
    return result.rowCount === 1;
  }

  async releaseOperation(key: string): Promise<void> {
    await this.pool.query("DELETE FROM spondee_operation_locks WHERE operation_key=$1", [key]);
  }
}

export async function createStore(env = process.env): Promise<SpondeeStore> {
  const store: SpondeeStore = env.DATABASE_URL
    ? new PostgresStore(env.DATABASE_URL)
    : new MemoryStore();
  await store.init();
  return store;
}
