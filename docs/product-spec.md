# PadalaPocket MVP product spec

Requirements derive from the [decision ledger](decision-ledger.md), including current MVP choices DEC-093–DEC-100. Historical proposals below remain proposals unless superseded by later decisions. The DEC-055 submission scope is historical.

## Five-hour submission MVP

This section records the DEC-055 reduced release scope. Later connected slices and DEC-070/DEC-084/DEC-085 extend parent review beyond the original blocked-only behavior; current evidence is in the [feature checklist](mvp-feature-checklist.md).

Historically DEC-055 narrowed the submission to one provisioned parent, student and fixed seller. DEC-093 supersedes that limitation for the current MVP target; historical evidence and delivery status remain distinct.

Recording journey: parent signs in and funds a Needs allowance with confirmed Testnet backing; student signs in, supplies a photo and price; real AI identifies the item; server checks the fixed allowed categories, cap and available funds; a permitted purchase uses Noir authorization and merchant claim. Show the actual statuses and both transaction hashes. Preserve dual simulated-PHP/Testnet-XLM display and accepted rounding. Configure a small finite allowance/cap during provisioning; no settings editor is required.

Above-cap, disallowed-category, uncertain-photo and insufficient-funds requests are blocked with an explanation; no parent override exists in this slice. Unknown payment outcomes remain pending until reconciled. Duplicate submissions cannot create a second payment. Parent/student roles are enforced by the server; no self-selected production role.

Demonstrate Velo separately through its existing bounded checkout/status path and identify exactly what it does. Do not describe it as sponsoring Noir gas. Prior anchor, exception and multi-bucket proofs may be linked as dated feasibility evidence; they are not integrated app features.

Deferred: Wants funding/screens, parent approval queue and exceptions, Savings, My Money, weekly clock/rollover/reminders, in-app anchor withdrawal, signup/reset flows, additional families/sellers, and layout expansion. Existing approved screen components may be reused; human designer owns changes. No empty deferred screen should imply a working feature.

Acceptance requires the public deployment to complete this real journey with provisioned accounts, durable operations and secret-free browser assets; then pass a recording rehearsal. A collection of historical proofs alone does not satisfy this reduced MVP.

## Account creation, guidance and visual assets — DEC-083

The intended connected MVP must support real parent email registration and creation/linking of a separate child account, with independent sign-in and trusted family permissions. This supersedes the reduced build's provisioned-only identity limitation as a target; provisioned accounts remain the current implementation. The bounded family still has one child. Account verification, family isolation and independently provisioned money resources must be resolved before public signup is called functional; credential delivery/linking and wallet architecture are not selected here.

The normal product journey uses actual family information and honest empty states instead of example parents. A first-run information board explains the separate accounts and setup order. A tutorial runs for each newly created account, with account-specific progress, rather than every sign-in. Implement the information board/tutorial last, after the functional journeys are finished. Add purposeful, coherent visual assets under existing human design authority. Observable criteria live in the [feature checklist](mvp-feature-checklist.md).

Weekly testing must expose an explicit **Advance to next week (test)** button for the real, duplicate-safe application lifecycle in the authorized demo context. It must report actual results and preserve real network time and purchase-approval expiry. A visual date change alone does not satisfy this requirement.

## PWA goal — DEC-082

The MVP should be usable as an installable Progressive Web App on supported mobile and desktop browsers. Acceptance includes app identity/icons and standalone launch, responsive installed layouts, clear offline/unavailable behavior and safe app updates. Payments, funding and parent decisions require an online server-confirmed result; offline actions must never imply settlement. Push notifications and offline financial submission are not required by this goal. Implementation approach remains undecided. See the [feature checklist](mvp-feature-checklist.md) for observable criteria and current evidence; task status remains in the [implementation plan](implementation-plan.md).

## Users and purpose

For students aged 13+ receiving allowance from an OFW parent, PadalaPocket provides spending within agreed parental boundaries alongside personal money the student controls. Parent visibility and peace of mind are desired outcomes; demand, reduced stress and improved financial independence are not validated effects. See [problem capture](../work/problem-capture.md).

## Scope

Up to ten financially enabled families, each with one parent and one student and isolated app-managed Testnet wallets, paying one hard-configured seller. Other families may register/link without financial access. Working parent-funded Needs/Wants allowance, AI identification, purchase approval/expiry, Savings, private My Money, weekly demo lifecycle, Noir/Velo Testnet integration and simulated test-anchor withdrawal. Custody and provisioning details remain open.

