# Spondee G3 — Job 949 submitted-chain proof

Status: **LIVE CHAIN SUBMIT VERIFIED; LOCAL MANIFEST/OUTCOME RECEIPT VERIFICATION PENDING**

Network: BSC Testnet (chain 97)
Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
Job: `949`
Buyer used for the bounded activation: `0x39EB3491a82E7CC7f6C99055bC08e9E5231BA297`

## Buyer-side transactions

- createJob: `0x7d4c6b2528841068de045a7e037a4f1c88f6adf6f34ee9c353c30b49c110da4c`
- registerJob: `0x64e290a8c119cb3be5dfe27b3126adc7e3932ad86053bb4667acb92615628766`
- setBudget(0): `0xc28452786f9be893663f5f0a7c2fef72330341b76e811cf4a76cd2ab3eca9b6d`
- fund(0): `0x3e6d9bb9d504d1c80a8dbd32cc65a234cf91c6e503afccff48222f03873a95ef`

## Provider submit

Seller runtime confirmed:

- submit tx: `0x39243a3e3b145e31cd6318ace98ca764028a91e1a68d5f89f7fdc556d4b4fc74`
- gas used: `248654`
- effective gas price: `0`
- wallet paid: `0`
- published deliverable URL: `http://127.0.0.1:9100/erc8183/job/949/response`

The original local E2E process reported failure only because the SDK's post-submit `JobInitialised` `eth_getLogs` scan hit an RPC range/rate limit. The submit transaction itself had already been confirmed.

## Independent receipt-based proof

GitHub Actions run `33820803719` (`G3 Submitted Job 949 Verification`) passed on head `1a613ba4de74a5a0181247dc4c5a86f3d61c49af`.

The verifier does **not** use `eth_getLogs`. It reads the known submit transaction receipt directly and verifies `JobSubmitted(949)`, `JobInitialised(949)`, the current `getJob(949)` state, provider, deliverable hash, signed task and compact Promise commitment.

Verified values:

- status: `SUBMITTED`
- submit block: `128964136`
- deliverable hash: `0x13630e4a1d5de2a8d3ea84f45da8b3826b2c79d05dc365b1df773c2eec06bdbc`
- Promise ID: `sp_87c1d19f5bc0cda01d586131`
- Promise SHA-256: `f0bdc9e00af63942d8c97ceb6495e0824ab5418b38ca667f9928906074f2607e`
- scenario ID: `spondee-hf-demo-001`
- receipt log scan used: `false`
- secrets printed: `false`

## Remaining bounded verification

The generated manifest remains local at:

`reference-agents/health-factor/app/agent/.agent-data/erc8183-job-949.json`

The only remaining G3 verification is read-only:

1. start the local `/erc8183` bridge;
2. fetch the already-published URL;
3. verify `DeliverableManifest` against the on-chain deliverable hash;
4. parse `response.content`;
5. verify the Spondee Outcome Receipt matches the signed Promise commitment and remains `SIMULATION` / ineligible for observed Agent Advantage.

No seller process, wallet unlock, new job, new transaction, tBNB, or mainnet action is required or authorized for this verification.
