"use strict";
// Self-service user task flow. Simulation only; never calls /live-testnet.
(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    tasks: [], activePromise: null, previewTask: null, previewSnapshot: null,
    epoch: 0, busy: false, lastReceipt: null, history: [],
  };
  const ids = ["preview", "restore", "activate", "inspect", "category", "task-json", "consent"];
  if (!ids.every((id) => $(id))) return;

  function status(message, error = false) {
    $("work-status").textContent = message;
    $("work-status").classList.toggle("error", error);
  }
  async function api(path, options) {
    const response = await fetch(path, {
      ...options,
      headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`Server returned HTTP ${response.status} without JSON.`); }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof data?.error === "string" ? data.error : "Request refused"}`);
    }
    return data;
  }
  function invalidate() {
    state.epoch += 1;
    state.activePromise = null;
    state.previewTask = null;
    state.previewSnapshot = null;
    $("promise").hidden = true;
    $("empty-promise").hidden = false;
    $("consent").checked = false;
    $("activate").disabled = true;
    $("receipt-block").hidden = true;
    state.lastReceipt = null;
  }
  function setBusy(busy) {
    state.busy = busy;
    $("preview").disabled = busy;
    $("restore").disabled = busy;
    $("category").disabled = busy;
    $("activate").disabled = busy || !state.activePromise ||
      !state.previewSnapshot || !$("consent").checked ||
      $("task-json").value.trim() !== state.previewSnapshot;
  }
  function chosenStarter() {
    const selected = $("category").value;
    return state.tasks.find((t) => t.schema === selected) ?? null;
  }
  function restore() {
    const template = chosenStarter();
    if (!template) return;
    $("task-json").value = JSON.stringify(template, null, 2);
    invalidate();
    status("Change the sample inputs to represent your own scenario. Nothing has executed.");
    setBusy(false);
  }
  function showPromise(promise) {
    $("empty-promise").hidden = true;
    $("promise").hidden = false;
    $("promise-result").textContent = promise.expected_outcome || "Unspecified";
    $("promise-cost").textContent = promise.expected_cost?.amount || "0";
    $("promise-confidence").textContent = promise.confidence === null
      ? "Not calibrated" : String(promise.confidence);
    $("promise-downside").textContent =
      Object.entries(promise.expected_downside || {})
        .slice(0, 2).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(" · ") || "Not established";
    $("promise-id").textContent = `Immutable task commitment: ${promise.promise_id}`;
    $("promise-method").textContent =
      "Declared scenario, bounded agent contract, unobserved calibration. " +
      "Task edits require a different Promise Card. " + (promise.claim_guardrail || "");
    $("consent").checked = false;
    $("activate").disabled = true;
  }
  function receiptText(receipt) {
    if (!receipt) return "No outcome returned.";
    const outcome = receipt.actual_outcome ?? {};
    const fields = Object.entries(outcome).slice(0, 5).map(([key, value]) =>
      `${key.replaceAll("_", " ")}: ${JSON.stringify(value)}`).join(" · ");
    return fields || "No measured outcome in this response.";
  }
  function showReceipt(activation, receipt) {
    $("receipt-block").hidden = false;
    $("activation-status").textContent = activation.status;
    $("receipt-summary").textContent = receiptText(receipt);
    $("receipt-json").hidden = true;
    state.lastReceipt = receipt ?? null;
  }
  async function preview() {
    let task;
    try { task = JSON.parse($("task-json").value); }
    catch { status("Invalid JSON. Correct the task inputs before preview.", true); return; }
    if (!task || typeof task !== "object" || Array.isArray(task) ||
        task.schema !== $("category").value) {
      status("Your JSON must use the selected task category and contain one object.", true);
      return;
    }
    const before = $("task-json").value.trim();
    invalidate();
    const epoch = state.epoch;
    setBusy(true);
    status("Asking the backend to validate and commit your task-specific Promise…");
    try {
      const { promise } = await api("/v1/promises/preview", {
        method: "POST", body: JSON.stringify({ task }),
      });
      // A stale response must never approve a task edited while the call was in flight.
      if (epoch !== state.epoch || $("task-json").value.trim() !== before) return;
      state.previewTask = task;
      state.previewSnapshot = before;
      state.activePromise = promise;
      showPromise(promise);
      status("Promise ready. Compare expected benefit, downside and unknown confidence before deciding.");
    } catch (error) {
      status(error instanceof Error ? error.message : String(error), true);
    } finally { setBusy(false); }
  }
  async function activate() {
    if (!state.activePromise || !state.previewTask || !state.previewSnapshot ||
        $("task-json").value.trim() !== state.previewSnapshot || !$("consent").checked) {
      status("Your task changed or consent is missing. Preview again before activation.", true);
      return;
    }
    const promise = state.activePromise;
    const task = state.previewTask;
    const epoch = state.epoch;
    setBusy(true);
    status("Executing the exact previously previewed task in the backend simulation engine…");
    try {
      const { activation } = await api("/v1/activations", {
        method: "POST",
        body: JSON.stringify({ task, promise_id: promise.promise_id, mode: "SIMULATION" }),
      });
      if (activation.status !== "SIMULATED" || !activation.receipt_id) {
        status(`Backend refused or did not finish the bounded simulation: ${activation.status}`, true);
        return;
      }
      const { receipt } = await api(`/v1/receipts/${encodeURIComponent(activation.receipt_id)}`);
      if (epoch !== state.epoch) return;
      if (receipt.promise_id !== promise.promise_id ||
          receipt.evidence_class !== "SIMULATION" ||
          receipt.calibration?.eligible_for_observed_agent_advantage !== false) {
        throw new Error("The returned receipt is not consistently bound to the simulation Promise.");
      }
      state.history.unshift({
        category: promise.category, scenario: promise.scenario_id,
        promiseId: promise.promise_id, activationId: activation.activation_id,
        receiptId: activation.receipt_id, status: activation.status,
      });
      state.history.length = Math.min(15, state.history.length);
      renderHistory();
      showReceipt(activation, receipt);
      status("Backend created an actual SIMULATED activation and stored its outcome. No wallet or chain action occurred.");
    } catch (error) {
      status(error instanceof Error ? error.message : String(error), true);
    } finally { setBusy(false); }
  }
  async function inspectSaved(record) {
    status("Loading the previously stored activation and outcome from the backend…");
    try {
      const [{ activation }, { receipt }] = await Promise.all([
        api(`/v1/activations/${encodeURIComponent(record.activationId)}`),
        api(`/v1/receipts/${encodeURIComponent(record.receiptId)}`),
      ]);
      if (activation.promise_id !== record.promiseId ||
          receipt.promise_id !== record.promiseId ||
          receipt.evidence_class !== "SIMULATION") {
        throw new Error("Persisted backend records no longer match this investigation.");
      }
      showReceipt(activation, receipt);
      $("receipt-block").scrollIntoView({ block: "nearest" });
      status("Reopened the stored activation and its simulation receipt.");
    } catch (error) {
      status(error instanceof Error ? error.message : String(error), true);
    }
  }
  function renderHistory() {
    const root = $("history-list");
    root.replaceChildren();
    for (const record of state.history) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${record.category} · ${record.scenario}`;
      const descriptor = document.createElement("div");
      descriptor.className = "fine mono";
      descriptor.textContent = `${record.status} / ${record.receiptId}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = "Reopen saved outcome →";
      button.addEventListener("click", () => void inspectSaved(record));
      item.append(title, descriptor, button);
      root.appendChild(item);
    }
  }
  $("category").addEventListener("change", restore);
  $("restore").addEventListener("click", restore);
  $("task-json").addEventListener("input", () => {
    invalidate();
    setBusy(false);
    status("Task changed. The earlier Promise no longer authorizes activation; preview again.");
  });
  $("consent").addEventListener("change", () => setBusy(state.busy));
  $("preview").addEventListener("click", () => void preview());
  $("activate").addEventListener("click", () => void activate());
  $("inspect").addEventListener("click", () => {
    if (!state.lastReceipt) return;
    $("receipt-json").hidden = !$("receipt-json").hidden;
    $("receipt-json").textContent = JSON.stringify(state.lastReceipt, null, 2);
  });
  async function init() {
    try {
      const [{ tasks }, { categories }] = await Promise.all([
        api("/v1/scenario-starters"), api("/v1/categories"),
      ]);
      if (!Array.isArray(tasks) || !Array.isArray(categories) || categories.length !== 4) {
        throw new Error("The four-category backend is not available.");
      }
      state.tasks = tasks;
      $("category").replaceChildren();
      for (const item of tasks) {
        const option = document.createElement("option");
        option.value = item.schema;
        const category = categories.find((c) => c.reference_agent?.category &&
          c.reference_agent.category === (item.schema.includes("health-factor") ? "Health Factor Monitoring" :
            item.schema.includes("grid") ? "Grid Trading" : item.schema.includes("rebalancing") ?
              "Rebalancing" : "Yield Optimisation"));
        option.textContent = category?.category ?? item.schema;
        $("category").appendChild(option);
      }
      $("category").disabled = false;
      restore();
    } catch (error) {
      status(error instanceof Error ? error.message : String(error), true);
    }
  }
  void init();
})();
