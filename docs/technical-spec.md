# PadalaPocket MVP technical spec

Draft shared developer contract, authorized by [DEC-030](decision-ledger.md). The stack below is the working baseline; interfaces and implementation choices are proposals until reviewed. S-001 infrastructure is implemented; product routes below remain unimplemented. Requirements live in [product spec](product-spec.md); task status lives only in [implementation plan](implementation-plan.md).

## Architecture reference

The working stack, component diagram, boundaries and unresolved physical money routing live in [architecture](architecture.md). This spec owns the detailed data model, HTTP contracts, execution/recovery and verification requirements. Update architecture alongside any architectural decision under DEC-031.

## Ownership and trust

- Browser: sign in through Supabase Auth, collect inputs, upload a photo through a restricted signed upload, and display server-returned outcomes. Never write balances, roles, approvals or settlement status directly.
- API: validate the access token with Supabase Auth, load trusted parent/student membership, enforce object-level access, run rules, call AI/payment services and return role-filtered data. Derive identity from authentication, never a request's `parentId` or `role`.
- Postgres: authoritative application rules, requests, bucket accounting, reservations and operation history. Use transactions for monetary mutations and unique constraints for duplicate prevention. Ledger-confirmed transfers are authoritative for on-chain holdings; database balances must reconcile to them.
- Supabase service credentials and all signers remain server-only. Privileged database access bypasses RLS, so every API handler must authorize its caller before using it. Enable RLS and restrictive grants on every exposed table; no browser financial writes.
- Private photo objects belong to the purchase/student. The linked parent may view allowance photos; unrelated users cannot. Authorize before issuing short-lived read URLs. Validate image type, decoded content and size; exact limits depend on provider/hosting selection. Do not log photos, tokens, signed URLs or secrets.
- Use two separate real demo logins, not an unauthenticated parent/student role switch. My Money fields/transactions are excluded from parent queries, API projections, notifications and aggregates. App privacy does not conceal public Stellar activity or grant privacy from the server operator.

