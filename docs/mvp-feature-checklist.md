# MVP feature checklist

Evidence snapshot: **2026-11-07**. Current implementation: one provisioned parent, one student and one fixed demo seller, using Stellar Testnet and illustrative PHP amounts. Target MVP additionally requires real email signup and linked parent/child account creation under DEC-083; that capability is unfinished. One child per family remains the bounded target; support for additional children is not implied. This covers the broader connected MVP authorized by DEC-070 and later decisions, beyond the reduced submission journey in DEC-055.

**Reading this checklist:** checked items have implementation evidence in the linked packets; they do not mean merged, deployed or production-ready. Unchecked items are unfinished acceptance criteria or unverified outcomes. This document is an evidence/acceptance checklist, not a second task tracker: [implementation plan](implementation-plan.md) owns task status, [product spec](product-spec.md) owns requirements, and [decision ledger](decision-ledger.md) owns accepted changes. Older draft defaults must be read with their later decisions. Do not calculate a completion percentage by counting boxes: the work and risk differ substantially between features.

## Accounts and access

- [x] Provisioned parent and student can sign in using Supabase Auth.
- [x] Server derives trusted family/role identity and enforces access permissions.
- [x] Durable application records survive a refresh/new request.
- [x] Server signing keys and provider secrets stay outside browser code.
- [ ] Parent can create a real account with email/password through the app, verify email ownership and sign in afterward; no seeded credentials are needed.
- [ ] Parent can create or initiate creation of a separate linked child account; the child can sign in independently. Exact credential/invitation mechanics require a scoped contract before implementation.
- [ ] New families receive their own authorized records and money resources; signup cannot attach them to the existing demo family or reuse its private balances/signing authority.
- [ ] Duplicate email, invalid credentials, pending verification, expired verification and delivery failures have clear outcomes and a retry path.
- [ ] Normal registration, sign-in and dashboards use the real family's information and truthful empty states, with no example-parent identities or sample balances.

Password reset and broader invitation features remain separate scope decisions; child-account linking is required by DEC-083.

Evidence: [R-001](../handoff/R-001.md), [R-002](../handoff/R-002.md). Self-service families are a target, not a verified implementation. Multiple children per family and arbitrary sellers remain outside the bounded MVP.

## New-account guidance — implement last

- [ ] Before signup, an information board explains that the parent and child need separate linked accounts and identifies the setup order: parent account, child account, then allowance setup.
- [ ] Each newly created parent account receives a tutorial covering child setup, funding, Needs/Wants rules, approvals and activity.
- [ ] Each newly created child account receives a tutorial covering their buckets, photo purchases, purchase status and privacy boundaries.
- [ ] Tutorial progress/completion persists per account; a new child gets their own tutorial even if the parent has completed theirs. Resume interrupted onboarding without restarting completed steps on every sign-in.
- [ ] Explain Testnet funds and illustrative PHP clearly in setup; account creation must not imply that a real peso wallet is ready.
- [ ] Implement and verify the information board/tutorial after the functional journeys are finished, using their final controls and behavior.

DEC-083 establishes this goal and ordering. Exact copy, visual treatment and tutorial steps still follow design ownership; no onboarding is implemented by this checklist.

## Parent rules and allowance distribution

- [x] Parent can save allowance amount, Needs/Wants split, purchase cap and category selections.
- [x] Rule revisions prevent stale saves; new purchases snapshot their rules without rewriting earlier purchases.
- [x] Parent can explicitly distribute the saved amount into separately backed Needs and Wants Noir escrows.
- [x] Integer splitting preserves the total; fees/reserves remain separate from principal.
- [x] Funding records and transaction hashes persist; repeated requests do not intentionally create a second allocation.
- [x] Student sees confirmed Needs availability and funded Wants; parent totals are labeled allocations rather than remaining spendable balances.
- [x] Partial/unknown allocation results stay unavailable and block conflicting money operations.
- [x] Wants purchases enforce saved Wants rules in the local implementation; release evidence and deployment limits are in [L-003](../handoff/L-003.md).
- [ ] Parent can choose the recurring weekly day/time and have it execute. A saved weekly amount currently supports manual distribution only.

Evidence: [L-001](../handoff/L-001.md), [L-003A](../handoff/L-003A.md). Interrupted funding recovery remains deliberately disabled; there is no general automatic recovery guarantee.

## Student Needs purchases and AI

