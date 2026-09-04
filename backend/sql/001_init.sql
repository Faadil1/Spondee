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
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('OBSERVED','SIMULATION')),
  baseline_run_id TEXT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spondee_operation_locks (
  operation_key TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spondee_promises_category
  ON spondee_promises(category);
CREATE INDEX IF NOT EXISTS idx_spondee_activations_status
  ON spondee_activations(status);
CREATE INDEX IF NOT EXISTS idx_spondee_evidence_class
  ON spondee_evidence_runs(evidence_class);
CREATE INDEX IF NOT EXISTS idx_spondee_operation_locks_expiry
  ON spondee_operation_locks(expires_at);
