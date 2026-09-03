import assert from "node:assert/strict";
import test from "node:test";
import { SPONDEE_G3_SUBMISSION_WINDOW_SECONDS } from "./erc8183.js";

test("G3 live jobs keep the official long-lived submission horizon", () => {
  assert.equal(SPONDEE_G3_SUBMISSION_WINDOW_SECONDS, 30n * 24n * 60n * 60n);
  assert.ok(
    SPONDEE_G3_SUBMISSION_WINDOW_SECONDS > 600n,
    "the previous 10-minute quickstart slack is too short for a recoverable live E2E",
  );
});
