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