- [x] Pay a seller offers **Take a photo** and **Choose a photo**; camera use requires permission.
- [x] Student enters a price and submits JPEG/PNG evidence, with a 2 MiB limit, to the fixed demo seller.
- [x] Real vision-provider integration identifies a product/category; server rules determine permission.
- [x] Shared catalog contains 15 everyday categories with examples, including fresh produce, water, groceries and school supplies.
- [x] Fresh apples belong to fresh produce in the classification instructions; the demo family's Needs permissions include fresh produce.
- [x] Needs purchases check category permission, cap and available funds before financial execution.
- [x] Uncertain images, AI failures, insufficient funds and policy failures have explicit outcomes.
- [x] Permitted Needs purchases use durable Noir authorization and merchant claim, with recorded Testnet hashes.
- [x] Purchase reservations and immutable signed operations guard against duplicate spending; unknown execution stays distinct from success.
- [ ] Verify classification with an actual apple photo. Catalog/prompt tests do not establish live image accuracy.
- [x] New over-cap/category-conflict requests enter parent review after balance reservation; historical blocked requests stay blocked.
- [x] Add spending from Wants through its own backed escrow.
- [ ] Add private My Money spending through its own backed flow.

Evidence: [R-002](../handoff/R-002.md), [L-007](../handoff/L-007.md). AI does not verify market price, delivery or authenticity. The current seller is fixed; arbitrary seller selection/QR payment is not implemented.

## Parent decisions

- [x] Parent sees only their family's pending purchase requests, including exact photo, seller, amount, category, AI assessment and deadline.
- [x] Parent approves/rejects the exact immutable request once, with safe handling of concurrent/stale decisions.
- [x] Requests expire after **10 real minutes** without payment or final allowance deduction.
- [x] Approved exceptions execute without increasing the ordinary spending cap or weakening routine policy.
- [x] Waiting, rejected, expired, payment-pending and settled outcomes appear distinctly in both roles.
- [ ] Insufficient-funds outcomes notify the parent without creating debt or borrowing from another bucket.

Local implementation and evidence: [L-002](../handoff/L-002.md), F-004/F-005 in the [product spec](product-spec.md). A bounded integrated exception is now verified on Testnet; final staged orchestration has database/unit checks. Production deployment remains pending. Earlier scripts remain separate feasibility evidence.

## Activity and responsive pages

- [x] Parent sees family Needs purchase history; student sees their own purchase history.
- [x] Both roles can view purchase photos through authorized private reads.
- [x] Overview/Home show real connected data, with loading, empty and error states.
- [x] Live pages use the preview visual system with mobile/desktop navigation and layouts; role routes survive reload/back navigation.
- [x] Unimplemented destinations explicitly say they are unavailable; sample previews remain separately labeled.
- [ ] Every future connected workflow passes mobile and desktop checks after integration, including dialogs, keyboard use and error states.

Evidence: [L-001](../handoff/L-001.md), [UI-002](../handoff/UI-002.md). An available tab does not establish a functioning backend workflow.

## Visual assets and product identity

- [ ] Add a coherent set of purposeful assets for account setup, allowance/buckets, empty states and guidance, replacing the current largely text-and-card presentation where visuals help understanding.
- [ ] Use a consistent illustration/icon style across parent and student pages, with final asset choices reviewed under the existing human design authority.
- [ ] Supply app identity assets suitable for the PWA icons and installed launch experience.
- [ ] Assets remain legible at mobile/desktop sizes, preserve useful text alternatives and avoid slowing the main purchase/funding journeys.
- [ ] Record licenses/attribution for sourced assets; decorative artwork never substitutes for actual purchase photos or account data.

These are accepted improvement goals under DEC-083, not a claim that the current UI has no assets: it already includes fonts, icons and explicitly labeled preview imagery.

## Velo parent deposits

- [x] Parent can create/read an authenticated hosted Testnet checkout with a durable idempotency journal.
- [x] Server validates amount, asset, checkout identity and receiver against the parent wallet.
- [x] Matching-receiver checkout creation/status have been observed with the activated parent-owned Velo project.
- [x] Browser callback parameters cannot credit the wallet; distribution is a separate explicit operation.
- [ ] Observe a paid checkout depositing into this parent wallet and verify the resulting funds before allocation.
- [ ] Verify the complete deployed Deposit → payment → refreshed status → distribution journey.