Supabase access behavior is documented in [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [private bucket guidance](https://supabase.com/docs/guides/storage/buckets/fundamentals). No project permissions have been configured or tested.

## Logical data model

Proposed tables, not migrations. UUID identifiers; UTC timestamps. Keep private financial tables unexposed where possible; selectively expose only what browser Auth/Storage requires.

| Table | Essential fields and invariants |
|---|---|
| `family_members` | `family_id`, `user_id`, trusted `role`; one demo parent/student; server-controlled membership |
| `allowance_rules` | student, weekly amount, Needs ratio, cap, category sets, schedule/timezone, `version`; snapshot version on purchase |
| `wallet_accounts` | user, purpose, Stellar address, Noir device reference if applicable; never private keys; physical layout gated below |
| `balances` | student/parent, bucket, available and reserved amounts, revision; nonnegative; My Money student-only |
| `purchases` | student, bucket, seller reference, entered price, mapped Testnet amount, immutable photo reference, AI assessment, rules version, approval reason, expiry, status, revision |
| `savings_requests` | student, amount, parent decision, status, release operation; one release per approved request |
| `money_operations` | unique action/idempotency key, owner, request fingerprint, transfer kind, debit/credit, reservation, state, nonce, signed-envelope reference, transaction hash/result; restrict sensitive envelope access |
| `notifications` | recipient, event, safe payload, read time; no My Money purchase events for parent |
| `demo_clock` | demo instance, simulated time, revision; scheduled events deduplicated through operation keys |

Money crosses JSON as decimal strings, never floating-point amounts or JavaScript BigInt. Proposed UI price is integer PHP centavos (`priceMinor`); ledger amounts are integer stroops (`amountStroops`). Server computes the mapping and records its version; browser cannot choose a ledger amount independently. The demo conversion ratio, rounding and cap comparison unit require team acceptance before payment implementation. Label any peso equivalent as simulated. Keep fees/minimum account reserves separate from spendable bucket funds.

Each bucket must have an auditable backing relationship. Candidate: Needs/Wants as app sub-balances of Noir escrow, with Savings and My Money isolated from allowance spending. Physical accounts, escrow withdrawal rules and weekly transfer routing are **not yet proven**. Do not show a database-only allocation as an on-chain transfer or implement rollover before its actual signing/transfer path is established.

## Proposed HTTP contract

All routes below are PadalaPocket routes to implement, not claims about vendor APIs. Require a bearer access token. State-changing requests carry `Idempotency-Key`; reuse with a different body returns `409 IDEMPOTENCY_CONFLICT`. Persist intent before external side effects. Server checks ownership on every identifier. Return amounts as strings and timestamps as ISO 8601 UTC.

| Route | Caller and input | Output / effect |
|---|---|---|
| `GET /api/me` | Authenticated user | Trusted role, safe family context, permitted balances/rules; parent response excludes My Money |
| `PUT /api/allowance-rules` | Parent; settings and expected rules version | Validated settings/new version; existing-purchase rule-change behavior remains gated |
| `POST /api/photo-uploads` | Student; MIME type, byte count | Restricted object path and short-lived upload authorization; finalize/validate before AI access |
| `POST /api/purchases` | Student; bucket, category, seller ID, price, photo object | Purchase ID, decision/status, safe AI result and approval expiry if applicable; My Money omits category/photo |
| `PUT /api/purchases/:id/photo` | Owning student; new photo, expected revision | Only allowed from `needs_photo`; invalidate prior assessment, increment revision and reassess |
| `GET /api/purchases/:id` | Student or permitted parent | Current state, permitted evidence and confirmed transaction references |
| `GET /api/approvals` | Parent | Own linked student's pending purchase/Savings requests; no My Money purchases |
| `POST /api/purchases/:id/decision` | Parent; `approve`/`reject`, expected revision | Exact request accepted or conflict/expiry; approval does not imply ledger confirmation |
| `POST /api/savings-requests` | Student; amount | Pending request; no funds released |
| `POST /api/savings-requests/:id/decision` | Parent; decision, expected revision | Release operation or rejection; success only once release is complete |
| `GET /api/notifications` | Authenticated recipient | Recipient-only app notifications |
| `POST /api/demo/advance` | Parent on demo instance; target time, expected clock revision | Due event outcomes, updated clock; unresolved submitted payments block affected rollover |
| `POST /api/demo/merchant-claim` | Parent as explicit demo operator | Claims through fixed demo seller signer; never arbitrary caller-supplied merchant keys |
| `POST /api/demo/withdrawals` | Parent as explicit demo operator; amount | Test-anchor interactive URL/withdrawal ID after authenticated initiation |
| `GET /api/demo/withdrawals/:id` | Authorized demo operator | Actual anchor status, kept distinct from claim and simulated fiat completion |

Demo operator permissions are a proposed convenience for the single controlled seller, not a seller onboarding product. Seller lookup/QR parsing must resolve to the fixed Testnet seller. Entered GCash details remain synthetic metadata, never a claim that the GCash number received payment. Arbitrary GCash QR interoperability is unresolved.

Example allowance request:

```http
POST /api/purchases
Authorization: Bearer <student-access-token>
Idempotency-Key: <unique-client-action-id>
Content-Type: application/json

{"bucket":"needs","category":"meals","sellerId":"demo-seller","priceMinor":"7500","photoObject":"<owned-validated-object>"}
```

Example parent-review response (illustrative, not observed):

```json
{"id":"<purchase-id>","revision":1,"status":"awaiting_parent","reason":"CAP_EXCEEDED","ai":{"productName":"Rice meal","category":"meals","identification":"identified"},"expiresAt":"<server-generated-UTC-time>"}
```

Use `201` for a newly persisted request, `202` for external work in progress, and `200` for a read or repeated identical action. Technical errors use `{ "error": { "code": "...", "message": "...", "retryable": false } }`: `400 INVALID_INPUT`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 STALE_REVISION`, `409 APPROVAL_EXPIRED`, `503 PROVIDER_UNAVAILABLE`. Normal product outcomes such as insufficient bucket funds are persisted purchase decisions with reason codes, not network errors. Never describe an unknown submission as safe to repay.

## Purchase execution and recovery

1. Validate student, bucket, price, recipient and photo ownership. My Money skips AI/parental rules; retain balance and technical checks. Run the selected-bucket sufficiency check first.
2. For allowance, call real image AI and validate structured output: product name, supported category, `identified`/`uncertain`, concise supported reason and any alcohol/tobacco flags. Image text is untrusted input. AI cannot invoke signing tools. No reliance on a fabricated numeric confidence score; assess behavior on sample images before choosing thresholds/model.
3. Uncertainty yields `needs_photo`; insufficient funds yields `rejected` and a parent notification for allowance only. Identified category conflict, prohibited-item flags or over-cap yields `awaiting_parent`; otherwise proceed to payment preparation.
4. Bind approval to a server-stored fingerprint of recipient, amount, bucket, photo content reference, AI result and rules version. Parent decision uses a conditional revision/status/expiry check. Freeze request fields once awaiting approval; edits require a fresh request and assessment. Recheck balance and policy before execution.
5. Atomically reserve bucket funds when entering `ready`, then persist a unique payment operation/nonce before network submission. Pending parent requests are not guaranteed funds; insufficient funds at approval/execution denies payment. No database transaction remains open during an HTTP/ledger call.
6. Proposed states: `assessing → needs_photo | awaiting_parent | ready | rejected`; `awaiting_parent → ready | rejected | expired`; `ready → submitting → merchant_pending | failed | unknown`; `merchant_pending → claimed` after confirmed seller claim. `unknown` may resolve to confirmed or failed after reconciliation. Claim failure leaves merchant pending funds, not an automatic student refund.
7. Reserve until confirmed debit or definite failure; never release on timeout alone. Persist the signed-envelope reference/hash before submission where available. Reconcile an existing hash/nonce before any retry. Classic source-account sequence collisions require serialized submissions for that signer. DB transactions/unique keys protect concurrent approvals, allocations and releases; an in-memory lock cannot coordinate Vercel instances.
8. Return `202` with purchase ID when external work exceeds the bounded request wait. Next authorized status request can perform bounded reconciliation of already recorded work; no fire-and-forget process after the function returns. Poll only while a visible request is pending. Prove hosting duration and recovery behavior before relying on this design.

All approval expiry checks use server-authoritative application time. Demo time may advance an expiry but never extend a request past its real 10-minute safety deadline; keep a separate real deadline. Network policy expiry and transaction validity always use real ledger time. Weekly ordering, skipped funding, category overlap and other proposed product defaults remain in the product spec; this document does not approve them.

## Signing and integration proof

Before full family Auth exists, follow the temporary operator-only proof protection in [architecture](architecture.md#responsibilities-and-boundaries). A proof endpoint must reject missing/wrong authorization before any signing/network action. Disable that route when the application Auth task is complete; do not expose its credential to the web app.

Proposed demo custody: separately funded owner, agent and merchant Testnet signers stored in server secrets. Parent-authenticated setup/funding requests invoke the owner signer; approved application decisions invoke the agent; fixed-seller claim invokes the merchant. This is server-custodied demo signing, not a noncustodial wallet. Student My Money signing needs a separate authority/path without parental policy checks. Do not expose signers in URLs, database client reads, browser bundles or logs. Use fresh Testnet-only keys.

Noir registration/policy/funding/authorization/claim semantics and caveats are sourced in [EV-002–EV-004](../work/evidence-ledger.md). Candidate integration to verify against the installed releases:

1. Register the device/agent and fund the required Noir escrow using the owner signer.
2. Call Noir `checkPayment`; prepare the contract operation, sign with its required authority and confirm submission. B-001 initially tried Velo Gas; DEC-042 selects direct Noir submission plus a separate Velo checkout/status proof after Gas handoff failed. Keep the two payment proofs distinct.
3. Confirm ledger success and merchant pending amount, then claim with the merchant signer and verify its wallet increase. Store both authorization and claim hashes.
4. Parent over-cap approval must use a verified owner-authorized exception sequence. Do not silently set Noir's cap to unlimited or assume app approval overrides it. Test isolation and restoration if policy updates are proposed; otherwise this feature remains blocked for implementation.
5. Prove escrow-to-Savings/My Money movement, balance backing and repeatable weekly funding. Noir defunding/revocation constraints may require a different physical layout; settle this before dependent coding.
6. After a confirmed merchant claim, perform real test-anchor authentication, start interactive withdrawal, handle the returned destination/memo and transfer instructions, and query terminal status. No arbitrary callback parameter is trusted as proof of completion. Anchor asset/minimum/maximum discovery and untested boundaries remain in EV-020–EV-021.

DEC-042 authorizes the direct-Noir/separate-Velo-checkout alternative for B-001; actual results belong in its packet. Standard Velo checkout does not verify Noir contract calls, and the experiment does not select product funding/money routing. If a mandatory SDK role or anchor flow cannot be demonstrated, report the gap; no fabricated successful fallback.

### B-001 temporary implementation — DEC-041

`POST /api/operator/proof` is an operator-only experiment outside the product API/fixture contract. A 256-bit hex `OPERATOR_TOKEN` in the Bearer header is checked before parsing or SDK imports/dependencies; `PROOF_ENABLED` must explicitly be `true`. Request actions are setup operations, `authorize`, `claim`, `check`, `snapshot`, `status`, `transaction` and fixed `checkout` retrieval. Bodies cannot override amounts, recipient, checkout ID or contract arguments; raw JSON is limited to 32 KiB.

The CLI prepares/signs via Noir into sensitive local `PROOF_ENVELOPE_XDR`. Under DEC-042, `PROOF_TRANSPORT=direct` sends that envelope in the authenticated body, avoiding a deployment per operation. The adapter verifies the required source signature and exact single Testnet contract invocation, a fee ceiling of 30 XLM, finite maxTime no more than 600 seconds ahead and an already reached minTime below maxTime. Demo authorization is 0.1 XLM, cap 1 XLM and escrow funding 5 XLM; these constants establish no PHP conversion or product default. Direct mode queries the exact hash before submission; an already recorded SUCCESS/FAILED is returned without sending. Noir 0.3.0 `submit` returns only after confirmed SUCCESS; any exception retains the hash as SUBMISSION_UNKNOWN. The CLI blocks replacement preparation and further dispatch after a recorded attempt; use hash observation after uncertainty. Fixed Velo checkout retrieval projects only ID/status/amount/asset and explicitly states it is separate from Noir settlement. Its General key is distinct from Gas credentials. RPC requests are bounded to 15 seconds; Noir's confirmation loop is 60 seconds plus in-flight RPC time.

Historical Gas mode retains exact proof/action/hash idempotency keys, replay-only status and definitive-rejection refresh guards. DEC-042 permits one explicit migration of the original registration only: preserve the original envelope/request, recheck RPC NOT_FOUND, require a ledger closed after immutable maxTime and source sequence exactly one below the signed sequence, then keep proof/device/signers/nonce unchanged. This proves the expired envelope cannot execute, without claiming the relayer reservation was cancelled. The command renews a finite six-hour policy expiry only before any policy preparation. B-005 must disable this temporary route. See [operator commands](development.md#b-001-operator-proof) and [actual evidence](../handoff/B-001.md).

## Handoff and verification

Frontend owner consumes the HTTP contract, Auth and restricted uploads; backend owner supplies routes, SQL/permissions, AI, signing and reconciliation. Backend approves response samples under DEC-037 before dependent implementation; frontend may provide feedback. UI structure/appearance remains outside this draft's authority.

Before application build tasks: review this draft, accept or resolve blocking product defaults, establish UI authority, confirm service credentials/remaining hours, and authorize scoped implementation. First proposed build slice is the smallest deployed Noir/Velo payment-and-claim proof, not the full interface.

Verification required during authorized implementation:

- Runtime/import check on deployed Vercel; sanitized Testnet logs, transaction hashes and before/after escrow/merchant balances for authorization and claim.
- Cross-user API/RLS/photo access checks; parent cannot retrieve My Money through direct IDs, list endpoints or totals; browser bundle contains no server secrets.
- Repeat and concurrent calls cannot double fund, pay, roll over or release; test expiry versus approval, unknown submissions and later reconciliation.
- Real AI responses for permitted, conflicting and unclear images; changed request cannot reuse approval. Parent-over-cap path verified against actual contract policy.
- Demo time processes each due event once and preserves real ledger time; bucket changes reconcile with backing transfers. Withdrawal reaches the anchor's actual status with simulated payout disclosure.

Record actual results in scoped task packets/evidence, and progress only in the implementation plan. These checks are planned, not passed.

## S-002 development contract revision

Backend accepts `s002-v1` under DEC-038 for synthetic development examples. [Fixture guide and endpoint map](../handoff/api-examples/README.md) defines the stable subset and explicitly missing reads. `cases.json` wraps each HTTP body with MOCK/revision/scenario metadata; that wrapper is a fixture format, not an added live API envelope. Generic error fixtures use `null` method/path metadata to mean unspecified, not an endpoint mapping. Successful bodies remain direct resource objects; technical errors retain `{error:{code,message,retryable}}`.

Stable identity projection: UUID `userId`, UUID `familyId`, and trusted `role` (`parent` or `student`). This is the minimal `/api/me` projection; balances and settings are deliberately not settled here. Identity must ultimately come from server-validated authentication, not fixture metadata.

Stable purchase summary: UUID `id`, positive integer `revision`, `status` from the execution states above, `bucket` (`needs`, `wants`, `my_money`), positive integer decimal-string `priceMinor`, nullable `reason`, nullable UTC `expiresAt`. `priceMinor` represents the student-entered illustrative PHP centavo price; it does not establish a Testnet conversion. `awaiting_parent` requires an expiry; the fixture summaries omit it in other states without changing server expiry/audit requirements. Known business reasons are `AI_UNCERTAIN`, `CAP_EXCEEDED`, `CATEGORY_CONFLICT`, `RESTRICTED_ITEM`, `INSUFFICIENT_FUNDS`, `PARENT_REJECTED`, `APPROVAL_EXPIRED`. `reason: null` means no exception reason is recorded; it does not mean that decision checks were skipped. Business rejection remains a successful read of the persisted outcome, distinct from an HTTP error. Unknown submission must display uncertainty and must not enable blind repayment.

Parent samples allow only allowance summaries; My Money balance/purchases and nested private fields are rejected. Student-only My Money must never enter photo/parent-review states. AI evidence, photos, ledger amounts, hashes, seller/wallet identifiers and balances are absent from this stable summary, not invented placeholders. Success-state MOCK examples are display scenarios only; they contain no transaction proof. Empty approvals use `{items:[]}`; nonempty approval item contracts remain missing. C-002 must finalize dependent fields and examples before live integration.

## B-002 exception proof contract — DEC-044

Local command: `node --env-file=.env.local apps/api/scripts/cap-exception.mjs init|run|observe`. This is a trusted operator experiment, not parent authentication. `init` creates a private exclusive `.env.b002-state.json`; it refuses an existing file. Its owner signature binds request ID, owner, exception device/agent, merchant, asset, 1.1-XLM amount, nonce, bucket, synthetic photo reference and real expiry. Validation rejects unknown fields, modifications, a different owner and expired consent. `run` uses the required Noir SDK to create isolated ordinary/exception devices, fund only the exception, authorize, claim and revoke. It never raises the ordinary cap.

The private state retains the exception signing key, owner signature, exact signed envelopes, hashes, dispatch markers and observations. An exclusive local lock prevents concurrent CLI runs (not a distributed lock). Each exact envelope is persisted before submission; a dispatched hash not confirmed SUCCESS stops the run. `observe` performs read-only hash queries; an unknown outcome never creates another envelope. A stale lock after process death requires operator investigation before removal. `run` is a sequential experiment, not a general resume engine: after interruption inspect the stage/expiry and use observations, do not reset the state or rerun blindly.

The deployed policy binds agent/device/asset/cap/expiry, not photo, bucket or merchant. Exact-request restriction is enforced by this trusted CLI and owner signature. A compromised exception key could choose other recipients before spending the escrow; exactly funded escrow bounds total debit, not purchase identity. Empty escrow and revocation prevent later use after success. This limitation and the extra per-request device/agent overhead require team review before dependent product payment design. No production exception flow or wallet layout is selected here.
