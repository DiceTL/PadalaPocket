# PadalaPocket MVP product spec

Draft for review, derived from [DEC-006–DEC-029](decision-ledger.md). Concept/demo scope accepted; proposed defaults below are not team decisions. The reduced submission build is authorized under DEC-055.

## Five-hour submission MVP

This section records the DEC-055 reduced release scope. Later connected slices and DEC-070/DEC-084/DEC-085 extend parent review beyond the original blocked-only behavior; current evidence is in the [feature checklist](mvp-feature-checklist.md).

DEC-055 narrows the current delivery target to one provisioned parent, student and fixed demonstration seller. The broader scope and feature table below remain the post-deadline roadmap wherever they exceed this section.

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

One parent, one student and one demonstration seller. Working parent-funded Needs/Wants allowance, AI photo identification, purchase approval/expiry, Savings, private My Money, weekly lifecycle via labeled demo time, Noir/Velo Testnet integration and test-anchor withdrawal.

Defer multiple children, additional purchase-type support, real peso/GCash settlement, production scheduling and seller-generated payment requests. Category catalog and six-category demo selection remain canonical in [idea](../seed/idea.md#category-catalog). Event requirements/deadline remain in [context](../seed/context.md).

## Features and observable acceptance criteria

| ID | Feature | Acceptance criteria |
|---|---|---|
| F-001 | Parent funding and allowance setup | Parent sees available funding-wallet balance and configures weekly allowance, Needs/Wants ratio, purchase cap and allowed categories per bucket. Ratio defaults to 60/40 and is adjustable. Demo shows a confirmed Testnet allocation reducing available parent funds and increasing student allowance; a browser animation alone cannot establish funding. |
| F-002 | Weekly lifecycle and demo clock | A clearly labeled control advances demo time to week start and week end. Week-start demonstration allocates the configured allowance; week-end demonstration moves leftover Needs to Savings and leftover Wants to My Money. Show the scheduled-funding reminder 24 hours before the next allocation. Keep demo time distinct from real ledger timestamps and do not claim a production scheduler. |
| F-003 | Allowance purchase and AI identification | Student supplies seller details, manually enters price and submits a product photo. AI identifies the pictured product and checks category consistency against the allowance rules. Show the photo, student-entered price, identification and outcome in parent-visible allowance history. No claim that the photo proves actual goods delivered or verifies market price. |
| F-004 | Purchase decisions and exceptions | Within-balance purchases passing identification/category/cap checks can proceed automatically. Over-cap or category-conflict purchases wait for parent approval. The parent can approve or reject the particular recipient/amount/photo request. No approval within 10 minutes means expiry without payment or final allowance deduction. My Money is exempt. |
| F-005 | Failure handling | Insufficient selected-bucket funds means rejection and parent-app notification, not an approval request or automatic borrowing. Uncertain AI identification explains the supported limitation and asks for another photo; it does not approve payment. Technical failures and unknown payment outcomes must remain distinct from confirmed success. |
| F-006 | Savings release | Student requests an amount from Savings. Parent approval transfers that amount into My Money; rejection causes no transfer. Savings is intended for emergencies and later use beyond allowance dependence. Approval releases the amount rather than restricting subsequent purchases. |
| F-007 | My Money freedom and privacy | My Money purchases require no photo, parental approval or parental category/cap check. Parent app access must not expose the current balance or purchase details through views, notifications, exports or APIs. Student sees their own balance/history. Parent may know amounts they allocated or approved for release. Insufficient balance and technical constraints still apply. |
| F-008 | Genuine Testnet payment and withdrawal | Agent payments use the required deployed Noir contracts through the Noir SDK; Velo SDK has a demonstrated role. Record confirmed transaction hashes and distinguish allowance deduction/merchant pending funds from merchant claim into its wallet. Demonstrate authenticated test-anchor withdrawal and actual returned status; disclose simulated fiat payout and never claim pesos arrived in GCash. |

## Demo journey

Money display under DEC-045/046/049: show simulated Philippine pesos alongside the corresponding actual Testnet XLM amount used for the transfer. Peso figures are illustrative; Testnet XLM has no redeemable peso value. Use the frozen ₱9.68/XLM reference checked 2026-11-07 PHT; source evidence is EV-026. Logical balances for Needs, Wants, Savings and My Money remain separate under DEC-048/049. Convert with integer nearest-stroop rounding; assign bucket-split remainder to Wants. Budget fees and account reserves outside spendable balances. These are accepted demo rules, not production exchange or payout commitments.

1. Show parent setup, funding-wallet balance and weekly allocation settings.
2. Advance to week start and demonstrate allowance transfer into Needs/Wants.
3. Student photographs a permitted item; AI identifies it and the agent makes a Testnet payment. Merchant claims it.
4. Demonstrate an exception requiring parent approval; separately exercise rejection, expiry, unclear-photo retry and insufficient funds. Not every case must occupy the two-minute submission video.
5. Advance to the reminder and week end; show notification and leftover transfers. Advance to the next week start to show recurring allocation.
6. Student requests Savings funds; parent approves transfer into My Money. Demonstrate private spending without a photo or parental restrictions.
7. Demonstrate the test-anchor withdrawal with simulated fiat payout.

Demo time advances application scheduling/expiry demonstrations only. Stellar contract expiry and transaction validity use real network time; the demo control must not pretend to change the network clock.

## Important security and correctness rules

- Parent/student permissions must be enforced server-side. My Money app privacy does not guarantee anonymity on Stellar's public ledger; wallet linkage needs technical review before stronger claims.
- Keep parent/agent/merchant signing authority explicit. Server-held signing keys and API secrets never enter browser bundles or source control. The demonstration seller requires a genuine signing path to claim.
- Bind parent approval and the AI assessment to the exact purchase. A changed recipient, amount, photo or funding bucket must not silently reuse an earlier approval.
- Avoid double allocation, rollover, release or payment when an action is repeated. Pending/unknown payments must be reconciled before retries or week-end balance movements.
- Entered GCash details or a scanned QR identify intended future payout recipients; they do not establish a real GCash payment route. Use synthetic recipient data for the demo.
- No static image labels, seeded transaction hashes or simulated integrations may be described as live AI or successful real SDK operations. Disclose fixtures and external dependencies.
- Apply [delivery guardrails](../guides/anti-slop-guardrails.md). Do not mark any criterion verified without evidence.

## Proposed defaults for one review

These reduce further question-by-question planning; each remains a proposal:

- Use Philippine time (Asia/Manila) for the demo week and Monday 00:00 as its boundary.
- Parent selects categories independently per bucket; student chooses a funded bucket and category before allowance review. AI checks consistency, not the family's underlying purpose for an item.
- Expire unresolved prior-week purchase requests before rollover; finish or reconcile submitted payments first. Complete rollover before allocating the next week's funds.
- If parent funds are insufficient at allocation time, skip that allocation and notify the parent; no partial funding or automatic debt.
- When advancing demo time past multiple scheduled events, process each due event once in chronological order, including the reminder.
- Persistent image uncertainty continues to require a new photo or cancellation; no extra escalation option or arbitrary retry cap for the first demo.
- Savings requests remain pending until parent action; they do not inherit the purchase-request timeout.

## Feasibility and review items

- Prove Noir SDK → signing → selected Velo SDK role → ledger confirmation → merchant claim. Standard Velo checkout recognition of Noir calls cannot be assumed. Parent approval of an over-cap purchase does not itself override Noir's on-chain cap; define and verify an exception path without weakening routine policy.
- Prove real AI identification for the selected categories, including uncertain and misclassified images. AI provider, model, data handling, confidence behavior and credentials are not chosen.
- Prove test-anchor authentication and withdrawal after merchant claim. Public capability discovery is the only completed service check so far; see [evidence ledger](../work/evidence-ledger.md), EV-020–EV-021.
- Decide the exact QR format/demo mapping and explicit peso-display-to-Testnet-asset mapping. No real conversion rate is implied.
- Agree proposed defaults above, money rounding, rule-change effects and pending balance accounting before dependent build tasks. No real-world uptake or savings metrics are promised.
- Establish frontend/backend skills, hosting/resources, actual remaining working hours and design authority. Design ownership remains in [design brief](design-brief.md).

## Decision and evidence ownership

Requirements live here; accepted choices and supersessions live in [decision ledger](decision-ledger.md); research and limitations live in [evidence ledger](../work/evidence-ledger.md). Task status lives only in [implementation plan](implementation-plan.md). This draft records acceptance criteria, not completed implementation or verification.
