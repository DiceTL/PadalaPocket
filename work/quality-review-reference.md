# Quality review reference

Owner: James Paul C. Soliven. Builders reproduce and resolve implementation findings; Tyrone verifies technical claims. This document reviews the written concept and proposed product flow. Shared setup and the isolated B-001 payment proof have implementation evidence, but the product UI and end-to-end product journey are not complete. This document reports no observed product-flow defects.

## Review status and method

Status: first-pass proposed-logic review, based on the [product spec](../docs/product-spec.md), [idea](../seed/idea.md), and [problem capture](problem-capture.md). Review date: 2026-11-07.

For each scenario, compare the documented rule with its edge cases. Record whether the finding is a proposal gap, a confirmed team decision, or a bug observed in a running build. Do not mark an item resolved from a proposed default alone. Product choices belong to the team and important choices must be recorded in the [decision ledger](../docs/decision-ledger.md) before affected specifications change.

## Current proposed-logic findings

These are questions and risks for review, not necessarily defects. The product spec already proposes some defaults; where it does, this review notes the remaining operational detail.

| ID | Scenario | Documented rule | Concern / question | Suggested owner or next evidence | Review status |
|---|---|---|---|---|---|
| QL-001 | Parent has insufficient available funds at weekly funding time | Proposed default: skip allocation and notify parent; no partial funding or debt | Decide whether the missed allocation can be retried manually and whether later scheduled weeks proceed independently. | Team decision needed; implementation must show funded balance only after confirmed backing. | Decision needed |
| QL-002 | Week ends with an open approval request | Proposed default expires unresolved prior-week requests before rollover; submitted payments must be reconciled first. Technical spec also says unknown submissions block affected rollover and expiry uses real server time. | Verify the approval/expiry race and deterministic ordering at the boundary. Preserve unknown payment state; the demo clock must not extend the real 10-minute deadline. | Backend test/evidence for expiry race and blocked rollover; product default remains proposed. | Specified; implementation unverified |
| QL-003 | Payment request times out after dispatch | Technical spec defines `unknown`, hash/nonce reconciliation, reservation retention, and no fresh retry on timeout. | Verify the user-visible pending state and recovery through the actual hosted runtime; timeout alone must not release funds or create a new payment. | Backend task evidence for hosted reconciliation and recovery. | Specified; implementation unverified |
| QL-004 | Parent changes rules after a request is created | Technical spec proposes a versioned rules record and purchase snapshot; approval binds to the rules version and freezes request fields. | The spec says behavior for rule changes remains gated. Decide whether existing pending requests use the snapshotted rules or are invalidated/reassessed after a rule edit. | Team decision, then align product and technical specs before implementation. | Decision needed |
| QL-005 | Parent approves an over-cap or category-conflict request | App sends the exception for parent review, but parent approval alone cannot override Noir's on-chain cap. | Identify a safe contract path bound to the exact approved amount/recipient/request; do not relax the routine cap silently. | Backend feasibility B-002 and checkpoint; require contract-level evidence. | Feasibility unresolved |
| QL-006 | Student requests a purchase from an insufficient bucket | Spec rejects and notifies parent; no borrowing or approval override. Technical flow checks the selected bucket first and rechecks at execution. | Confirm student can explicitly choose another eligible bucket before submission, while never switching buckets silently. | Verify UI and API behavior when implemented; no new product rule required unless behavior differs. | Specified; implementation unverified |
| QL-007 | AI is uncertain, wrong, or flags a restricted item | Spec requires a new photo or cancellation for uncertainty; restricted flags go to parent review. Changed photos invalidate old assessment; approval binds to photo and AI result. | Verify supported category accuracy, retry/cancel behavior, evidence retention, and that uncertainty never becomes approval. | Backend AI evidence with representative permitted, conflicting, restricted, and unclear samples. | Specified; AI feasibility/evidence open |
| QL-008 | Student releases Savings into My Money | Product spec requires parent approval; technical spec proposes one release per approved request and idempotent money operations. | Define behavior when requested amount exceeds Savings or balance changes before approval; verify concurrent/repeated approvals cannot release twice. | Decide insufficient-Savings behavior; backend to verify atomic revalidation and duplicate prevention. | Decision and implementation check |
| QL-009 | Parent app should not expose My Money | Requirement excludes balance/details from parent views, notifications, exports, APIs and aggregates; technical spec says parent queries exclude these fields. | Check indirect leakage through errors, logs, support views, combined totals, and address linkage. App privacy does not provide blockchain anonymity. | Backend access-control and frontend output review; verify wallet-linkage caveat. | Specified; implementation unverified |
| QL-010 | Demo clock advances across several events | Product and technical specs require chronological, deduplicated event processing; real deadlines and Stellar validity remain real time. | Verify deterministic ordering when reminder, expiry, rollover, and allocation coincide; repeated advancement must not duplicate effects. | Backend tests/evidence for event ordering, idempotency, and unknown-payment rollover block. | Specified; implementation unverified |
| QL-011 | Student-entered peso price is paired with Testnet asset amount | Technical spec says server maps integer PHP centavos to stroops and records mapping version; ratio, rounding, and cap comparison unit still need team acceptance. | Set the display label, conversion, rounding, fee/reserve handling, and cap comparison unit before connected purchase flows; do not imply real exchange. | Team decision followed by contract/fixture update. | Decision needed |
| QL-012 | Merchant payment is authorized but not claimed, or claim is delayed | Technical spec distinguishes `merchant_pending` from `claimed`; claim failure does not automatically refund the student. | Verify UI and accounting do not show settlement on authorization alone; reconcile pending funds and claim failure without double debit/refund. | Backend live authorization/claim hashes and before/after balance evidence, then connected-flow review. | Specified; implementation unverified |
| QL-013 | Test anchor withdrawal is unavailable or pending | Product spec requires authenticated withdrawal and actual returned status; payout to fiat is simulated. | Verify initiation versus completion states and safe recovery for pending/failed anchor status. Do not describe simulated fiat as received funds. | Backend task evidence for authenticated flow and actual anchor status. | Evidence needed |

## Strengths in the written logic

- The spec separates AI classification from payment authority: application rules decide and signing keys are not given to the model.
- It distinguishes an insufficient-balance rejection from an approval exception.
- It says parent approval and AI evidence must bind to the specific purchase details.
- It recognizes duplicate actions, pending/unknown payments, weekly rollover, and real network time as correctness risks.
- It limits the demo to Testnet and explicitly rejects claims of real GCash payout or blockchain anonymity.

These are strengths of the written requirements. They are not evidence that the product flow enforces them. B-001's isolated proof evidence is separate from end-to-end product-flow verification.

## When a build is available

For each observed issue, add a dated entry with:

1. Task/feature and build or commit tested.
2. Setup and steps to reproduce.
3. Expected behavior, linked to the product rule or accepted decision.
4. Actual result and sanitized evidence (logs/screenshots/transaction identifiers as appropriate).
5. Impact, severity rationale, and whether the issue is reproducible.
6. Builder/technical follow-up and retest result.

Keep observed bugs separate from proposal gaps. Do not update task status here; the [implementation plan](../docs/implementation-plan.md) is the sole status source, and task packets hold task evidence.

## Related references

- [Product spec and proposed defaults](../docs/product-spec.md)
- [Problem capture and current assumptions](problem-capture.md)
- [Market alternatives and opportunity hypotheses](../seed/market.md)
- [Judge questions](../docs/judge-questions.md)
- [Evidence ledger](evidence-ledger.md)
