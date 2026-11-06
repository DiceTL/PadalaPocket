# S-002 API examples — s002-v1

All `cases.json` entries are **MOCK** synthetic display scenarios, not observed API responses or proof of payments/AI. Read `body` as the HTTP response; the other fields describe the test scenario. No secrets, real users, photos, addresses, transaction hashes or live service URLs are included. IDs are synthetic UUIDs. Reusing the purchase ID across scenarios represents alternative snapshots, not a replayable event history. Dates are fixed examples, not current approval deadlines.

The stable field contract is in [technical spec](../../docs/technical-spec.md#s-002-development-contract-revision). Backend approves changes; update examples, validator, tests and affected consumers together. Frontend feedback is welcome. Revision must change for incompatible contracts; C-002 is the review gate for provider-dependent fields.

## Endpoint and fixture map

| Intended endpoint | Cases | What is ready for mocks |
|---|---|---|
| `GET /api/me` | parent-identity, student-identity | Identity-only projection; no dashboard balance/settings contract yet |
| `GET /api/purchases/:id` | purchase-* plus parent-purchase and student-purchase | Every proposed purchase state, allowance parent projection, private student spending |
| `GET /api/approvals` | empty-approvals | Empty list only; nonempty items remain undefined |
| Technical error envelope | error-* | Error code/status/message/retryable shapes; method/path are `null` (unspecified); examples do not prove any live endpoint emits these errors |

Only `/api/health` exists today. These mapped product endpoints are unimplemented. No fixture response is a substitute for endpoint implementation or authorization testing.

## Missing reads and provisional fields

- `/api/me` expansion: parent funding balance, student bucket balances, rules/settings and schedule. Amount units, backing and wallet mapping await feasibility/C-002. Do not derive a My Money balance by subtracting parent-visible totals.
- Purchase history lists, pagination, filters and photo evidence reads: route and shape not yet chosen. Single-purchase summaries do not establish history APIs.
- Nonempty approvals/Savings request reads and status, notifications, seller lookup/QR resolution and demo clock state: reads/item contracts need definition before their consuming tasks. Existing write proposals do not establish these read contracts.
- Funding, rollover, Savings release, claim and withdrawal responses: still provider/mapping dependent. No ledger amount, exchange ratio, wallet address, transaction hash, anchor status or upload URL has been invented here.
- Error scenarios exercise the generic envelope. Their `method` and `path` must both be `null`, meaning unspecified; do not register them as endpoint mocks. Successful read fixtures retain concrete methods and paths. `retryable` is a technical hint; unknown payment outcome still requires reconciliation, never automatic resubmission.

## Checking examples

`npm run check:contracts` validates every case and runs negative/coverage tests. `npm run check` includes that command in existing CI. The allowlisted shapes reject extra fields at every modeled object boundary, including nested additions to parent responses. These are fixture checks, not live privacy guarantees. Actual endpoint tests must check cross-user authorization and role projections when routes exist.

## Frontend coverage review (2026-11-07; proposal for backend review)

The fixtures are **not sufficient to drive the planned UI end to end**. `s002-v1` is sufficient for identity routing, basic purchase-state cards, the empty approvals state, parent/student purchase privacy projections, and generic error components. The fixtures are mock scenarios only. This review compares the fixture set with the screen inventory in [the design brief](../../docs/design-brief.md) and the proposed routes in [the technical spec](../../docs/technical-spec.md); it does not establish new accepted API contracts.

| UI area | Current support | Why it is incomplete |
|---|---|---|
| Sign-in | Partial | Identity and generic errors exist, but authentication is Supabase Auth; its mock boundary is not represented by these API fixtures. |
| Parent dashboard | Insufficient | No balances, allowance rules, pending count, funding summary, or recent activity read. C-002 must settle units and backing before financial fields become stable. Never include My Money in parent projections. |
| Approvals | Insufficient | Only the empty queue exists. There are no nonempty purchase/Savings items or review detail evidence examples. |
| Pay a seller | Partial | State/reason outcomes exist, but no upload response, seller/QR resolution, category, safe AI summary, or matching creation response fixture. |
| Purchase status/history | Partial | A single summary can exercise status badges, but there is no collection/history read or timestamps for activity ordering. |
| Savings and My Money | Insufficient | No private/locked balance, Savings request, request history, or transaction history reads. `student-purchase` is only one purchase projection. |
| Week-end recap | Insufficient | No demo clock, allocation outcome, or notification reads. |
| Withdrawal | Insufficient | No claim or withdrawal read fixture; the technical spec proposes a withdrawal status route, but examples do not cover it. |

### Proposed additions for backend review

Keep `s002-v1` unchanged as the accepted fixture revision. Backend should decide which additions are stable after the relevant product and C-002 decisions, then version and approve any fixture contract change under DEC-037/DEC-038. Suggested review scope:

1. Add read fixtures for nonempty purchase and Savings approvals, including the minimum safe detail the parent review screen needs and explicit pending/closed states. Decide photo-read authorization and AI evidence fields before specifying their shapes.
2. Add a purchase collection/history read with server timestamps and the filters/pagination the UI will actually use. Add only safe student/parent projections; preserve the existing My Money exclusion for parent views.
3. Define and fixture the photo-upload and fixed demo-seller/QR resolution responses needed by the purchase flow. Confirm the upload lifecycle and seller contract before consumers assume them.
4. Define reads for Savings requests, student-private My Money history/balance, notifications, demo-clock/weekly allocation results, and merchant-claim/withdrawal status where those screens remain in scope. Several are not currently specified as routes; route and response shapes need backend review first.
5. Defer `/api/me` balance/rule expansion and all financial amounts until backing, mapping, and units are settled. Do not fabricate balances or infer My Money from parent-visible totals.

These are interface gaps and proposals, not product decisions, backend commitments, or evidence that any endpoint is implemented. The design owner still decides UI behavior and detail; backend owns and accepts technical contracts.