Evidence: [L-006](../handoff/L-006.md). The historical paid Velo proof uses a separate checkout; it is not proof of this parent deposit journey. Gas sponsorship and webhooks are not implemented claims.

## Remaining wallet and weekly lifecycle

- [x] Wants can pay from its own confirmed balance without consuming Needs; one bounded live Testnet purchase verified both escrow balances.
- [x] Reconciled week-end Needs leftovers move to Savings; Wants leftovers move to My Money exactly once.
- [ ] Student requests Savings release; parent approval transfers the approved amount to My Money, while rejection transfers nothing.
- [x] Student sees confirmed rollover credits in private My Money; parent weekly projections exclude that balance.
- [ ] My Money has a real student-controlled balance/history and spending without photo, parental approval or parental category/cap checks.
- [ ] Parent APIs, views, notifications and totals exclude private My Money balances/purchases. Public-ledger anonymity is not promised.
- [ ] Parent-chosen weekly schedule allocates once per due event; an insufficient parent balance skips the full allocation and notifies the parent.
- [ ] Reminder appears 24 hours before the next allocation; recap reflects confirmed rollover results.
- [x] Provide an explicit **Advance to next week (test)** button in parent testing/demo tools, separate from normal scheduled funding.
- [ ] Show the application test date and target week; run the real due-event sequence (reconcile/expire requests, rollover, then next allocation) exactly once, with visible pending, skipped, confirmed and failure results.
- [ ] Repeated clicks, reloads and concurrent requests cannot repeat a rollover or allocation. Unresolved money operations block unsafe advancement.
- [x] Test advancement remains isolated to the authorized Testnet/demo context; it does not change Stellar time, transaction validity or the ten-real-minute purchase approval timeout.
- [ ] Withdrawals initiate and reconcile an authenticated test-anchor session in the app, showing actual returned status and disclosed simulated fiat payout.

Scope: [L-003](../handoff/L-003.md), L-004/L-005 in the [implementation plan](implementation-plan.md), F-002/F-006–F-008 in the [product spec](product-spec.md). [L-004](../handoff/L-004.md) now connects Savings, private My Money credits, recap and the manual weekly test control; one real Testnet rollover/reallocation is verified locally. A background scheduler, 24-hour reminder, Savings release, private spending and Withdrawal remain unfinished. Vercel deployment requires the new student server signer. Earlier wallet/anchor experiments are separate evidence.

## PWA goal — DEC-082

**Goal, not implemented.** No app manifest or service-worker implementation was found in the current web source inspection. This decision selects desired behavior, not a caching library or architecture.

- [ ] Supply app name, icons, launch URL, theme and standalone display metadata; verify browser-specific install requirements.
- [ ] Install and launch successfully on supported Android/desktop browsers; document iOS Add to Home Screen behavior and any limitations.
- [ ] Installed parent/student pages fit mobile and desktop screens, safe areas and keyboard changes without clipped controls.
- [ ] Show a useful offline/unavailable state and reconnect path; never substitute fixture balances for unavailable live data.
- [ ] Require connectivity and server confirmation for funding, purchases and parent decisions; never present an offline action as paid/approved.
- [ ] Prevent private photos, authenticated API responses and credentials from leaking through any added cache; sign-out removes any private local artifacts introduced by PWA work.
- [ ] Handle updates without losing a purchase/checkout reference or resubmitting financial operations; refresh/relaunch restores durable status.
- [ ] Verify installed launch, offline recovery, update behavior and sign-out on representative supported devices/browsers.

Push notifications and queued offline payments are not part of this goal. Scheduling reminders does not itself imply push delivery. Implementation needs a scoped handoff and architecture/contracts before code work.

## Release and submission gates

- [x] Repository has an environment example, ordered setup documentation and recorded Testnet proof links.
- [x] Event README includes team names, architecture and local screenshots.
- [ ] Verify a stranger can run the current release from a fresh clone with their own credentials; earlier setup evidence does not establish the latest combined release.
- [ ] Verify the final deployed version matches the intended commit and completes the real parent/student journey.
- [ ] Complete review/merge/deployment gates still recorded in the implementation plan; local evidence alone does not close them.
- [ ] Record/rehearse the two-minute demo and fill in its URL. Video URL and Discord handles are intentionally blank for now.

Evidence and setup: [README](../README.md), [R-004](../handoff/R-004.md). No production-money readiness or independent security audit is claimed.
