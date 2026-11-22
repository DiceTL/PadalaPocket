# MVP feature checklist

Repository/evidence review: **2026-11-14**. Backend-first acceptance map for the broader connected MVP, not just the reduced submission journey. Existing runtime evidence is dated in the linked packets; this document review did not rerun tests, send email, call AI or submit payments.

## How to read this checklist

- `[x]` means the specifically described behavior has implementation and/or recorded verification evidence. Limits such as local-only or historical proof are explicit; it does **not** mean current production acceptance.
- `[ ] Missing` means required functionality is absent. `[ ] Verify` means the implementation exists but the named acceptance evidence is incomplete. `[ ] Decide` means a contract or approach is still unsettled. `[ ] Release` means configuration, integration or deployment remains.
- [Implementation plan](implementation-plan.md) is the only task-status source. Packets contain evidence, [product spec](product-spec.md) owns requirements, and [decision ledger](decision-ledger.md) owns accepted changes. This checklist changes no packet status and authorizes no new implementation.
- Finish backend behavior and backend acceptance first; then finish browser integration and presentation. A missing API, money journal, notification event or account-state persistence is not frontend-only work. Do not calculate completion percentages from checkbox counts.
- Financial evidence currently serves the provisioned demo family and one fixed seller. Separate-email signup/linking exists, but new families cannot transact. Testnet XLM and simulated PHP at the frozen mapping are not redeemable pesos or real GCash payout.
- Backend execution uses the approved [T01–T37 completion plan](backend-mvp-completion-plan.md), its scoped packets and the [required evidence/checklist update procedure](backend-mvp-completion-plan.md#evidence-and-checklist-update-procedure). Its accepted defaults supersede older “Decide” wording below; implementation/live acceptance remains open until evidenced. Task status still belongs only in the implementation plan.

## Backend task-to-acceptance map

After each task, update the specific affected bullets in the linked sections and their matching [decision acceptance](#current-decision-acceptance--dec-093dec-100), not just this index. Add a dated packet link to every changed criterion. A task can contribute evidence without closing a whole feature; keep combined backend/UI/release items unchecked until all parts are proved. T35–T37 validate earlier work rather than automatically checking all mapped items.

| Task packets | Checklist criteria to inspect/update |
|---|---|
| [T01](../handoff/T01.md), [T02](../handoff/T02.md) | [Verification foundations](#backend-verification-foundations) only; neither proves deployed identity, custody or financially enabled families. |
| [T03](../handoff/T03.md) | [Photo AI](#3-photo-ai-needswants-purchases-and-seller-settlement): replacement credential/model access, not category accuracy or UI cancellation. |
| [T04](../handoff/T04.md) | [Accounts](#1-accounts-family-linking-and-financial-onboarding): confirmation/resend, enrollment and registration/code errors. |
| [T05](../handoff/T05.md), [T06](../handoff/T06.md), [T07](../handoff/T07.md), [T08](../handoff/T08.md) | [Safety/recovery](#9-cross-cutting-money-safety-notifications-and-recovery): journals, holds, dispatch fencing, reconciliation and writer cutover; feature-specific money paths still need their own evidence. |
| [T09](../handoff/T09.md), [T10](../handoff/T10.md) | [Accounts](#1-accounts-family-linking-and-financial-onboarding) and [custody evidence gate](#exact-evidence-required-before-complete): protected keys, bindings and actual restore; not provisioning. |
| [T11](../handoff/T11.md), [T12](../handoff/T12.md) | [Accounts](#1-accounts-family-linking-and-financial-onboarding) and [decision acceptance](#current-decision-acceptance--dec-093dec-100): independent wallets/resources, readiness, ten-slot admission and overflow. |
| [T13](../handoff/T13.md) | [Deposits](#7-velo-parent-deposits) and decision acceptance: amount/count/cumulative limits, pending admission and legacy request compatibility. |
| [T14](../handoff/T14.md), [T15](../handoff/T15.md) | [Deposits](#7-velo-parent-deposits) and decision acceptance: actual receipt validation, unique attribution, confirmed family transfer and no premature credit. |
| [T16](../handoff/T16.md) | [Deposits](#7-velo-parent-deposits), [safety/recovery](#9-cross-cutting-money-safety-notifications-and-recovery) and decision acceptance: cancellation/payment races and pending isolation. |
| [T17](../handoff/T17.md) | [Parent funding](#2-parent-rules-money-mapping-and-allowance-distribution) and [deposits](#7-velo-parent-deposits): available parent principal and truthful pending/history projections; UI remains separate. |
| [T18](../handoff/T18.md) | [Funding](#2-parent-rules-money-mapping-and-allowance-distribution), [purchases](#3-photo-ai-needswants-purchases-and-seller-settlement) and [accounts](#1-accounts-family-linking-and-financial-onboarding): two-family financial authority, bucket conservation and routine Wants acceptance. |
| [T19](../handoff/T19.md) | [Purchases](#3-photo-ai-needswants-purchases-and-seller-settlement) and [withdrawal](#8-interactive-test-anchor-withdrawal--backend-still-missing): shared-seller claim coordination/attribution, not anchor completion. |
| [T20](../handoff/T20.md) | [Parent decisions](#4-parent-decisions-expiry-and-private-allowance-activity): exact consent, holds, decision/expiry races and settlement through coordinated execution. |
| [T21](../handoff/T21.md), [T22](../handoff/T22.md) | [Photo AI](#3-photo-ai-needswants-purchases-and-seller-settlement): cancellation/late-response boundary and real-image behavior respectively; browser cancel controls remain separate. |
| [T23](../handoff/T23.md) | [Purchases](#3-photo-ai-needswants-purchases-and-seller-settlement) and [notifications](#9-cross-cutting-money-safety-notifications-and-recovery): student-only insufficient/zero notices; does not close the reminder part. |
| [T24](../handoff/T24.md), [T25](../handoff/T25.md) | [Savings/My Money](#5-savings-release-and-private-my-money--backend-still-missing): release requests/decisions/transfers, private spending/history and new-path privacy respectively. |
| [T26](../handoff/T26.md), [T27](../handoff/T27.md) | [Weekly lifecycle](#6-weekly-schedule-test-advancement-reminder-and-recap), [notifications](#9-cross-cutting-money-safety-notifications-and-recovery) and decision acceptance: reminder/event, latest settings, running-operation restrictions and safe rollover/allocation; UI restrictions remain open. |
| [T28](../handoff/T28.md), [T29](../handoff/T29.md), [T30](../handoff/T30.md) | [Withdrawal](#8-interactive-test-anchor-withdrawal--backend-still-missing): real anchor instructions, automatic bounded execution and privacy-safe summaries respectively; historical operator proof is insufficient. |
| [T31](../handoff/T31.md), [T32](../handoff/T32.md) | [Safety/recovery](#9-cross-cutting-money-safety-notifications-and-recovery) and decision acceptance: operator queries/menu/redacted error history, then disable/recovery/slot release; neither alone closes the combined names/disable criterion. |
| [T33](../handoff/T33.md) | [Onboarding](#10-onboarding-state--backend-dependent-work-before-frontend-only-handoff) and decision acceptance: names and independent account progress/resume; tutorial presentation remains open. |
| [T34](../handoff/T34.md) | [Photo AI/performance](#3-photo-ai-needswants-purchases-and-seller-settlement): measured backend read/write targets; do not claim browser/Auth/AI latency targets passed from backend timings. |
| [T35](../handoff/T35.md) | [Backend completion map](#backend-completion-map), [evidence gates](#exact-evidence-required-before-complete) and decision acceptance: combined real-database isolation, concurrency, interruption and bounded live evidence across all backend flows. |
| [T36](../handoff/T36.md) | [Release](#13-release-and-final-backend-handoff-evidence) and each mapped release bullet: intended deployed backend/migrations/configuration and authenticated journeys; no designer/device acceptance. |
| [T37](../handoff/T37.md) | [Final backend handoff](#13-release-and-final-backend-handoff-evidence): final API/error/setup/recovery contracts and independent clean setup; not the recording, judging README or full frontend delivery. |

## Backend verification foundations

These evidence-qualified checks are prerequisites, not product-feature or deployment acceptance. Current task review/acceptance remains in the [implementation plan](implementation-plan.md#backend-mvp-completion--t01t37).

- [x] T01: the offline `contract-baseline` command exercises the unchanged browser client against isolated handlers, route/error contracts, existing backend tests and fixture validation. Recorded PASS on 2026-11-16; no hosted or live-provider compatibility is claimed. [Evidence](../handoff/T01.md#recorded-evidence).
- [x] T02: the `environment` command verifies the isolated loopback-only local Supabase stack, ordered migrations, two synthetic families, membership/role denial, server-only administrative access, readiness gates and public-response credential isolation. Recorded PASS on 2026-11-16; no hosted setup or wallet custody/provisioning is claimed. [Evidence](../handoff/T02.md#recorded-evidence).
- [x] Owner confirms Phase 1 merge and GitHub Actions pass. DEC-103 requires no additional T02 review or T02–T04 checkpoint; missing historical reviewer details are not fabricated. [Review history](../handoff/T02.md#recorded-evidence).

## Completion summary — decisions, work and release gates

**Use this as the completion gate, not another task tracker.** The detailed acceptance sections below and [open backend questions](../work/backend-decision-questions.md#remaining-questions-and-feasibility) remain the source for each criterion; task state stays only in the [implementation plan](implementation-plan.md). DEC-093–DEC-100 are confirmed choices, not questions to reopen or evidence of delivery. Their [acceptance checklist](#current-decision-acceptance--dec-093dec-100) supplements, rather than replaces, the original accounts, allowance, approval, Savings, private-money, weekly, withdrawal and PWA scope.

### What must happen, in order

1. **Resolve the remaining product/team choices.** Agree measurable AI and login/dashboard targets after diagnosis; finalize each role's tutorial trigger, progress, completion and resume details once journeys stabilize. The weekly in-flight allowance amount/schedule restriction is decided; its race atomicity and failed/unknown/interrupted/resumed lock timing remain technical safety design questions. The ten-family target, deposit limits, disable/new-family rules, student notices, withdrawal intent and onboarding-last order are already accepted. No arbitrary performance threshold, replacement model/provider or production real-money support is selected here.
2. **Investigate, then approve technical contracts before building their dependents.** Resolve supported Velo reporting and pooled family attribution; secure key storage/backup/restore, exact resource topology and provisioning; backed exactly-once credit, pending/cancel races, fees/reserves and disable recovery/capacity; shared-seller Noir claim aggregation and unattended/resumable SEP-24; and cross-deployment dispatch fencing/unknown recovery. Diagnose actual Groq access/results and Auth/API/database/browser latency. [The eleven open questions](../work/backend-decision-questions.md#remaining-questions-and-feasibility) own these investigations; architecture/provider suggestions are not approvals. Credentials, storage material/provider selection and bounded financial test authorization remain prerequisites, not permission to change secrets or transact.
3. **Finish missing backend flows and their functional bare pages/routing first.** Close independent-family provisioning/account readiness and first-sign-in names; paid-deposit attribution/backed credit and limits/cancel; available parent-wallet projection; Savings requests/decisions/releases and private My Money spending/history; student bucket notices; two-step weekly reminder/event; app-driven seller withdrawal/status; and operator listing/errors/confirmed disable. Include durable authority, reservations, journals and supported reconciliation for each path. See [sections 1–9](#backend-completion-map) and [DEC-093–DEC-100 acceptance](#current-decision-acceptance--dec-093dec-100). Existing connected rules, purchase/review, bucket and weekly screens are not missing scaffolds; retain them and add only their missing contracts/integration.
4. **Prove backend/functional completion with targeted evidence.** Exercise the matrix below against the combined intended release, carrying forward dated evidence for unchanged behavior and adding targeted regressions where contracts, signers, migrations or routes changed. Passing doubles, pure arithmetic or one old demo payment cannot close a new integration. Functional completion means every required backend flow and usable authenticated route works with truthful states and documented contracts; it does not mean designer acceptance or full project completion.
5. **Finish onboarding last, with the final journeys.** Founder-owned functional information/tutorial pages and routing follow the working flows; verify independent per-account persistence and resume. Human frontend/design ownership remains unchanged for visual handoff, approved assets and presentation. Functional work must not wait for a visual redesign, but bare pages do not waive [frontend/responsive/accessibility](#11-frontend-integration-and-presentation-remaining) or [PWA/device](#12-installable-app--pwa-acceptance) acceptance.
6. **Close full-project release and presentation acceptance.** Integrate the human-owned design/assets, finish device/PWA checks and the [release evidence](#13-release-and-final-backend-handoff-evidence), review/merge/configuration/deployment gates, judging README/actual architecture/setup and accessible two-minute recording/rehearsal. A limited working demo, a video URL or backend-only completion is not full project completion. Deferred packets remain deferred unless their own acceptance is met; this summary authorizes no implementation, submission, auth/readiness flip or scope cut.

### Exact evidence required before “complete”

Record the command/check, dated result, release commit/environment, sanitized operation identities/proof links and limitation in the owning packet. Separate automated/mock evidence, local API + hosted database evidence and actual deployed/live Testnet evidence. Reuse verified primitives; do not repeat successful live payments merely for a blanket retest.

| Gate | Required targeted tests / release proof |
|---|---|
| Identity and deploy parity | Corrected real inbox confirmation/resend → deployed enrollment/linking; registration/error matrix; intended deployed commit, ordered migrations and signer/configuration parity. Use real parent/student sessions and fresh-clone setup with the user's own resources. Local success or an applied hosted migration alone does not prove deployed acceptance. |
| Custody, topology and capacity | After storage/access/recovery choices are approved and configured, first rehearse a disposable **unfunded** key: store → fresh-runtime restart/backup restore → public-key match and message signature verification; deny unauthorized retrieval/signing and check bundles/logs/errors for secrets or signed envelopes. This is a proposed test, not completed custody evidence. Then use explicitly bounded provisioning proof for family/network/purpose bindings, parent-owned Needs/Wants/Savings, distinct student My Money authority, agent policy/cap and genuine seller claim authority; verify backing/reserve/fee budget before wallet-ready. Exercise ten enabled slots, overflow registration/linking with financial gates, concurrent slot admission and no unprovisioned family access. |
| Deposits and family accounting | Authorized two-family concurrent/repeated receipt observation and financial execution against the real database: one authenticated receipt credits only its intended family once, only after confirmed backing; independent funds/operations do not leak or consume another family's entitlement. Test ₱10 minimum, centavos, full ₱5,000 and cumulative-cap boundaries, one pending deposit, use of previously confirmed funds, safe-project-funds rejection and operator-only remaining cap. Cancel-versus-paid races and unknowns must reconcile without double credit or premature unblock. Server validation defeats forged callbacks, mismatched receiver/amount/asset/intent and cross-family IDs. Never manufacture paid family balances from checkout status. |
| Allowance, purchases and approvals | Targeted regression of saved-rule revisions/snapshots, integer conservation, fees/reserves outside spendable funds, isolated buckets/holds and exact-request consent; add missing available parent balance and routine Wants live acceptance. Real-image category/uncertainty/restricted cases, AI unavailable/no-payment, insufficient/zero notices, approval/reject/ten-real-minute expiry races and duplicate submissions must preserve truthful status. Verify confirmed authorization **and seller claim**, refresh restoration, private photos and role/family denial. Measure AI/login/dashboard components against targets agreed after diagnosis, not an invented benchmark. |
| Savings, private money and weekly | Actual confirmed Savings → My Money release and no-photo private spend/history; duplicate/concurrent/insufficient/unknown cases conserve funds. Deny parent access through IDs, APIs, lists, totals and notices, including new paths. Prove both-role reminder → weekly event, UI and server prevention of amount/schedule changes during either advance, direct API and concurrent-change races, latest saved allowance at event start, real-time expiry, rollover before next allocation, whole-allocation skip, replay/concurrency and pending/failure recaps. Exercise the approved safety design for interrupted, failed, unknown and resumed operations. Network time stays real; no production scheduler is implied. |
| Shared seller and withdrawal | Prove supported Noir claim aggregation and coordination for two families sharing one seller, without unsupported per-purchase withdrawal attribution or other-family exposure. Verify current anchor limits, below-minimum accumulation, maximum batching, authenticated initiation/transfer and actual pending/failed/completed lookup; forged redirects and repeated initiation cannot settle twice. Demonstrate the agreed interactive/unattended behavior in the app, stop on unknown/failure and label fiat **simulated**, never real PHP/GCash payout. Historical operator anchor proof is not app acceptance. |
| Recovery and operator lifecycle | Exercise agreed interruption boundaries across separate workers/deployments and expired requests for each money path: exact saved transaction identity, dispatch authority, safe checkpoint continuation and unknown fences. A missing hash/`NOT_FOUND` is not authority to clear a hold, flip readiness/Auth or create a replacement. Test operator safe queries, menu/list/error redaction and 30-day history; mutation requires explicit authorization, preview and confirmation. Disable blocks new work, reconciles unknowns, confirms recoverable return before slot release and retains keys/journals; test unavoidable costs, no seller recycling, permanent old-family disable and create/join-new-family role reuse/fresh cap with private old history. |
| Browser, device and final handoff | Integrate every finished route with actual family data and truthful empty/loading/error/pending states; independent tutorial progress/resume and first-sign-in names. Obtain human design/assets approval, responsive and keyboard/focus/touch/accessibility evidence. Complete fresh logo/install UI checks, deployed manifest/cache headers, Android/desktop install and documented iOS installation, installed role layouts/sign-out/private-read denial, offline/reconnect/update restoration without duplicate operations. Finish combined release checks and judging README/architecture/SDK+transaction links/setup/screenshots/video/rehearsal; these are not replaced by a backend handoff. |

**What the recent evidence does—and does not—close:** [EV-027](../work/evidence-ledger.md#ev-027) observed one 0.10-XLM Velo payment as paid using the public frontend reporter, not a documented supported merchant reporting interface. [EV-028](../work/evidence-ledger.md#ev-028) used the actual handler with isolated Auth/database doubles and a live receipt read: checkout history/status only, no family credit, real database concurrency or new payment. [EV-029](../work/evidence-ledger.md#ev-029) is read-only wallet/source investigation plus pure identifier/integer checks, not provisioning, custody/restore or signing proof. Current global demo signers and `WALLET_SETUP_REQUIRED` for new families remain the boundary; none of these proofs establishes new-family end-to-end readiness.

**Definition of done:** all applicable detailed criteria below have truthful, environment-qualified evidence, approved open contracts are reflected in their canonical specs/scoped packets, and the implementation plan records the corresponding accepted work. Call out functional-complete separately while designer/device/presentation/release gates remain open; call the project complete only after those gates also close. No unapproved design proposal, mock balance or historical single-family proof substitutes for that evidence.


## Backend completion map

This index groups the remaining work; the detailed criteria below are canonical within this checklist, not a second task tracker.

| Area | Implemented boundary | What prevents backend/functionality completion |
|---|---|---|
| Accounts | Verified-email enrollment, separate identities, email-bound student linking | Corrected deployed email round trip; independent family wallets/signing/receiving ownership; full new-family journey |
| Rules/funding | Saved rules and confirmed, repeat-safe separate Needs/Wants allocation | Available parent funding-wallet read contract/evidence; current release parity |
| Purchases/approvals | Needs/Wants routing, photo AI, holds, exact-request review and Noir claim | Broader real-image evidence; routine Wants live acceptance; student insufficient/zero-bucket notifications |
| Savings/My Money | Backed rollover credits and student-private balance projection | Savings requests/releases; no-photo private spending/history; complete privacy checks for those new paths |
| Weekly lifecycle | Saved PHT schedule, one-boundary test advance, real rollover/reallocation, skip notice | 24-hour demo reminder; due-event semantics where still proposed; current release/signers |
| Velo | Validated matching-receiver checkout creation/read | Paid current-wallet top-up and deployed deposit-to-distribution acceptance; new-family ownership model |
| Withdrawal | Separate successful operator/anchor proof only | Authenticated app initiation, durable session/transfer handling, status/reconciliation and app acceptance |
| Safety/recovery | Historical demo safeguards; [T05](../handoff/T05.md)/[T06](../handoff/T06.md) journal/coordinator and [T07](../handoff/T07.md) exact-identity recovery boundaries verified locally | T08 writer cutover, per-path live/deployed recovery and grouped review; no general automatic repair |
| Onboarding | Signup/setup controls exist | Account-specific tutorial persistence/contract still needed; information board/tutorial UI comes last |

## 1. Accounts, family linking and financial onboarding

Evidence: [L-008](../handoff/L-008.md), [R-001](../handoff/R-001.md); implementation: [accounts](../apps/api/src/accounts.mjs), [identity](../apps/api/src/identity.mjs), [enrollment migration](../supabase/migrations/20261107124811_l008_account_creation.sql).

### Implemented / recorded

- [x] Provisioned parent/student sign in through Supabase Auth; server derives trusted family and role from membership, not browser input, query parameters or signup metadata.
- [x] Separate-email/password signup, confirmation resend, Parent/Student choice and setup transition exist. The account-type choice is an untrusted navigation hint, not permission assignment.
- [x] Enrollment requires verified email. A parent creates a family; a separately verified student joins using the parent-generated code. One parent and one student per family are enforced.
- [x] Setup codes are server-hashed, bound to the student email, expire after 24 hours and are single-use. Enrollment/code redemption use durable transactional protection; replay and invalid-code cases have recorded hosted-database evidence.
- [x] Generated-link synthetic parent/student verification and enrollment were exercised; temporary accounts were removed. This is not inbox-delivery evidence.
- [x] Founder observed a real signup email, including spam placement, but its link opened localhost. Canonical production confirmation URL handling was subsequently implemented under DEC-090.
- [x] New families default to `wallet_ready=false`; financial routes reject them with `WALLET_SETUP_REQUIRED`. They do not inherit demo funds or signer authority.

### Unfinished backend / acceptance

- [x] T04 verified canonical Auth/redirect and approved Gmail SMTP settings, both fresh parent/student callbacks to deployed setup, and deployed enrollment/trusted linking. The corrected fresh-fixture `identity` check passed; targeted Terra re-review resolved its three findings. This is bounded inbox/API evidence, not full release acceptance. [Fresh evidence](../handoff/T04.md#fresh-live-acceptance-and-targeted-re-review--2026-11-16).
- [ ] Verify: investigate the earlier parent confirmation links that displayed invalid/expired errors despite Auth later showing the parent confirmed. The fresh parent and student callbacks now succeed, but the cause of those older pages remains unestablished. [Observed history](../handoff/T04.md#confirmation-and-passing-identity-evidence).
- [x] Corrected T04 verification requires unenrolled fixtures, explicit successful observations bound to both fresh identities, and the approved enabled SMTP configuration. Regression checks, fresh live acceptance and targeted Terra re-review passed; old enrolled fixtures fail instead of silently skipping cases. [Corrections and acceptance](../handoff/T04.md#fresh-live-acceptance-and-targeted-re-review--2026-11-16).
- [ ] Verify: record the complete registration error matrix: duplicate email, invalid credentials, pending verification, expired confirmation, resend/delivery failure and expired/wrong-email/used setup code. T04 adds real deployed coverage for a subset; the full matrix is not closed. [Coverage and limits](../handoff/T04.md#confirmation-and-passing-identity-evidence).
- [ ] Decide: exact independent-family key custody, signing, recovery, provisioning and Velo accounting/support under the selected app-managed wallet target (DEC-093); current demo secrets cannot simply be reused for unrelated families.
- [ ] Missing: provision and durably bind independent family wallets/escrows/signing authority and receiving configuration before enabling financial access. No completed provisioning workflow or wallet registry currently establishes this.
- [ ] Verify: two independently enrolled families cannot read each other's rules, activity, photos, codes or money operations, including guessed IDs and direct API calls; a student cannot act as parent.
- [ ] Verify: complete a new-family signup → corrected inbox confirmation → linked independent student → wallet-ready setup → backed allowance → actual purchase journey, using real family information and truthful empty states rather than seeded demo identity.

Password reset, broader invitations and multiple children are not silently added to this scope. A leaked-password-protection configuration warning is recorded in L-008; review it as configuration evidence, not a claim of a verified exploit or completed security audit.

## 2. Parent rules, money mapping and allowance distribution

Evidence: [L-001](../handoff/L-001.md), [L-003A](../handoff/L-003A.md), [L-003](../handoff/L-003.md); implementation: [family](../apps/api/src/family.mjs), [funding](../apps/api/src/funding.mjs).

- [x] Parent saves integer weekly amount, adjustable Needs/Wants ratio, purchase cap and independent category selections. Students cannot mutate rules.
- [x] Revision checks reject stale saves; purchases snapshot rules so later edits do not rewrite existing assessments, requests or approvals.
- [x] Manual distribution uses saved settings/revision and a stable idempotency key. Integer conversion/splitting conserves principal, assigns the split remainder to Wants and keeps fees/reserves outside spendable allowance.
- [x] Separate parent-owned Noir Needs/Wants escrows receive actual Testnet transfers. Both credits require whole-allocation confirmation; a chosen ratio or pending/partial transfer creates no spendable balance.
- [x] Durable funding steps save exact signed transactions/hashes before dispatch; shared-signer admission prevents conflicting unresolved funding. Same-key replay returns the existing operation.
- [x] A real 0.6-XLM Needs / 0.4-XLM Wants distribution, replay and authenticated parent/student views are recorded in L-003A.
- [x] Server checks actual owner funds, reserves and fees before submission. Parent allocation totals are not presented as the student's remaining spendable balance.
- [ ] Missing: add the authenticated, family-authorized read/projection contract for F-001's actual available **parent funding-wallet balance**, distinguishing spendable funds from reserves, fees and cumulative allocations. Existing ledger sufficiency checks are internal; no dedicated available-wallet projection is established by the current API. Browser display/integration follows that backend contract.
- [ ] Release/Verify: deploy current sweep-adjusted availability code and compare parent/student balances to confirmed journals and escrow backing. L-004 warns the older deployed display does not subtract recorded sweeps, while hosted reservation SQL already does.

## 3. Photo AI, Needs/Wants purchases and seller settlement

Evidence: [R-002](../handoff/R-002.md), [L-002](../handoff/L-002.md), [L-003](../handoff/L-003.md), [L-007](../handoff/L-007.md); implementation: [purchases](../apps/api/src/purchases.mjs), [providers](../apps/api/src/purchase-providers.mjs), [rules](../apps/api/src/purchase-rules.mjs).

- [x] Student submits Needs or Wants, the fixed seller, entered price and JPEG/PNG photo up to 2 MiB. Server decodes images and rejects invalid/oversized content; the photo does not verify price, delivery or authenticity.
- [x] Groq vision returns structured product/category, uncertainty and restricted-item assessment. Server rules—not AI text—determine eligibility; image text is untrusted.
- [x] Shared catalog contains 15 everyday categories. Fresh produce is distinct from sweets/juice/electronics; demo Needs permissions include fresh produce. Catalog/prompt tests are not real-image accuracy evidence.
- [x] Selected-bucket confirmed funds, categories and cap are enforced. Historical purchases default to Needs; new requests bind bucket and immutable payload to idempotency and consent.
- [x] Routine eligible purchases proceed without a new parent decision. New category/cap exceptions reserve funds and enter review; uncertain/unavailable AI and insufficient funds do not silently approve payment.
- [x] Dedicated Needs/Wants escrows and reservations prevent a Wants purchase from consuming Needs. Needs/Wants activity identifies the selected bucket.
- [x] Reserve → backing/policy check → Noir authorization → seller claim is journaled. Paid requires confirmed claim and merchant-pending readback; authorization or an unknown outcome is not seller receipt.
- [x] Real notebook identification/payment/claim has recorded deployed Testnet evidence. L-002 also records founder-confirmed production apple approval-to-claim; the old assertion that no apple photo was exercised is superseded.
- [x] A bounded Wants exception payment was verified on Testnet with unchanged Needs backing, emptied exception escrow and revoked exception policy.
- [ ] Verify: record routine, non-exception Wants live payment acceptance. Its implementation and recorded automated coverage are not the same as the existing live exception proof.
- [ ] Verify: representative real photos exercise the supported category boundaries, apple versus sweets/juice/electronics, uncertain/misclassified inputs and restricted-item no-payment behavior. Do not invent an accuracy percentage or treat a successful apple/notebook as coverage of all 15 categories.
- [ ] Missing: notify the student on insufficient selected-bucket funds and when the selected bucket becomes zero after a successful purchase, without approval, debt or cross-bucket borrowing (DEC-097).

The approved [backend plan](backend-mvp-completion-plan.md) records the owner's confirmed expired Groq credential; T03 replaces it without calling the expired key. T22 owns real-image behavior, T34 owns backend latency evidence, and browser/Auth/AI waiting remains separately measured rather than hidden.

- [x] Replacement server-only Groq credential and configurable vision model produced one bounded valid real-image assessment on 2026-11-16. This establishes access only, not category accuracy or deployed configuration. [T03 evidence](../handoff/T03.md#recorded-evidence).
- [ ] Verify: representative database-backed reads meet backend p95 ≤1 second and nonfinancial writes p95 ≤2 seconds under the approved plan; report third-party waiting separately. Browser/login and image accuracy are not established by these timings. [T34](../handoff/T34.md).

- [ ] Missing/Verify (DEC-101): let the student cancel a slow scan or continue waiting; after cancellation or failure require the student to provide photo and details again. Prove cancellation races, late responses and retries cannot initiate a purchase. No implementation or provider choice is implied.

## 4. Parent decisions, expiry and private allowance activity

Evidence: [L-002](../handoff/L-002.md), [L-001](../handoff/L-001.md), [R-002](../handoff/R-002.md).

- [x] Parent reads only their family's pending requests, exact photo, seller, amount, category, assessment and deadline. Student reads their own allowance activity; parent history includes Needs and Wants.
- [x] Approval/rejection binds the exact immutable request once. Durable decision admission handles stale/concurrent decisions; changed amount, seller, photo or bucket cannot reuse consent.
- [x] Ten **real** minutes from request creation determine expiry. Rejection/expiry releases the hold without payment or final allowance deduction; test-week advancement does not extend the deadline.
- [x] Approved exceptions use an isolated escrow and owner consent without increasing the routine cap. Defund/fund/authorize/claim/revocation steps retain exact signed operation evidence.
- [x] Seven-stage exception execution advances one authenticated request/checkpoint at a time. Confirmed checkpoints can continue; an interrupted writer without a safe checkpoint remains fenced.
- [x] Founder confirmed deployed staged approval reached claimed and deployed rejection produced no transaction steps at `51b288a`. This supersedes the old checklist's deployment-pending statement for L-002, not all later changes.
- [x] Waiting, rejected, expired, pending and settled states are distinct. Authenticated private-photo reads enforce family/owner access and no-store handling; activity does not expose signing envelopes or raw photo bytes.
- [ ] Verify: final combined release preserves ownership, role checks, private-photo denial, decision races, real-time expiry and truthful status after refresh. Earlier deployed proof does not certify newer combined code.

## 5. Savings release and private My Money — backend still missing

Evidence: [L-003](../handoff/L-003.md), [L-004](../handoff/L-004.md); existing projection: [weekly](../apps/api/src/weekly.mjs). Current router has no Savings-release or private-spending handler.

### Implemented boundary

- [x] Confirmed weekly Needs leftovers back Savings; confirmed Wants leftovers back student-owned My Money. Credits appear only after the relevant transfer stages confirm, not while money is in transit.
- [x] Student can read confirmed Savings/My Money rollover balances. Parent weekly projections exclude My Money balance and private credit fields; local real-account privacy and balance-screen checks are recorded.

### Missing functionality and acceptance

- [ ] Missing: student creates a durable Savings request for an exact available amount; reserve/admit requests so concurrent or repeated decisions cannot release the same principal twice.
- [ ] Missing: parent approves/rejects the exact Savings request. Approval executes and confirms Savings → My Money once; rejection transfers nothing and releases any hold. Purchase-request expiry must not silently become the Savings policy.
- [ ] Missing: release status/history and unknown/failure reconciliation preserve the request, saved transfer identity and backing until the outcome is established.
- [ ] Missing: student pays from My Money without a photo, AI identification, parental category/cap checks or parent approval, while enforcing actual available funds and authorized student execution.
- [ ] Missing: private My Money purchase/transfer history and exact-once monetary execution. Existing photo-based Needs/Wants routes are not a private-spending implementation.
- [ ] Verify: parent cannot access private balance or spending through IDs, lists, totals, notifications, exports or any newly added endpoint. Parent knowledge of an approved release amount does not permit access to subsequent private spending.
- [ ] Verify: concurrent/duplicate release and private-spend attempts, insufficient funds, interrupted transfers and cross-family access preserve balances and authority. App privacy does not promise anonymity on Stellar's public ledger.

## 6. Weekly schedule, test advancement, reminder and recap

Evidence: [L-004](../handoff/L-004.md), DEC-088; implementation: [weekly](../apps/api/src/weekly.mjs), [weekly plan](../apps/api/src/weekly-plan.mjs), [weekly ledger](../apps/api/src/weekly-ledger.mjs).

- [x] Parent saves weekday/time in Asia/Manila with revision checks. Student cannot change schedule or advance time.
- [x] Explicit **Advance to next week (test)** computes one next scheduled boundary and journals the demo event. It advances application time while submitting actual Testnet transfers; it changes neither Stellar time nor the ten-real-minute approval deadline.
- [x] Admission checks real expiry and blocks unresolved purchase/funding/weekly work before sweeping unreserved confirmed leftovers. Completed rollover precedes the next saved-rules allocation.
- [x] Needs → Savings and Wants → My Money transfer stages conserve principal, persist exact signed operations and gate destination credit on confirmation. Same-event replay does not create another rollover/allocation.
- [x] Insufficient parent funds skip the **whole next allocation**, store a parent-readable event notice and create no partial allowance/debt. Recorded automated depleted-parent evidence exists; a separate live depleted-wallet event is not claimed.
- [x] One real Testnet event moved 9,117,769 Needs stroops into Savings and 5,913,223 Wants stroops into My Money, then allocated 6,000,000/4,000,000 stroops into the next allowance. Independent escrow reads and confirmed transaction results are recorded.
- [x] Recorded SQL/automated checks cover concurrent admission, blocked conflicting work, depleted-parent skip, PHT/year boundaries and privacy; browser continuation is also recorded. Successful rollover/reallocation and completed-event replay have live Testnet evidence, but separate live concurrency/blocked/depleted-wallet cases are not recorded. Connected schedule, test-control, balance and recap screens already exist locally.
- [ ] Missing: the two-step reminder then weekly event, durable event identity and notification/read paths for both roles; remind immediately without rewinding when already within 24 hours. Schedule changes supersede the old occurrence; the event uses the latest saved allowance amount at its beginning (DEC-098, DEC-100).
- [ ] Missing/Verify: prevent parent changes to allowance amount or schedule while either advance action runs, in UI and server including direct API and concurrent requests; do not infer a blanket block on other settings. Decide and prove atomic race handling and safe failed/interrupted/unknown/resumed lock timing; arbitrary multiple-event chronological advancement is not established.
- [ ] Verify: agreed reminder → expiry/reconciliation → rollover → next allocation sequence reports actual date/target, confirmed recap, skip/pending/failure states and replay/concurrency behavior without duplicate events.
- [ ] Release/Verify: apply the weekly schema, configure a distinct funded server-only `STUDENT_SECRET`, deploy matching code and verify production role views/continuation. Local API plus hosted database evidence is not deployed Vercel acceptance.

**Not a new MVP gate:** a background production scheduler remains absent and explicitly deferred. Manual test advancement is implemented; do not describe it as automatic weekly execution.

## 7. Velo parent deposits

Evidence: [L-006](../handoff/L-006.md); implementation: [Velo top-ups](../apps/api/src/velo-topups.mjs).

- [x] Parent-only checkout creation/read uses saved allowance settings, stable UUID idempotency and a durable server journal. Server validates native Testnet asset, exact amount, intent identity, safe checkout origin and configured parent receiver.
- [x] Receiver mismatch withholds the checkout URL. Browser callback parameters cannot mark a checkout paid or credit a wallet; status comes from server-side Velo retrieval.
- [x] Parent-owned Velo project is activated; matching-receiver 1-XLM checkout creation/status is recorded. Earlier mismatch/activation errors are historical, not the current blocker.
- [x] Parent top-up and Noir allowance distribution remain separate explicit operations. No Noir fee sponsorship, automatic allocation or webhook implementation is claimed.
- [ ] Verify: pay the current checkout from a separate funded Testnet sender; confirm server-observed paid status and actual receipt in the configured parent wallet. Earlier separately configured paid Velo proof does not establish this top-up.
- [ ] Release/Verify: deployed Deposit → checkout payment → refreshed server status → available parent funds → confirmed Noir distribution, including repeated status reads and unchanged operation identity.
- [ ] Decide/Missing: resolve supported Velo reporting, pooled receiver/family attribution and independent wallet provisioning before offering financial access to new families. [Nov 14 proof](../work/evidence-ledger.md#ev-027) is not family credit or deployment.

## 8. Interactive test-anchor withdrawal — backend still missing

Evidence: [B-004](../handoff/B-004.md), [B-013](../handoff/B-013.md); L-005 remains deferred in the [implementation plan](implementation-plan.md). Listing the gap does not reactivate that packet.

- [x] A separate operator experiment completed authenticated SEP-10/SEP-24 withdrawal after a confirmed 1-XLM Testnet transfer and observed actual anchor `completed` status. This is feasibility evidence, not an app endpoint.
- [ ] Missing/Decide: attempt withdrawal after confirmed claim at the current anchor minimum, accumulate below it, batch at most its maximum and stop on failed/unknown without unsafe retry. Unattended interactive SEP-24 feasibility is unresolved; the researched 1–10 XLM limits are time-sensitive.
- [ ] Missing: durable seller withdrawal status and reconciliation, sanitized summary for the student's own claim without other-family information or unsupported per-purchase attribution; browser redirects cannot declare completion.
- [ ] Verify: actual application-driven anchor journey and returned pending/failed/completed status; disclose simulated fiat, not real payout.

## 9. Cross-cutting money safety, notifications and recovery

Evidence: [R-002](../handoff/R-002.md), [L-002](../handoff/L-002.md), [L-003A](../handoff/L-003A.md), [L-004](../handoff/L-004.md), [T05 local journal proof, 2026-11-16](../handoff/T05.md#recorded-evidence); current [router](../apps/api/src/router.mjs), [funding recovery](../apps/api/src/funding-recovery.mjs).

T05 proves foundation records only: concurrent identical requests create one operation/hold; changed requests conflict; integer stroops and saved-stage identities are preserved; application roles cannot mutate the journal. Existing writers and balance reads do not yet consume this journal. No feature criterion is closed by T05; backing, dispatch, recovery and cutover acceptance remain open.

T06 adds [2026-11-17 local boundary evidence](../handoff/T06.md#recorded-evidence): separate and paused workers cannot sign competing replacements or acquire a second send permit; saved bytes precede send and confirmed checkpoints resume without re-signing. Controlled loopback RPC results are not live settlement. Existing writers, principal holds and balances remain unchanged; no feature criterion is closed.

T07 adds [2026-11-17 local recovery evidence](../handoff/T07.md#recorded-evidence): interrupted workers retain holds, matching success confirms idempotently, retained checkpoints survive missing provider history, and unsupported/contradictory evidence stays fenced. The observation-only runtime never signs/sends, credits or releases principal. This is controlled local evidence, not per-path live/deployed acceptance; no feature criterion is closed.

T08 [deployed evidence](../handoff/T08.md#2026-11-22--deployed-writer-cutover) verifies Vercel coordinator readiness, hosted legacy permission revocation, and mandatory Testnet guard authority on all four original accounts. Full `writer-cutover` **PASS**. This closes the writer boundary, not end-to-end acceptance of each payment or recovery path.

- [x] Financial authority comes from validated Auth membership. Service-only journals/RPCs, database locks and admission guards—not process-local/browser locks—coordinate the shared demo signer and pending work.
- [x] Available allowance subtracts reserved purchases and swept principal. Partial multi-leg transfers remain in transit; confirmed destination credit cannot be manufactured from pending movement.
- [x] Signed operations/hashes are saved before submission where supported; exact-hash reconciliation and confirmed checkpoints avoid blind replacement transactions. Unknown outcomes retain reservations/fences and never become success merely after a timeout. [T06 local proof, 2026-11-17](../handoff/T06.md#recorded-evidence) independently verifies returned envelope identity, one-shot send admission and stale-worker checkpoint safety; this does not establish T08 cutover or live acceptance.
- [ ] Missing: student insufficient/zero-bucket notifications and both-role demo reminder, with family-scoped recipient access and idempotent event identity. A weekly skip notice is narrower; push delivery is not required.
- [ ] Decide/Verify: establish an evidence-supported bounded operator/reconciliation procedure for unsupported interrupted admission/dispatch windows. Never clear a hold or generate a replacement merely because no hash was found.
- [ ] Verify: explicitly document and exercise the supported recovery boundary for each money path. [T07, 2026-11-17](../handoff/T07.md#recorded-evidence) proves local observation/interruption fences; [T08, 2026-11-17](../handoff/T08.md#recorded-evidence) integrates existing writers with local managed-stage observation and preserves unmanaged historical unknowns. Per-path live/deployed verification remains open; exception/weekly interrupted admissions without safe checkpoints can remain fenced. There is **no general automatic recovery guarantee**.
- [ ] Verify: all newly implemented release/spend/notification/withdrawal/provisioning paths enforce tenant/role isolation, conservation, duplicate protection and truthful pending/error states; old demo-path tests cannot establish those future contracts. The deployed writer boundary is verified; recovery and feature-specific acceptance remain open.

## 10. Onboarding state — backend-dependent work before frontend-only handoff

Scope: DEC-083/DEC-089, [product spec](product-spec.md#account-creation-guidance-and-visual-assets--dec-083). Build the information board/tutorial **last**, after functional flows stabilize.

- [ ] Decide/Missing: define and implement durable per-account tutorial progress/completion and a read/update contract consistent with the final journeys. Do not assume a new database table or a particular storage architecture is already approved.
- [ ] Verify: parent and student have independent progress, interrupted guidance resumes, and completed steps do not restart at every sign-in. A newly linked student does not inherit the parent's completion.

## 11. Frontend integration and presentation remaining

These are browser/design work **after the corresponding backend exists**. Existing real login/setup, rules, Needs/Wants selection/activity, approvals, Velo Deposit, weekly controls and Savings/My Money credit screens are already connected locally; do not rebuild them as missing scaffolds.

- [ ] Connect final independent-wallet readiness/setup, actual parent funding balance, Savings requests/decisions, private My Money spending/history, notification/reminder and interactive withdrawal contracts. These are not frontend-only until their backend criteria above are met.
- [ ] Implement the pre-signup information board and separate parent/student tutorials last, using final controls and persisted account progress. Explain separate emails, setup order, Testnet money and unavailable financial setup truthfully.
- [ ] Complete human-reviewed purposeful illustrations/icons for setup, buckets, empty states and guidance; preserve coherent style, mobile legibility, text alternatives and source licenses. New brand/mascot concept files are proposals, not approved application changes.
- [ ] Verify every final flow on mobile/desktop: keyboard/focus, dialogs, touch targets, loading/empty/error states, repeated-submit protection, photo permissions/fallback and long-confirmation/continue feedback. A tab or preview does not establish working functionality.
- [ ] Keep actual family data and truthful empty/unavailable states in normal routes; retain sample-data labels only in separately identified design/mock previews. Never show private My Money data in parent UI or make pending money look paid.

## 12. Installable app / PWA acceptance

Evidence: [L-009](../handoff/L-009.md), DEC-091. This is packaging/browser/release work, not an unfinished money API.

- [x] Manifest, app name/launch URL, standalone metadata, icons including maskable/Apple assets, native worker and public offline fallback exist.
- [x] Earlier production-build Chromium evidence covers offline navigation/retry, network-only APIs/photos, cache contents limited to the public offline page and updates waiting for windows to close. No offline payment queue is implemented.
- [x] Install prompt/manual help, connectivity notice and no-forced-refresh update handling exist. Authenticated responses/photos are not stored by the PWA worker; offline financial requests cannot be presented as approved/paid.
- [ ] Verify: fresh build/browser checks for the later supplied-logo icons, login-only install/help visibility and sign-in shortcut removal. Earlier checks explicitly precede these edits.
- [ ] Release/Verify: deployed manifest/assets/cache headers, Android/desktop install and standalone launch; verify/document iOS Safari Add to Home Screen. Native-prompt eligibility alone is not OS installation proof.
- [ ] Verify: installed parent/student layouts, keyboard/safe areas, sign-out and denied private reads on representative devices. No worker private cache does not establish installed-session cleanup by itself.
- [ ] Verify: installed offline/reconnect and update/relaunch during an interrupted checkout/purchase restore durable references/status without duplicate submission or lost operation identity. No push or offline payments are required.

## 13. Release and final backend handoff evidence

- [x] Repository includes environment guidance, ordered migrations, setup documentation, transaction proof links and local screenshots. README now contains team handles and a demo-video URL; the old blank-fields statement is superseded.
- [ ] Release: complete review/merge/configuration/deployment gates recorded in the implementation plan. Do not mark L/UI packets Done from this evidence checklist alone.
- [ ] Verify: intended deployed commit and migrations match, all required signers/configuration are present, and real parent/student sessions complete the final journey with correct balances/private access. Historical `51b288a` approval or earlier reduced-demo evidence does not establish current-tree parity.
- [ ] Verify: supported interrupted-operation observation/continuation works within deployed request limits; explicitly report fenced cases rather than promising automatic repair. [T07 local proof, 2026-11-17](../handoff/T07.md#recorded-evidence) does not establish deployed limits, existing-writer cutover or complete path-specific recovery.
- [ ] Verify: an independent user can run the current release from a fresh clone with their own service credentials and Testnet resources. Earlier setup checks do not establish the latest combined release or unimplemented multi-family custody.
- [ ] Verify: rehearse the final two-minute demo, confirm the linked recording is accessible and matches demonstrated capabilities, and record remaining limitations. A video URL alone does not close R-004 acceptance.
- [ ] Verify: backend handoff includes final authenticated request/response/error contracts and evidence for each completed function; the only remaining implementation is genuinely browser/presentation work, not missing money, account-state or notification behavior.

## Explicit boundaries and deferred work

- Background production scheduling, multiple children, arbitrary sellers/QR payment, real PHP/GCash settlement, production custody/compliance, push notifications and queued offline payments are not newly required by this update.
- General automatic interrupted-payment repair is not implemented; safe fencing is intentional. Any new recovery mechanism needs a scoped, evidence-backed contract.
- AI and login/dashboard latency need diagnosis and measurements before targets or provider choices; preserve honest unavailable/uncertain states (DEC-099).
- Product/architecture details including key custody, supported Velo reporting and any still-proposed due-event behavior require the normal decision/spec/handoff process before implementation. Frontend design remains under human design authority.

## Current decision acceptance — DEC-093–DEC-100

- [ ] Support at most ten financially enabled families with isolated app-managed Testnet wallets and one configured seller; extra families may register/link without financial access. No provisioning is implied by the decision.
- [ ] Enforce simulated deposits of ₱10 minimum and ₱5,000 lifetime cumulative per family, centavos and a single full-cap deposit allowed, unlimited count within cap; one pending blocks only another deposit. Parent may cancel unpaid subject to payment-race reconciliation; unknown remains blocked. Explain limit or temporarily unavailable safe project funds; only operator sees remaining cap.
- [ ] Verify DEC-102 family-bound Velo/Stellar receipt, unique underlying payment, backed reservation and confirmed project-to-family-parent transfer before credit; reconcile unknowns and cancellation races without double credit.
- [ ] Prevent allowance amount and schedule changes while either demo advance action runs in UI and server, including direct API and concurrent requests; use the latest saved allowance at weekly-event start. Do not infer a blanket block on other settings. Resolve and verify race atomicity and safe failed/interrupted/unknown/resumed lock timing (DEC-100).
- [ ] Make ₱-prefixed simulated PHP primary, XLM legible and touch/keyboard accessible, and confirm both values and simulation at ₱9.68/XLM.
- [ ] Implement explicit operator disable only, with uncertain work reconciled first, confirmed recoverable funds returned to project wallet, necessary records/keys retained and slot freed only after confirmation. Account for unavoidable reserves/fees; never assume unsafe cleanup or seller recycling. Disabled family cannot re-enable; existing users can create/join a new family in either role, fresh cap, private old history. Collect first/last name once at first sign-in; no account name editing.
- [ ] Provide a local CLI introduction and menu: error history, all-family listing, disable, return/exit. Include linked parent/student names/emails, financial status, totals and pending separately, including disabled families. Agent-readable noninteractive queries must be safe; mutation requires explicit authorization, preview and confirmation. Retain significant resolved/unresolved errors 30 days, newest first, redacting credentials/keys/photos/PII; never automatically delete financial journals; no emails/status page. This does not claim the CLI exists.
- [ ] Investigate supported Velo reporting, pooled attribution, signing/custody/recovery, unattended SEP-24, exact fees/reserves/cleanup and cancellation races; retain the specific unresolved questions in [handoff discussion](../work/backend-decision-questions.md).