Defer multiple children, additional purchase-type support, real peso/GCash settlement, production scheduling and seller-generated payment requests. Category catalog and six-category demo selection remain canonical in [idea](../seed/idea.md#category-catalog). Event requirements/deadline remain in [context](../seed/context.md).

## Features and observable acceptance criteria

| ID | Feature | Acceptance criteria |
|---|---|---|
| F-001 | Parent funding and allowance setup | Parent sees available funding-wallet balance and configures weekly allowance, Needs/Wants ratio, purchase cap and allowed categories per bucket. Ratio defaults to 60/40 and is adjustable. Demo shows a confirmed Testnet allocation reducing available parent funds and increasing student allowance; a browser animation alone cannot establish funding. |
| F-002 | Weekly lifecycle and demo clock | Two explicit steps advance first to the 24-hour reminder, then the weekly event; if already within 24 hours remind immediately without rewinding. Notify both parent and student. A schedule change supersedes the old occurrence; use the latest saved allowance amount when the event begins. While either advance action is running, the parent cannot change allowance amount or schedule; enforce this in the UI and server, including direct API calls and concurrent changes (DEC-100). No blanket restriction on other settings is implied. Settle confirmed leftovers and allocate as allowed; preserve actual network and approval time. Atomic race handling and lock timing for failed, interrupted, unknown or resumed operations remain technical safety questions. |
| F-003 | Allowance purchase and AI identification | Student supplies seller details, manually enters price and submits a product photo. AI identifies the pictured product and checks category consistency against the allowance rules. Show the photo, student-entered price, identification and outcome in parent-visible allowance history. No claim that the photo proves actual goods delivered or verifies market price. |
| F-004 | Purchase decisions and exceptions | Within-balance purchases passing identification/category/cap checks can proceed automatically. Over-cap or category-conflict purchases wait for parent approval. The parent can approve or reject the particular recipient/amount/photo request. No approval within 10 minutes means expiry without payment or final allowance deduction. My Money is exempt. |
| F-005 | Failure handling | Reject insufficient selected-bucket funds and notify the student, not the parent; notify the student when that bucket becomes zero after a successful purchase. No approval request, debt or cross-bucket borrowing. Uncertain/unavailable AI explains the limitation and never approves payment; technical failures and unknown payment outcomes remain distinct from success. |
| F-006 | Savings release | Student requests an amount from Savings. Parent approval transfers that amount into My Money; rejection causes no transfer. Savings is intended for emergencies and later use beyond allowance dependence. Approval releases the amount rather than restricting subsequent purchases. |
| F-007 | My Money freedom and privacy | My Money purchases require no photo, parental approval or parental category/cap check. Parent app access must not expose the current balance or purchase details through views, notifications, exports or APIs. Student sees their own balance/history. Parent may know amounts they allocated or approved for release. Insufficient balance and technical constraints still apply. |
| F-008 | Genuine Testnet payment and withdrawal | Distinguish purchase authorization and confirmed seller claim. After confirmed claim, attempt withdrawal when withdrawable seller funds meet the anchor minimum; accumulate below it, batch at most the anchor maximum and stop on failed/unknown results without unsafe retry. Show each student their own claim and sanitized aggregate seller withdrawal status, without other families or unsupported per-purchase attribution. The researched 1–10 XLM reference-anchor limits are time-sensitive; unattended SEP-24 feasibility is unresolved. Fiat payout is simulated, never real GCash. |

Student may cancel a slow photo scan or continue waiting. A cancelled scan discards any late AI response and must not proceed to purchase; after a cancelled or failed scan, the student starts again by providing the photo and purchase details (DEC-101). These are requirements, not a claim of implementation.

## Demo journey

Money display under DEC-045/046/049: show simulated Philippine pesos alongside the corresponding actual Testnet XLM amount used for the transfer. Peso figures are illustrative; Testnet XLM has no redeemable peso value. Use the frozen ₱9.68/XLM reference checked 2026-11-07 PHT; source evidence is EV-026. Logical balances for Needs, Wants, Savings and My Money remain separate under DEC-048/049. Convert with integer nearest-stroop rounding; assign bucket-split remainder to Wants. Budget fees and account reserves outside spendable balances. These are accepted demo rules, not production exchange or payout commitments.

1. Show parent setup, funding-wallet balance and weekly allocation settings.
2. Advance to week start and demonstrate allowance transfer into Needs/Wants.
3. Student photographs a permitted item; AI identifies it and the agent makes a Testnet payment. Merchant claims it.
4. Demonstrate an exception requiring parent approval; separately exercise rejection, expiry, unclear-photo retry and insufficient funds. Not every case must occupy the two-minute submission video.
5. Advance to the reminder, then the weekly event; show both roles' reminder and confirmed rollover/allocation or truthful pending/skip state.
6. Student requests Savings funds; parent approves transfer into My Money. Demonstrate private spending without a photo or parental restrictions.
7. Demonstrate the test-anchor withdrawal with simulated fiat payout.

Demo time advances application scheduling only. Stellar network time and real purchase-approval expiry never move with it.

## Important security and correctness rules

- Parent/student permissions must be enforced server-side. My Money app privacy does not guarantee anonymity on Stellar's public ledger; wallet linkage needs technical review before stronger claims.
- Keep parent/agent/merchant signing authority explicit. Server-held signing keys and API secrets never enter browser bundles or source control. The demonstration seller requires a genuine signing path to claim.
- Bind parent approval and the AI assessment to the exact purchase. A changed recipient, amount, photo or funding bucket must not silently reuse an earlier approval.
- Avoid double allocation, rollover, release or payment when an action is repeated. Pending/unknown payments must be reconciled before retries or week-end balance movements.
- Entered GCash details or a scanned QR identify intended future payout recipients; they do not establish a real GCash payment route. Use synthetic recipient data for the demo.
- No static image labels, seeded transaction hashes or simulated integrations may be described as live AI or successful real SDK operations. Disclose fixtures and external dependencies.
- Apply [delivery guardrails](../guides/anti-slop-guardrails.md). Do not mark any criterion verified without evidence.

## Proposed defaults for one review

These were proposed for review; later decisions supersede any conflicting item (including DEC-072, DEC-073 and DEC-098):

- Use Philippine time (Asia/Manila) for the demo week and Monday 00:00 as its boundary.
- Parent selects categories independently per bucket; student chooses a funded bucket and category before allowance review. AI checks consistency, not the family's underlying purpose for an item.
- Expire unresolved prior-week purchase requests before rollover; finish or reconcile submitted payments first. Complete rollover before allocating the next week's funds.
- If parent funds are insufficient at allocation time, skip that allocation and notify the parent; no partial funding or automatic debt.
- When advancing demo time past multiple scheduled events, process each due event once in chronological order, including the reminder.
- Persistent image uncertainty continues to require a new photo or cancellation; no extra escalation option or arbitrary retry cap for the first demo.
- Savings requests remain pending until parent action; they do not inherit the purchase-request timeout.

## Feasibility and review items

- Prove Noir SDK → signing → selected Velo SDK role → ledger confirmation → merchant claim. Standard Velo checkout recognition of Noir calls cannot be assumed. Parent approval of an over-cap purchase does not itself override Noir's on-chain cap; define and verify an exception path without weakening routine policy.
- Evaluate real-image identification accuracy and latency with uncertain/misclassified images; the current Groq integration exists, but the reported expiry cause and any future provider/model choice remain unverified.
- Unattended SEP-24 and current anchor limits remain open despite the separate completed Testnet experiment; see [B-004](../handoff/B-004.md) and [EV-020](../work/evidence-ledger.md).
- QR mapping remains open where relevant; DEC-046/049 already select the simulated peso mapping and rounding.
- Agree proposed defaults above, money rounding, rule-change effects and pending balance accounting before dependent build tasks. No real-world uptake or savings metrics are promised.
- Establish frontend/backend skills, hosting/resources, actual remaining working hours and design authority. Design ownership remains in [design brief](design-brief.md).

## Decision and evidence ownership

Requirements live here; accepted choices and supersessions live in [decision ledger](decision-ledger.md); research and limitations live in [evidence ledger](../work/evidence-ledger.md). Task status lives only in [implementation plan](implementation-plan.md). This draft records acceptance criteria, not completed implementation or verification.

Account credentials decision (DEC-089): parent and student use separate email/password identities and verify their emails. A parent creates a family and an email-bound expiring setup code; the student redeems it after their own verification. New-family payment access requires independent wallet provisioning; it cannot reuse demo custody. Tutorials remain the last planned onboarding work.

## Current MVP operational choices — DEC-093–DEC-099

- Parent simulated deposits accept centavos from ₱10 through the family's remaining ₱5,000 lifetime cumulative cap, including all ₱5,000 at once; unlimited count within the cap. One pending deposit blocks only another deposit, not use of confirmed funds. Parent can cancel an unpaid pending deposit only with race reconciliation; unknown stays blocked. Explain minimum, cap or temporarily unavailable safe project funds on rejection. Remaining cap is operator-visible, not parent-visible.
- DEC-102 selects a confirmed project-wallet receipt and transfer to the correct family parent wallet before the deposit is available; repeated use of the same payment must not credit twice. Uncertain outcomes remain pending. This flow is not yet implemented.
- Present simulated PHP prefixed ₱ as primary, with legible XLM accessible by touch and keyboard; confirmation shows both and the simulation disclosure at ₱9.68/XLM. No real fiat.
- Only explicit operator disable frees capacity, after uncertain operations are reconciled and confirmed recoverable family funds returned to the project wallet; keep necessary keys/records, account for unavoidable fees/reserves, and never pretend unsafe cleanup succeeded. No automatic seller-to-project recycling. A disabled family cannot re-enable; existing users can sign in and create/join a new family in either role with a fresh cap and private prior history. Collect first and last name once at first sign-in; no account name editing in MVP.
- A local operator CLI is intended to introduce itself and offer error history, all-family list, disable, return and exit. List linked names/emails, financial status, deposit totals and pending separately, including disabled families. Provide safe agent-readable noninteractive queries and explicitly authorized mutation with preview and confirmation. Retain significant backend errors, including resolved, newest first for 30 days; redact credentials, keys, photos and PII. Do not automatically delete financial journals. No error emails or status page. This is a target, not an existing-script claim.
- AI uncertain/unavailable and latency, and login/dashboard latency, are user-reported concerns, not diagnosed causes or measured results. Measure before setting targets; do not suppress failures or choose a provider/model by implication. Founder handles functional tutorial pages/routing last; visual ownership remains with the human frontend designer.
