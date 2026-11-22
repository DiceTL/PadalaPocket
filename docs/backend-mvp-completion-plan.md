# Backend MVP Completion Plan

**Accepted:** D1 A and the Decision Sheet defaults. **Your Groq API key has expired; replacing it is a required setup task, not something to diagnose again.**

Execution requirements live here; task status lives only in the [implementation plan](implementation-plan.md#backend-mvp-completion--t01t37). Each task has a scoped [handoff packet](../handoff/T01.md) for acceptance evidence and links to the [MVP feature checklist](mvp-feature-checklist.md#backend-task-to-acceptance-map). Creating packets does not start later tasks.

## 1. Current backend state

- **VERIFIED — Code:** `apps/api/src/router.mjs` exposes accounts, identity, family rules/activity, purchases, funding, weekly controls and Velo top-ups.
- **VERIFIED — Code:** the frontend’s existing API contract is defined in `apps/web/src/client/api.js`; it remains unchanged.
- **VERIFIED — Code:** new families remain financially blocked by `WALLET_SETUP_REQUIRED`; independent family provisioning is absent.
- **VERIFIED — Code:** funding and purchase providers use shared demo signing keys rather than family-specific keys.
- **VERIFIED — Recorded evidence:** Needs/Wants allocation, purchase approval, seller claim and weekly rollover have bounded historical Testnet proofs; those proofs do not establish current multi-family acceptance.
- **VERIFIED — Code:** Velo top-ups journal checkout identity and status but do not transfer deposits to independent family wallets or credit backed family balances.
- **VERIFIED — Code:** Savings release, private My Money spending, family disable and general interrupted-operation recovery remain incomplete.
- **VERIFIED — Owner report:** the Groq credential has expired. `purchase-providers.mjs` currently contains a fixed model and synchronous assessment request.
- **UNVERIFIED — Hosted custody:** Vault installation, restricted SQL access and actual backup restoration have not been demonstrated.
- **UNVERIFIED — Release:** current deployment parity, unattended anchor withdrawal and the complete two-family financial journey are not established.

## 2. Backend MVP checklist

**Execution rules**

- Work through phases in order. Each task includes implementation and its verification.
- Existing API paths, payloads, response fields, error envelopes and supported statuses remain compatible.
- New backend capabilities use additive endpoints. Missing frontend calls are explicitly outside backend completion.
- T01 creates one verification entry point: `npm run verify:backend -- <check-name>`. Each Done-check below is one invocation returning exit code **0 for pass**, nonzero for fail.
- Verification uses the existing Node test framework, real isolated database checks and bounded live scripts as appropriate. Test doubles do not establish provider or deployed acceptance.
- Financial checks use synthetic accounts and Testnet funds. Existing unrelated family data and historical journals remain intact.
- Before starting a task, open its packet linked under the phase below. The task row here owns its scope/done-check; Part 3 owns model, effort and independent-review requirements. Packets link these contracts rather than redefining them.

### Evidence and checklist update procedure

Every backend task completion includes these documentation updates in the same change:

1. Record the actual command, dated PASS/FAIL result, environment, changed files, sanitized proof and limits in `handoff/Txx.md`. Record required independent review and corrections; changes after review need another review. Never include credentials, signing material or raw provider responses.
2. Follow the packet's checklist links and the [task-to-acceptance map](mvp-feature-checklist.md#backend-task-to-acceptance-map). Update every affected detailed checklist item, including any matching decision-acceptance item, with a dated packet evidence link.
3. Check `[x]` only when the entire described criterion has evidence. For a partly delivered item, keep `[ ]`, state the verified backend portion and remaining work, and link the packet. Split backend and browser/release criteria only when both parts remain explicit. A passing backend API check never closes missing UI, inbox, device, live-provider or deployment acceptance.
4. Refresh affected checklist summaries if the implemented boundary changed. For prerequisite-only tasks, record “no feature criterion closed” and link the foundation evidence instead of marking a product feature complete.
5. Update only the task's row in the [implementation plan](implementation-plan.md#backend-mvp-completion--t01t37). Check success, review, merge and deployment evidence remain distinct; do not create another status field in packets or this plan.

These are required task-delivery edits, not an automatic checkbox script. They do not rerun paid/live proofs or authorize shared migrations, deployments, funding, credentials or frontend edits. User approvals still apply. Stop after the current task and wait for “next”.

**Part 1 — Test-first rule**

> - From T02 onward, write the task’s done-check first and confirm it fails: **red**.
> - Implement until that same check passes: **green**.
> - Then refactor—improve structure without changing behavior—only code written in the current task.
> - Do not refactor frontend files or code belonging to another task.
> - After refactoring, rerun ALL previously passing checks, with live checks kept inside their approved budgets.
> - Setup/dashboard tasks without testable code are exempt from red-first.
> - Live-provider or AI-behavior checks in T14, T22, T28 and T29 may be written alongside implementation.
> - Report only PASS or FAIL per check; do not output raw logs.

**Shared instruction:** T02 onward follows Part 1, including its exceptions; the task done-check criteria remain unchanged.

### Phase 1 — Establish contracts and execution access

Packets: [T01](../handoff/T01.md), [T02](../handoff/T02.md), [T03](../handoff/T03.md), [T04](../handoff/T04.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T01** | Capture the existing client’s routes, methods, payloads, consumed fields and errors; add the verification entry point using existing tests and proof scripts. | All existing screens | `contract-baseline`: existing client requests and responses pass without changing frontend files. |
| **T02** | Establish separate verification identities/resources, migration configuration and operator authorization; keep administrative and signing credentials server-only. | Sign-in and family setup | `environment`: required backend access is available, test resources are isolated and credentials are absent from public responses. |
| **T03** | Configure a replacement Groq credential through the provider’s account controls; validate an available vision model and make model selection configurable in `purchase-providers.mjs`. Do not call the expired credential. | Purchase photo assessment | `vision-access`: one bounded real-image request returns a valid assessment using the replacement credential. |
| **T04** | Correct deployed Auth URL/email configuration and verify signup, confirmation, resend, enrollment and student-code errors through existing account contracts. | Registration and linking | `identity`: the real confirmation/enrollment journey succeeds and unauthorized, expired and reused-code cases fail correctly. |

### Phase 2 — Implement durable financial execution

Packets: [T05](../handoff/T05.md), [T06](../handoff/T06.md), [T07](../handoff/T07.md), [T08](../handoff/T08.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T05** | Add durable operation, reservation and signed-step records with immutable family, purpose, network and request identities; use integer amounts and transactional uniqueness constraints. | All financial actions | `money-journal`: concurrent identical requests produce one operation and one reservation; conflicting payloads are rejected. |
| **T06** | Implement coordinated signing and dispatch per source account; persist the exact signed transaction before sending and make confirmed checkpoints resumable. **Detail at implementation time.** | Funding, purchases and long-running operations | `dispatch-boundary`: separate workers and a paused stale worker cannot create competing signed replacements or duplicate execution. |
| **T07** | Implement exact-identity reconciliation and protect uncertain work; missing evidence, timeouts and `NOT_FOUND` never authorize credit, release or replacement. | Pending/error states and refresh | `recovery-boundary`: interruption tests preserve reservations, confirm observed success once and leave unsupported cases fenced. |
| **T08** | Cut every backend financial writer over to the coordinated path, including operator scripts and shared seller operations; retire unsafe dispatch paths without clearing historical unknowns. | All financial actions | `writer-cutover`: an old deployment/operator path cannot dispatch against the active signing authority outside the coordinator. |

### Phase 3 — Secure keys and provision families

Packets: [T09](../handoff/T09.md), [T10](../handoff/T10.md), [T11](../handoff/T11.md), [T12](../handoff/T12.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T09** | Configure Supabase Vault with narrow server-only access; bind each secret reference to its family, role, public address, network and version. Never expose generic secret retrieval to clients. | Financial account setup | `custody-access`: public, student, parent and cross-family attempts cannot retrieve signing keys; authorized backend signing succeeds. |
| **T10** | Rehearse disposable-key retrieval in a fresh process and backup restoration in isolated resources; retain the necessary encryption-key recovery material under operator control. | Reliable account continuity | `custody-restore`: the restored key matches its original public address and verifies a signature; incorrect bindings fail. |
| **T11** | Implement durable parent, student and routine-agent account provisioning; create the required Noir device resources and policies; fund operational reserves separately from family principal. | Wallet readiness and allowance setup | `family-provision`: one isolated family has confirmed account/resource ownership, protected keys and sufficient measured operating funds. |
| **T12** | Admit at most ten linked families atomically and expose readiness without changing `/api/me` compatibility; overflow families retain registration/linking access but no financial authority. | Setup and unavailable states | `family-capacity`: concurrent admissions enable no more than ten families; partial setup and overflow remain financially fenced. |

### Phase 4 — Complete deposits and parent balances

Packets: [T13](../handoff/T13.md), [T14](../handoff/T14.md), [T15](../handoff/T15.md), [T16](../handoff/T16.md), [T17](../handoff/T17.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T13** | Extend `velo-topups.mjs` with explicit simulated PHP deposit input, frozen conversion, minimum/cumulative-cap reservations and one unresolved deposit per family; preserve legacy `{expectedRevision}` requests. | Deposit creation | `deposit-admission`: centavos, ₱10 minimum, full ₱5,000, cumulative boundaries, replay and concurrent requests enforce the locked rules. |
| **T14** | Implement the app-managed payer and approved Velo reporting adapter; save its own signed payment/hash before submission and verify Velo plus Stellar receiver, amount, asset and network. | Deposit payment and status | `deposit-receipt`: one bounded live checkout becomes paid with matching independently verified evidence; mismatches and provider errors produce no family credit. |
| **T15** | Reserve confirmed project receipts once, reject payment reuse and execute one project-to-family-parent transfer; finalize deposit credit only after confirmed backing. | Deposit completion | `deposit-credit`: concurrent/repeated confirmation credits only the intended family once, with a matching confirmed transfer. |
| **T16** | Add cancellation admission and reconciliation; cancellation before dispatch prevents payment, while possible dispatch remains pending until resolved. Preserve use of previously confirmed funds. | Deposit cancellation and pending states | `deposit-cancel`: cancellation/payment races produce neither lost confirmed receipts, duplicate credit nor premature replacement admission. |
| **T17** | Expose available parent principal, pending transfers and deposit history; exclude reserves, operating float and allocations already moved to Noir. Keep existing `paid` presentation truthful. | Parent balance, Deposit and Overview | `parent-balance`: projected funds reconcile to confirmed holdings and reservations; pending receipts never appear spendable. |

### Phase 5 — Finish allowance, purchases and AI behavior

Packets: [T18](../handoff/T18.md), [T19](../handoff/T19.md), [T20](../handoff/T20.md), [T21](../handoff/T21.md), [T22](../handoff/T22.md), [T23](../handoff/T23.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T18** | Refactor `funding.mjs` and payment providers to select authorized family keys/resources; preserve saved-rule revisions, exact amounts, whole-allocation confirmation and the fixed seller. | Allowance distribution and Needs/Wants | `family-allowance`: two families allocate and spend without using each other’s principal or signing authority. |
| **T19** | Coordinate shared-seller claim admission and preserve attributable purchase evidence; retain conservative serialization until aggregate attribution is verified. | Purchase payment and claim status | `seller-claims`: interleaved family purchases settle once each, reconcile merchant pending funds and expose no other-family purchase data. |
| **T20** | Preserve exact-request parent consent, held amounts, rejection and ten-real-minute expiry; integrate exception steps with the execution coordinator. | Approvals and purchase activity | `purchase-decisions`: approval/rejection/expiry races and repeated execution preserve consent, principal and a single confirmed claim. |
| **T21** | Add a durable assessment-cancellation endpoint keyed to the authenticated attempt; guard the assessment-to-payment transition and discard cancelled late results. Retry requires photo/details again. | Scan cancellation and retry | `scan-cancel`: cancellation before financial admission prevents any later AI response from starting payment; fresh retry is independent. |
| **T22** | Validate real images against the category catalog and improve assessment context within the existing Groq integration; preserve uncertainty, restricted-item handling and no-payment failures. | Product identification | `vision-behavior`: supported boundary images produce valid decisions, while ambiguous, restricted, malformed and unavailable cases never silently pay. |
| **T23** | Add recipient-scoped, duplicate-safe student notices for insufficient selected-bucket funds and successful purchases that empty the bucket. | Student notifications and activity | `bucket-notices`: the student receives each qualifying event once; parents and unrelated families cannot retrieve it. |

### Phase 6 — Complete Savings, My Money and weekly execution

Packets: [T24](../handoff/T24.md), [T25](../handoff/T25.md), [T26](../handoff/T26.md), [T27](../handoff/T27.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T24** | Implement exact-amount Savings requests, holds and parent approval/rejection; confirm Savings-to-My-Money transfers before destination credit. | Savings requests and approvals | `savings-release`: duplicate/concurrent decisions release principal once; rejection moves nothing and uncertainty retains the hold. |
| **T25** | Implement student-authorized private spending and history without photo, category/cap restrictions or parent approval; retain funds, seller and technical authorization checks. | My Money | `private-money`: confirmed spending conserves funds and parent access fails across IDs, lists, totals and notices. |
| **T26** | Extend `weekly.mjs` with separate reminder/event actions, both-role notices, replacement schedule identity and no-rewind behavior; preserve the legacy next-week request. | Weekly controls and reminder | `weekly-boundaries`: each action runs once, reminders reach both roles and the event uses the latest settings saved at admission. |
| **T27** | Enforce the amount/schedule restriction throughout running advances and safe unresolved continuations; coordinate rollover, next allocation and all shared financial resources. | Rules, schedule and weekly recap | `weekly-safety`: settings races are rejected, rollover conserves funds and insufficient parent principal skips the entire new allocation without debt. |

### Phase 7 — Complete seller withdrawal and operator lifecycle

Packets: [T28](../handoff/T28.md), [T29](../handoff/T29.md), [T30](../handoff/T30.md), [T31](../handoff/T31.md), [T32](../handoff/T32.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T28** | Implement a reference-anchor adapter using validated SEP-10, retained session identity and approved synthetic interactive automation; reject changed origins/instructions and stop on uncertain initiation. | Withdrawal initiation/status | `anchor-adapter`: one bounded session reaches genuine transfer instructions without browser redirects or adapter output declaring success. |
| **T29** | Trigger withdrawal attempts after confirmed claims, reserve seller funds, accumulate below minimum and batch within the current maximum; serialize against seller claims. | Automatic withdrawal | `withdrawal-execution`: a bounded app-driven transfer reaches authenticated anchor `completed`; duplicate triggers, failures and unknowns never send a second withdrawal. |
| **T30** | Expose sanitized seller summaries separately from each student’s purchase evidence; retain simulated-fiat disclosure and no unsupported per-purchase payout attribution. | Withdrawal evidence | `withdrawal-privacy`: each student sees their own claim and permitted aggregate status, with no other-family purchase information. |
| **T31** | Implement the authorized local operator menu and safe noninteractive queries, family listing and thirty-day significant error history; redact secrets, photos and sensitive diagnostics. | Operational support | `operator-access`: read queries are safe, logs remain redacted and mutations require authorization plus preview and confirmation. |
| **T32** | Implement permanent family disable, blocked new actions, retained recovery keys/journals and confirmed recoverable return before slot release; exclude shared seller proceeds. | Family lifecycle and support | `family-disable`: known recoverable funds return once, unknown work retains its slot, and former members create/join a fresh isolated family in either role. |

### Phase 8 — Finish account state and release acceptance

Packets: [T33](../handoff/T33.md), [T34](../handoff/T34.md), [T35](../handoff/T35.md), [T36](../handoff/T36.md), [T37](../handoff/T37.md).

| Task | Backend work and main location | Frontend feature served | Done-check |
|---|---|---|---|
| **T33** | Add first/last-name collection and read contracts, followed by independent per-account tutorial progress/completion/resume APIs after financial journeys stabilize. | Account guidance and onboarding | `account-progress`: names persist, roles keep separate tutorial progress and completed guidance does not reset at every sign-in. |
| **T34** | Measure database/API latency and remove demonstrated redundant work without weakening authorization or presenting stale financial results as confirmed. | Login and dashboard loading | `backend-performance`: representative requests meet the accepted backend p95 targets; external Auth, AI and ledger waiting are reported separately. |
| **T35** | Run the combined real-database concurrency, isolation and interruption matrix; complete bounded live evidence for the new family paths rather than repeating unchanged proofs. | All financial screens | `backend-acceptance`: every required scenario passes with conserved funds, correct authority and truthful status. |
| **T36** | Deploy matching backend code, ordered migrations, secrets and permissions; exercise the unchanged client contract and additive APIs against the deployed release. | All existing screens | `deployed-acceptance`: authenticated parent/student journeys and isolation checks pass against the intended deployment. |
| **T37** | Finish backend request/response/error documentation, setup, operator recovery instructions and evidence references; record backend-only client integration gaps explicitly. | Backend handoff | `backend-handoff`: an independent clean setup passes the backend acceptance command using its own credentials and Testnet resources. |

**Backend completion requires all 37 checks to pass.** A failed live provider check remains a release failure, not a successful mock or an assumed completion.

### Part 2 — Your action

**Labels describe your personal involvement, not who writes the code.** UNDERSTAND means you must explain the safety rule afterward; it does not require you to implement or investigate it.

| Task | Your action |
|---|---|
| **T01 — Contract baseline** | **NONE:** I can inspect the existing interface and prepare its checks. |
| **T02 — Execution environment** | **UNVERIFIED:** Additional dashboard or credential action depends on access that has not been confirmed. |
| **T03 — Groq access** | **DO:** Obtain a replacement Groq credential and configure it as a server-only secret without posting it in chat. |
| **T04 — Account delivery** | **DO:** Open the verification email sent to your controlled test inbox and confirm that its link returns to the deployed app. |
| **T05 — Financial journal** | **UNDERSTAND:** Explain why one request creates one financial operation and why pending money is reserved rather than available. |
| **T06 — Coordinated dispatch** | **UNDERSTAND:** Explain why two workers must not independently sign replacement transfers for the same action. |
| **T07 — Reconciliation** | **UNDERSTAND:** Explain why a timeout or missing transaction result does not mean the transfer failed. |
| **T08 — Writer cutover** | **UNDERSTAND:** Explain why old deployments and scripts must lose their ability to send outside the new execution path. |
| **T09 — Vault access** | **UNDERSTAND:** Explain who can retrieve family keys and why browser access, broad secret lookup and exposed backend credentials are unsafe. |
| **T10 — Key restoration** | **UNDERSTAND:** Explain which backup and encryption material must survive to recover the same wallet. |
| **T11 — Family provisioning** | **DO:** Approve the named Testnet funding source and the cumulative principal, reserve and fee limits for provisioning and later live checks. |
| **T12 — Family capacity** | **NONE:** I can implement and verify the ten-family admission limit. |
| **T13 — Deposit admission** | **NONE:** I can implement and verify deposit limits, pending reservations and request reuse. |
| **T14 — Velo receipt** | **NONE:** I can execute the bounded checkout proof within the approved Testnet budget. |
| **T15 — Deposit credit** | **UNDERSTAND:** Explain why Velo’s paid status alone cannot create a spendable family balance. |
| **T16 — Deposit cancellation** | **UNDERSTAND:** Explain why cancellation after possible payment dispatch stays pending until the existing payment is resolved. |
| **T17 — Parent balance** | **UNDERSTAND:** Explain the difference between available family principal, reserved funds and project-paid operating costs. |
| **T18 — Family allowance** | **NONE:** I can replace shared-demo signing with family-specific authority and verify isolation. |
| **T19 — Shared seller claims** | **UNDERSTAND:** Explain why several families sharing one seller still need coordinated claims and separate purchase records. |
| **T20 — Parent decisions** | **NONE:** I can preserve exact-request consent and verify approval, rejection and expiry races. |
| **T21 — Scan cancellation** | **NONE:** I can implement and verify the boundary that prevents a cancelled scan from starting payment. |
| **T22 — Vision behavior** | **NONE:** I can evaluate the model against permitted test images and report pass/fail behavior. |
| **T23 — Bucket notices** | **NONE:** I can implement and verify recipient access and duplicate prevention for notifications. |
| **T24 — Savings release** | **NONE:** I can implement and verify held funds, exact parent decisions and confirmed release. |
| **T25 — My Money** | **NONE:** I can implement and verify private spending, balance conservation and parent-access denial. |
| **T26 — Weekly boundaries** | **NONE:** I can implement and verify reminder/event identity and repeated-request handling. |
| **T27 — Weekly safety** | **NONE:** I can verify settings restrictions, rollover and all-or-nothing allocation under concurrent requests. |
| **T28 — Anchor adapter** | **NONE:** I can implement and check the approved Testnet adapter using synthetic seller details. |
| **T29 — Withdrawal execution** | **UNDERSTAND:** Explain why a successful seller payment, a confirmed anchor transfer and completed withdrawal are separate facts. |
| **T30 — Withdrawal privacy** | **NONE:** I can verify that seller summaries disclose no other family’s purchases. |
| **T31 — Operator access** | **UNDERSTAND:** Explain which operator commands only read information and which require explicit authorization and confirmation. |
| **T32 — Family disable** | **UNDERSTAND:** Explain why unresolved funds prevent slot release and why shared seller funds are excluded from family recovery. |
| **T33 — Account progress** | **NONE:** I can implement and verify names and separate per-account tutorial progress. |
| **T34 — Backend performance** | **NONE:** I can measure and improve backend delays without weakening access or balance accuracy. |
| **T35 — Combined acceptance** | **NONE:** I can execute the combined financial, isolation and interruption checks. |
| **T36 — Deployment acceptance** | **DO:** Authorize the final backend deployment and its approved production migration/configuration changes. |
| **T37 — Backend handoff** | **NONE:** I can prepare the handoff and verify an independent clean setup. |

### Part 3 — Model, effort and second review

Review policy approved under [DEC-103](decision-ledger.md). Implementation models and efforts in the table remain unchanged. Independent review examines the changed code and relevant evidence, not a redesign or a repeated repository-wide audit. Actual credit savings and reviewer reliability remain **UNVERIFIED**.

**T04 has a standalone Terra review. There is no T02–T04 checkpoint and no new T02/T03 review assignment.** Existing review history remains evidence, not a newly commissioned review.

| Review scope | Reviewer / effort | Focus |
|---|---|---|
| T04 only | Terra / Medium | Configuration, credential handling and test validity; escalate actual application permission changes to Sol |
| T05–T08 | Astra / Medium | Journals, stale workers, dispatch/recovery fences and old writers |
| T09–T12 | Astra / Medium | Key access/restoration, family ownership, provisioning and capacity |
| T13–T17 | Astra / Medium | Receipt reuse, backed credit, cancellation and spendable balances |
| T18–T21 | Sol / Medium | Family authority, shared claims, exact consent and scan cancellation |
| T23–T27 | Sol / Medium | Recipient/private-money privacy, conservation and weekly races |
| T28–T30 | Sol / Medium | Anchor instructions, duplicate withdrawal and disclosure |
| T31–T32 | Sol / Medium | Operator privilege, recovery and safe slot release |
| T33 | Terra / Medium | Account ownership and independent progress; escalate new permission boundaries to Sol |

- Every task still requires its done-check and applicable earlier checks. No new standalone review for T01, T03, T22 or T34–T37.
- Review **before risky use**, not merely at the end of a group: dispatch before authority cutover/financial dispatch; custody and restore before funded provisioning; receipt/credit logic before live credit. Split a checkpoint at that prerequisite, then review only subsequent changes at group closure. This adds targeted passes when necessary, not repeated whole-group reviews.
- Corrections require a targeted independent re-review of the corrected/new changes, not re-review of unchanged work.
- Nonfinancial next tasks may proceed while review is pending. Task order, owner “next”, explicit operation approvals and review/merge/release acceptance gates still apply; passing checks do not fabricate review acceptance.
- T04/T33 Terra reviews do not authorize Terra to implement or approve new signing, custody, financial execution or application permission boundaries; escalate those changes to Sol/Astra as appropriate.

| Task | Model | Effort | Second review |
|---|---|---|---|
| **T01 — Contract baseline** | Terra | Medium | N — inventory and checks, not authorization changes |
| **T02 — Execution environment** | Sol | Medium | No new review — retain recorded history; no T02–T04 checkpoint |
| **T03 — Groq access** | Terra | Medium | N |
| **T04 — Account delivery** | Sol | Medium | Terra, Medium — standalone review of T04 changes |
| **T05 — Financial journal** — Risk if wrong: duplicate requests reserve or credit money twice. | Sol | Medium | Astra, Medium — grouped T05–T08 checkpoint; no separate task review |
| **T06 — Coordinated dispatch** — Risk if wrong: an old worker sends a duplicate transfer. | **Sol implements; Astra reviews only** | **High implementation:** races across workers require careful reasoning. | Astra, Medium — grouped T05–T08 checkpoint; no separate task review |
| **T07 — Reconciliation** — Risk if wrong: an uncertain transfer is released or repeated incorrectly. | Sol | Medium | Astra, Medium — grouped T05–T08 checkpoint; no separate task review |
| **T08 — Writer cutover** — Risk if wrong: old deployments retain permission to send outside the safeguards. | Sol | **High:** account for old and current writers together. | Astra, Medium — grouped T05–T08 checkpoint; no separate task review |
| **T09 — Vault access** — Risk if wrong: one permission error exposes family signing keys. | **Sol implements; Astra reviews only** | **High implementation:** SQL permissions and application access must agree. | Astra, Medium — grouped T09–T12 checkpoint; no separate task review |
| **T10 — Key restoration** — Risk if wrong: restored data cannot recover the correct wallet. | Sol | Medium | Astra, Medium — grouped T09–T12 checkpoint; no separate task review |
| **T11 — Family provisioning** — Risk if wrong: a family receives incorrectly owned resources or cannot access its funds. | Sol | Medium | Astra, Medium — grouped T09–T12 checkpoint; no separate task review |
| **T12 — Family capacity** — Risk if wrong: concurrent setup enables excess or incomplete families. | Sol | Medium | Astra, Medium — grouped T09–T12 checkpoint; no separate task review |
| **T13 — Deposit admission** — Risk if wrong: concurrent deposits exceed the cap or reserve the same funds twice. | Sol | Medium | Astra, Medium — grouped T13–T17 checkpoint; no separate task review |
| **T14 — Velo receipt** — Risk if wrong: an incorrect or reused payment is accepted as deposit backing. | Sol | Medium | Astra, Medium — grouped T13–T17 checkpoint; no separate task review |
| **T15 — Deposit credit** — Risk if wrong: one payment creates duplicate credit or funds the wrong family. | **Sol implements; Astra reviews only** | **High implementation:** payment, reservation and transfer records must remain consistent through interruptions. | Astra, Medium — grouped T13–T17 checkpoint; no separate task review |
| **T16 — Deposit cancellation** — Risk if wrong: cancellation releases funds while payment still succeeds. | Sol | Medium | Astra, Medium — grouped T13–T17 checkpoint; no separate task review |
| **T17 — Parent balance** — Risk if wrong: reserved, pending or operating funds appear spendable. | Sol | Medium | Astra, Medium — grouped T13–T17 checkpoint; no separate task review |
| **T18 — Family allowance** — Risk if wrong: an action uses another family’s key or funds. | Sol | Medium | Sol, Medium — grouped T18–T21 checkpoint; no separate task review |
| **T19 — Shared seller claims** — Risk if wrong: shared claims duplicate settlement or assign it to the wrong purchase. | Sol | Medium | Sol, Medium — grouped T18–T21 checkpoint; no separate task review |
| **T20 — Parent decisions** — Risk if wrong: payment proceeds without valid consent or after rejection/expiry. | Sol | Medium | Sol, Medium — grouped T18–T21 checkpoint; no separate task review |
| **T21 — Scan cancellation** — Risk if wrong: a late scan result starts payment after cancellation. | Sol | Medium | Sol, Medium — grouped T18–T21 checkpoint; no separate task review |
| **T22 — Vision behavior** | Terra | Medium | N — changes stay within assessment and behavior checks, not financial authorization |
| **T23 — Bucket notices** | Sol | Medium | Sol, Medium — grouped T23–T27 checkpoint; no separate task review |
| **T24 — Savings release** — Risk if wrong: the same Savings principal is released more than once. | Sol | Medium | Sol, Medium — grouped T23–T27 checkpoint; no separate task review |
| **T25 — My Money** — Risk if wrong: private funds are overspent or disclosed to the parent. | Sol | Medium | Sol, Medium — grouped T23–T27 checkpoint; no separate task review |
| **T26 — Weekly boundaries** — Risk if wrong: repeated advancement starts the same financial event twice. | Sol | Medium | Sol, Medium — grouped T23–T27 checkpoint; no separate task review |
| **T27 — Weekly safety** — Risk if wrong: interrupted rollover or allocation duplicates or misplaces principal. | Sol | **High:** coordinate several money movements and concurrent settings changes. | Sol, Medium — grouped T23–T27 checkpoint; no separate task review |
| **T28 — Anchor adapter** — Risk if wrong: invalid authentication or transfer instructions direct funds incorrectly. | Sol | Medium | Sol, Medium — grouped T28–T30 checkpoint; no separate task review |
| **T29 — Withdrawal execution** — Risk if wrong: a withdrawal is duplicated or consumes reserved funds. | Sol | Medium | Sol, Medium — grouped T28–T30 checkpoint; no separate task review |
| **T30 — Withdrawal privacy** | Sol | Medium | Sol, Medium — grouped T28–T30 checkpoint; no separate task review |
| **T31 — Operator access** | Sol | Medium | Sol, Medium — grouped T31–T32 checkpoint; no separate task review |
| **T32 — Family disable** — Risk if wrong: funds become inaccessible or a slot is released before recovery finishes. | Sol | Medium | Sol, Medium — grouped T31–T32 checkpoint; no separate task review |
| **T33 — Account progress** | Sol | Medium | Terra, Medium — account ownership/progress |
| **T34 — Backend performance** | Terra | Medium | N — preserve authorization and financial logic; existing checks are the gate |
| **T35 — Combined acceptance** — Risk if wrong: failed financial or isolation checks are reported as passing. | **Terra — run established checks only** | Medium | N — failures return to the relevant implementation task |
| **T36 — Deployment acceptance** — Risk if wrong: checks accept the wrong release or configuration. | **Terra — execute the approved procedure and checks only** | Medium | N — owner authorizes deployment; code changes return to their assigned task |
| **T37 — Backend handoff** | Terra | Medium | N — documentation and established setup checks |

**Execution limits:** T35 and T36 run established procedures/checks only; failures return to the assigned implementation task. T34 does not authorize financial or authorization changes. Reviewer changes do not change implementation authority.

**Allocation:** Sol implements **30 tasks**; Terra implements **7**; Astra implements **0**. Nine scheduled review scopes: **3 Astra**, **4 Sol**, **2 Terra** (T04 and T33). Seven are grouped checkpoints; prerequisite/correction passes can add reviews. Five implementation tasks retain High effort; other implementation and review work remains Medium. No review is being executed by this documentation change.

## 3. Start here — first five tasks

1. **T01 — Contract baseline:** lock the existing frontend/backend interface and create the verification entry point.
2. **T02 — Execution environment:** establish isolated verification resources and server/operator access.
3. **T03 — Groq access:** configure a replacement credential and verify one real vision request.
4. **T04 — Account delivery:** finish deployed email confirmation, enrollment and linking acceptance.
5. **T05 — Financial journal:** implement atomic operation identities, reservations and duplicate protection.

## 4. ASSUMED defaults and revisit after MVP

**ASSUMED — implementation defaults**

- **Frontend remains fixed.** Explicit deposit amounts/cancellation, scan cancellation, separate reminder advancement, Savings release, private spending, names and tutorial progress are additive backend contracts. The existing client does not call all of them; their backend acceptance uses authenticated API checks.
- **Groq stays the AI provider.** Configure a replacement credential through the existing provider account, then select an available image-capable model that passes the required behavior checks. No test is sent to the expired credential.
- **Supabase Vault is the key store.** It protects stored secrets, not against a compromised authorized signing runtime or database administrator.
- **Each enabled family has separate parent, student and routine-agent signing accounts.** Noir bucket devices remain contract resources.
- **The project pays operating costs.** Family principal excludes account reserves and subsidized fees; insufficient operating funds reject new admissions.
- **Deposits use a dedicated project-managed simulated payer and project receiver.** Family Velo accounts are not required by the selected flow.
- **One deposit payment transaction belongs to one deposit.** Store its network/hash and matched payment evidence; do not split one receipt across families.
- **Shared seller execution stays serialized.** Family isolation does not remove shared seller or project-wallet coordination.
- **A confirmed deposit payment wins over an unsuccessful cancellation attempt.** It completes the approved family-credit path; cancellation alone never reverses a ledger payment.
- **Unknown operations remain fenced.** Only evidence-supported continuation is offered; automatic general repair is not required.
- **Provider adapters are Testnet-specific.** Unexpected responses fail closed. No manual-withdrawal substitute or fabricated provider result satisfies automatic withdrawal.
- **Operational continuation is durable and bounded.** Do not depend on browser presence or fire-and-forget work surviving a Vercel response; detail at implementation time.
- **Performance targets remain p95 ≤1 second for database-backed reads and ≤2 seconds for nonfinancial writes.** Report third-party waiting separately; do not add an AI timeout that silently overrides the student’s cancel-or-wait choice.
- **Financial live verification uses explicit principal and aggregate-fee budgets.** Measure and enforce them before dispatch; deterministic boundary cases use isolated database tests instead of unnecessary large payments.
- **No fixed calendar expiry for Savings requests.** Requests remain pending until decision or a family-lifecycle action safely resolves them.
- **Documentation changes occur during authorized implementation.** Preserve dated evidence and task-status ownership; leave README revisions until finalization.
- **T05 journal storage defaults.** A request UUID is unique per family across purposes; source/destination references remain opaque, and saved envelopes are limited to 1 MiB. These are identity/storage constraints, not new wallet routing or permission to move funds; see the [journal contract](technical-spec.md#t05-durable-money-journal--dec-104).
- **T06 coordination default.** Preparation and send claims do not expire into replacement authority. Continue from saved bytes/confirmed checkpoints; abandoned or uncertain work remains fenced for evidence-supported recovery. See the [dispatch contract](technical-spec.md#t06-coordinated-dispatch--dec-106); this does not add the deferred prolonged-reservation support concern.
- **T07 observation default.** At most one saved-hash provider lookup per reconciliation call; no signing, sending, credit, principal release or automatic repair. Verified retained checkpoints need no provider lookup. See the [recovery contract](technical-spec.md#t07-exact-identity-recovery--dec-107).

**Revisit after MVP — none of these blocks backend completion**

- **Prolonged reservations — separate post-Phase 8 concern (DEC-105).** After T37, assess whether additional implementation is needed to identify and escalate long-unresolved reservations and improve their resolution. Decide scope, ownership and any response-time target then; no guaranteed resolution time or automatic release is approved. T07's existing evidence-based reconciliation and T37's recovery handoff remain required in Phase 8 and earlier. Never release or replace uncertain funds based only on elapsed time.

- Frontend controls for additive APIs, tutorial presentation, visual design, PWA installation and device presentation.
- Production custody, real-money deposits, real fiat payout, compliance and independent security audit.
- Replacing approved provider-specific adapters with stable supported interfaces.
- Additional paid infrastructure, broader seller support, multiple children and production weekly scheduling.
- Performance optimization beyond the accepted targets and replacing Groq after the configured model passes MVP acceptance.
