# Implementation plan

Feature acceptance/evidence snapshot: [MVP feature checklist](mvp-feature-checklist.md). PWA support is an accepted goal under DEC-082; implementation is not started or authorized by the checklist alone and requires a scoped handoff. Task status remains here.

DEC-083 adds real email signup/linked child setup, purposeful visual assets and explicit next-week testing to the target. Prepare scoped handoffs before implementation; existing R/L/UI acceptance is not extended automatically. Build the information board and per-new-account tutorial last, after the functional journeys are complete. These additions are not delivered features.

Revised 2026-11-07 under [DEC-034/DEC-042–DEC-049](decision-ledger.md). This is the only task-status source. S-001 is accepted at implementation commit `58f4b6c`: fresh committed-clone checks and deployed health verification passed; remote CI is green per founder report. Evidence and limitations live in [S-001](../handoff/S-001.md). S-002 is Done; see its acceptance packet. C-001 is Done: backend acceptance and reported green branch/PR/main CI are recorded in its packet. B-001 is merged as `e1382f0`; founder confirms passing PR/main CI. B-002 is accepted and merged with passing branch/main CI per founder confirmation. B-003 is Done: separate bucket backing verified, backend review accepted, founder reports branch/main CI passed; merged as `5c9f034` (B-003 branch commit `0a41be6`). B-004 is Done. DEC-055 supersedes the original remaining sequence with the deadline plan below. Product requirements remain in [product spec](product-spec.md), system design in [architecture](architecture.md), interfaces in [technical spec](technical-spec.md), and UI authority in [design brief](design-brief.md).

S tasks and C-001–C-006 are implemented, verified and accepted solely by backend under [DEC-039](decision-ledger.md). Frontend feedback and personal workspace evidence are optional. Backend runs checkpoint integration checks against completed FE work; existing FE dependencies and human UI design ownership remain in force.

## Five-hour submission build — DEC-055

This sequence supersedes the original serial execution gates for this deadline. Start baseline **2026-11-07 04:40 PHT**, recording-ready target **09:40 PHT**. The supplied handbook closes submissions at **12:00 PHT**. Protect the remaining 2h20 for recording, upload and submission. These are time budgets, not estimates derived from points or a guarantee.

The active product scope is [the reduced submission MVP](product-spec.md#five-hour-submission-mvp). Backend and frontend work concurrently after a short contract freeze. The existing stack and human design authority remain applicable. Reuse verified primitives from B-001–B-004; scripts are evidence/reference implementations, not ready-made public endpoints.

| Window (PHT) | Backend | Frontend | Required result |
|---|---|---|---|
| 04:40–05:00 | R-001A: release minimum identity/data contracts; check resource access | Prepare approved screens and consume released identity contract | Shared interfaces; blockers visible; this is not delivery acceptance |
| 05:00–05:30 | R-001B: provisioned Auth, trusted /api/me and minimal durable database operation deployed | R-003: connect both real logins and API identity immediately | First delivery gate: both accounts work on public deployment; data survives another request |
| 05:30–06:00 | R-002: authenticated, durable, repeat-safe Needs funding | R-003: connect funding/status immediately | Go/no-go gate: confirmed backing, persisted status, duplicate-safe funding |
| 06:00–07:20 | R-002: photo AI, rules, Noir authorization and claim | R-003: connect each route as it becomes available | Progressively deployed AI → rules → payment/claim; no final integration wait |
| 07:20–08:40 | R-004: harden complete deployed journey and reconciliation | Repair integrated journey and target viewport issues | Real uninterrupted journey plus failure checks |
| 08:40–09:40 | Freeze features; final checks, README/evidence and rehearsal | Blocking presentation fixes and recording preparation | Recording-ready deployment and two-minute script |

| Active packet | Owner / dependency | Effort points | State |
|---|---|---|---|
| [R-001 Establish deployed identity foundation](../handoff/R-001.md) | Both deployed gates verified; founder confirms main GitHub Actions passed at `27b4b45` | 5 | Done |
| [R-002 Build live purchase backend](../handoff/R-002.md) | Backend; R-001 deployed gate; reviewed, CI green per founder, deployed at `db8b41b` and smoke checked | 13 | Done |
| [R-003 Build reduced demo screens](../handoff/R-003.md) | Frontend; live parent/student sign-in, funding and purchase views verified; CI green per founder; deployed at `db8b41b` | 8 | Done |
| [R-004 Integrate and prepare recording](../handoff/R-004.md) | R-002/R-003 accepted; deployed app/health and student/parent smoke checks passed; recording rehearsal/materials remain | 5 | In progress |

**Viability review (DEC-056):** current router handles health/operator proof only; web Auth rejects live mode; no supabase migration directory exists; wallet proof persistence and locks are local files. Product persistence/concurrency and deployed integration remain new work. The windows are aggressive operating budgets, not a dependable completion forecast. Five-hour readiness remains conditional on measured gates. This review did not inspect hosted credentials or run a live journey.

Funding delivery slice verified at 05:38 PHT (2026-11-07): parent action, confirmed Needs backing, refresh restoration and same-key replay passed on deployment `dpl_4qvM1r3HLwPrUwRybqjdDoepBbZH`. Photo-to-claim delivery slice, hashes and AI evidence are recorded in R-002. Final reviewed commit `db8b41b` has green GitHub Actions per founder and is deployed to Vercel Production as `dpl_7PmsfDpP1w9UW8RzQS7aKPmui1WX`. Vercel metadata matches the full commit SHA; production homepage, bundle and `/api/health` returned 200. Founder completed parent/student sign-in and read-only refresh checks; claimed and blocked purchase states persisted. R-002/R-003 are Done. R-004 is In progress for final rehearsal and submission materials. Funding recovery remains disabled; interrupted operations without a safe recovery fence remain blocked. No new live payment was made during the production smoke check.

R-001 has two gates: A releases usable contracts so frontend can start concurrently; B proves both deployed logins, trusted roles and a durable authorized database write/read. Only B permits R-001 acceptance. Frontend screen preparation and backend schema preparation can proceed before B, but document completion cannot establish readiness. Use shared durable database constraints; local files or process locks are not a deployed money journal.

At **06:00 PHT**, require authenticated confirmed Needs funding, a persisted result readable after a new request, and repeated/concurrent same-key requests producing no second transfer. If any element fails, announce the failed gate and **activate the fallback**: stop expanding the feature set, stabilize the actually working deployed subset, label unfinished/mock screens explicitly, and prepare a recording with separately identified existing Noir/Velo/AI/anchor proof evidence. Preserve security and money invariants. This fallback is an incomplete prototype submission, not completion of the reduced MVP and not a guarantee of event eligibility. R-004's MVP acceptance stays unmet. Record what works and what does not; retain the 09:40 rehearsal target and submission buffer. Do not silently move the gate when late; resuming the full target requires an explicit team decision based on recovered evidence.

During implementation, integrate and verify in this order: identity → confirmed funding → photo identification → authorization → merchant claim. Record each observed deployed result in the owning packet; do not wait until 07:20 to discover session/routing/persistence failures. R-004 gathers these observations rather than repeating successful provider calls. At 07:20, an incomplete purchase path triggers the same fallback; at 08:40 feature work stops.

Keep decisions and contracts short. Review each meaningful slice once, commit coherent work, and run relevant tests; run combined CI at integration/release boundaries. DEC-055 overrides one-branch-per-original-task and the original checkpoint dependency chain for these slices. Preserve existing security and money invariants. The backend edits shared contracts; frontend edits apps/web and its packet. Do not overwrite another builder's work. User retains commit/push control unless separately delegated.

A task from the original plan remains deferred unless its full original acceptance criteria are met. Completing a rescue slice does not automatically complete B-005–B-013 or FE-003–FE-006. FE-001/FE-002 merge is recorded locally as `65821fc`; remote CI acceptance still needs evidence.

## Relative effort estimation

Task estimates use Fibonacci points: **1, 2, 3, 5, 8, 13**. Points compare total work, technical complexity and uncertainty, including integration, automated tests, manual/live checks and review. They are initial planning judgments for this team and its AI-assisted workflow, not measured productivity or commitments.

| Points | Relative meaning | Project reference |
|---|---|---|
| 1 | Small, clear coordination/change with little uncertainty | C-001 shared setup handoff |
| 2 | Small bounded task requiring a few decisions | FE-001 design agreement |
| 3 | Moderate task with known boundaries and several checks | S-002 stable contracts and fixtures |
| 5 | Substantial feature or integration with multiple states | FE-003 setup/dashboard views |
| 8 | Complex behavior, cross-system integration or significant uncertainty | B-001 Noir/Velo proof; B-006 durable money accounting |
| 13 | Too large or uncertain for confident execution as one task | Split or investigate before starting |

Estimates were reassessed by task scope and risk, not converted from the old hour ranges. In particular, payment/policy/anchor investigations receive higher points because unknown external behavior can dominate the work. AI may accelerate code generation, but tests, review, service access and integration uncertainty remain part of the estimate. Use one shared scale; do not compare developers' performance using point totals or count a joint checkpoint twice.

**Points do not represent hours.** Do not convert points into an ETA, derive a completion date from their sum, or claim that this plan fits the deadline. The old 15.25–25-hour forecast and hourly task/reserve estimates are superseded. The team's stated under-30-hour target and the competition deadline remain separate constraints in [context](../seed/context.md); actual available time and its interpretation still need team confirmation.

Backend maintains the initial planning estimates; frontend may provide input. Under [DEC-040](decision-ledger.md), precise remaining work hours and estimate confirmation are not C-001 acceptance gates. The handbook deadline is known; actual personal availability remains uncertain. Re-estimate remaining affected tasks at C-002 and subsequent checkpoints when scope, evidence or dependencies change. Update the plan and packet together; do not alter completed-task estimates to manufacture predictable results. At 13 points, split into smaller sequential tasks or define a bounded investigation before execution.

## Investigation and deadline reviews

For B-001–B-004, record the specific question, intended experiment and expected evidence before starting. Review immediately after the first experiment and whenever new access barriers, unsupported capabilities or repeated failures appear. Record the exact blocker and supported alternatives; if external access or a team decision prevents progress, mark Blocked and coordinate. Agree any further experiment before retrying the same approach indefinitely. These are outcome-based review points, not a point-to-time conversion.

At every checkpoint compare actual remaining availability with unfinished required outcomes and risks. Protect the integration and release work in C-001–C-006; do not consume their capacity on extra features. If time looks insufficient, the founder decides whether to change scope, approach or available time. No feature is silently cut and a failed investigation is not marked Done. Multiple children, real GCash payout and production scheduling remain deferred.

## File ownership and proposed file map

These are future paths, not existing application files. Keep changes within task scope; choose small feature files as needed rather than scaffolding every future module now.

| Area | Owner | Responsibility |
|---|---|---|
| Root package/config/lockfile, `.env.example`, deployment routing | Backend | Workspaces, reproducible commands and shared configuration |
| `apps/api/` | Backend | Auth/access, rules, AI, payments, accounting, demo clock, anchor routes and backend tests |
| `supabase/` | Backend | Migrations, policies and reproducible database setup |
| `handoff/api-examples/` | Backend writes and approves; frontend may provide feedback | Synthetic versioned request/response fixtures and endpoint mapping, created in S-002 |
| `apps/web/` | Frontend after FE-001 | Approved views, request client, mock development mode and UI tests |
| Connected-flow tests | Backend owns suite/config; frontend owns web interaction tests | Choose one location and owner per test; avoid both developers creating competing suites |
| Architecture, contracts and decisions | Backend owns technical decisions and approval; frontend may provide feedback | Canonical docs updated with relevant changes |
| This plan | Backend coordinates status updates | One editor at a time; frontend supplies evidence in its own task packet |
| Task packets | Task owner | Scope and verification evidence, never a separate status tracker |

Shared fixtures are data files, not a new runtime shared library. Add shared executable code only if actual reuse requires it and record any architecture change. Frontend does not independently install dependencies that change the shared lockfile; coordinate with backend first.

## Shared setup

| Task / packet | Dependency | Effort points | State |
|---|---|---|---|
| [S-001 Shared workspace and Git foundation](../handoff/S-001.md) | Build authorization and stack review; acceptance evidence recorded | 5 | Done |
| [S-002 API contracts and development fixtures](../handoff/S-002.md) | S-001 accepted at `58f4b6c`; accepted by backend; remote checks pass; merged as `60e9910` | 3 | Done |

## Backend sequence

| Task / packet | Dependency | Effort points | State |
|---|---|---|---|
| [B-001 Noir/Velo payment and claim proof](../handoff/B-001.md) | C-001 satisfied. Direct Noir device/agent registration, escrow funding, passing check, authorization and merchant claim are hosted Testnet SUCCESS; separate Velo checkout is paid and Horizon verified. Backend accepted implementation/evidence; PR #4 merged as `e1382f0`; founder confirms PR/main CI passed (2026-11-07) | 8 | Done |
| [B-002 Verify parent-approved cap exception](../handoff/B-002.md) | B-001 merged `e1382f0`; isolated exception/claim/revocation succeeded; ordinary cap unchanged; founder confirms B-002 merge to main and passing branch/main GitHub Actions (2026-11-07); merge hash unavailable locally | 8 | Done |
| [B-003 Verify wallet backing and money mapping](../handoff/B-003.md) | B-002 accepted; funding/withdrawal/private isolation and fee-adjusted conservation verified on Testnet; founder accepts demo topology/accounting under DEC-049; backend review accepted after separate bucket proof; founder confirms branch/main CI passed and merge to main `5c9f034` (task commit `0a41be6`) | 8 | Done |
| [B-004 Verify anchor and AI access](../handoff/B-004.md) | Groq identified the synthetic sample; SEP-24 replacement withdrawal completed after confirmed 1-XLM Testnet transfer; backend review accepted; founder confirms branch and main CI passed; merged as `8f78d81` (branch commit `2dd1c06`) | 8 | Done |
| [B-005 Implement family authentication and private access](../handoff/B-005.md) | C-002 | 5 | Deferred under DEC-055 |
| [B-006 Implement durable money accounting](../handoff/B-006.md) | B-005 | 8 | Deferred under DEC-055 |
| [B-007 Parent rules and confirmed allowance funding](../handoff/B-007.md) | B-006 | 5 | Deferred under DEC-055 |
| [B-008 Implement photo AI and retry](../handoff/B-008.md) | C-003 | 5 | Deferred under DEC-055 |
| [B-009 Implement rules and parent decisions](../handoff/B-009.md) | B-008 | 5 | Deferred under DEC-055 |
| [B-010 Implement payment execution and reconciliation](../handoff/B-010.md) | B-009 | 8 | Deferred under DEC-055 |
| [B-011 Implement Savings and private My Money](../handoff/B-011.md) | C-004 | 5 | Deferred under DEC-055 |
| [B-012 Implement weekly clock and transfers](../handoff/B-012.md) | B-011 | 8 | Deferred under DEC-055 |
| [B-013 Withdrawal endpoints and hosted recovery](../handoff/B-013.md) | B-012 | 5 | Deferred under DEC-055 |

## Frontend sequence

| Task / packet | Dependency | Effort points | State |
|---|---|---|---|
| [FE-001 Design agreement and contract review](../handoff/FE-001.md) | Design/fixture acceptance recorded on frontend branch; local integration review/checks passed; commit and CI acceptance pending | 2 | In progress |
| [FE-002 Build approved shell and stable mock states](../handoff/FE-002.md) | Shell and mock states implemented on frontend branch; local integration review/checks passed; commit and CI acceptance pending | 3 | In progress |
| [FE-003 Build allowance setup and dashboards](../handoff/FE-003.md) | C-002 | 5 | Deferred under DEC-055 |
| [FE-004 Student purchase, parent review and status screens](../handoff/FE-004.md) | C-003 | 8 | Deferred under DEC-055 |
| [FE-005 Savings, My Money and weekly clock screens](../handoff/FE-005.md) | C-004 | 5 | Deferred under DEC-055 |
| [FE-006 Withdrawal and complete demo integration preparation](../handoff/FE-006.md) | FE-005 | 3 | Deferred under DEC-055 |

## Joint checkpoints

| Task / packet | Dependency | Effort points | State |
|---|---|---|---|
| [C-001 Shared setup handoff](../handoff/C-001.md) | S-002 satisfied; backend accepted; green CI reported; merged at `85e2077` | 1 | Done |
| [C-002 Finalize contracts after feasibility](../handoff/C-002.md) | B-004 and FE-002 | 3 | Deferred under DEC-055 |
| [C-003 Connect identity and allowance funding](../handoff/C-003.md) | B-007 and FE-003 | 3 | Deferred under DEC-055 |
| [C-004 Connect photo purchase, approval and merchant claim](../handoff/C-004.md) | B-010 and FE-004 | 5 | Deferred under DEC-055 |
| [C-005 Connect weekly lifecycle, private funds and withdrawal](../handoff/C-005.md) | B-013 and FE-006 | 5 | Deferred under DEC-055 |
| [C-006 Submission and reproducible demo](../handoff/C-006.md) | C-005 | 5 | Deferred under DEC-055 |

## Shared-edit protocol

For S/C tasks, backend records the edit scope/reservation and may proceed without frontend acknowledgment or review under DEC-039. Resolve any actual overlapping edits before merge. The coordination steps below do not add a frontend participation gate.

1. Before editing a shared file, announce the task, exact paths and intended interface change in the team's agreed channel/PR. The AI does not send messages on its own; the human developer coordinates.
2. The file owner acknowledges and names one editor and merge order. The other developer leaves those paths untouched until release; this temporary reservation is recorded in the task PR, not as a second status tracker.
3. That editor updates contracts/fixtures/tests/config together, obtains backend review and merges the shared change first. For S/C tasks, frontend review or acknowledgment is not a gate under DEC-039. Backend regenerates the lockfile using the agreed package manager; nobody hand-merges lockfile contents blindly.
4. The owner posts the merged commit and releases the reservation; the other developer syncs main before continuing affected work. Resolve any resulting conflicts together and rerun impacted checks.
5. Backend alone edits this plan and each checkpoint packet. Backend gathers checkpoint UI/test evidence; frontend contributions are optional for S/C tasks. Each developer owns evidence edits in their own task packets. No automatic outside messaging or unsolicited posting is authorized.

## Git branches and merges

S-001 exception under DEC-036: backend alone reviews and accepts this task. Direct work on `main` is permitted; record the accepted commit instead of requiring a PR/merge or teammate review. Fresh committed-clone, remote CI and hosted routing/runtime checks remain required. The existing local branch is `setup/S-001`; this documentation change does not switch branches or commit files.

- Keep `main` runnable. Shared setup uses `setup/S-001`, then `setup/S-002`; merge each after its checks/review. Both tracks start from the C-001 base commit.
- Use one short-lived branch per task: `backend/B-001`, `frontend/FE-001`, and so on. Checkpoints may use `integration/C-003` to assemble and check coordinated changes before merging to `main`.
- At each task start, fetch and branch from the latest merged `main`. Commit small coherent changes. Do not edit another developer's active branch, rewrite shared history, force-push or resolve a conflict by blindly choosing one side.
- Completed task branches merge after backend acceptance and relevant checks. Backend is the sole technical reviewer and task acceptance authority, including checkpoints; frontend may optionally provide implementation evidence and feedback. Backend coordinates root/shared files and status updates. Merge completed tasks promptly rather than waiting until the whole track ends. A passing mock-only screen may merge in its labeled development mode; it must not replace an available real integration in the submission configuration.
- Before merge, update the task branch with current `main` using a normal merge and rerun checks affected by the combined changes. At checkpoints, merge the verified integration branch into `main`; both developers sync before starting their next task. Use a consistent merge method; avoid repeated rebasing of branches another person uses.
- Notify the other developer before changing root manifests/lockfile, deployment configuration, API examples or interfaces. Agree one editor and merge order. Regenerate the lockfile with the agreed package manager after coordinated manifest changes; do not hand-edit it or run competing installs on separate branches without coordination.
- A contract change updates the technical spec, fixtures and affected tests/consumers in a coordinated change. Architectural changes also update the decision ledger and architecture. Frontend can keep consuming the previous agreed contract until the update is merged.
- For conflicts, the file owner resolves them with the other developer, reviews the combined behavior and reruns relevant checks. Git rules reduce conflicts; they do not guarantee conflict-free merges.

## Tests and definition of done

S-001 establishes actual test commands/tools for each workspace and records them in setup documentation. It also creates automated PR checks for clean install, contract validation, workspace tests and build; a known failing check must fail CI. Require green checks before every merge. Use repository-required checks when permissions permit; otherwise the reviewer verifies CI manually and records the limitation. Ordinary PR checks use isolated test services/doubles; live AI/Testnet/anchor checks run explicitly and record separate evidence, never expose secrets to untrusted PR jobs. Do not claim a command exists until it has been implemented. Prefer a small test setup appropriate to JavaScript; avoid introducing duplicate frameworks. Write meaningful behavior/failure tests alongside the task, including a failing test first when practical for money/security rules.

| Check type | What it establishes |
|---|---|
| Backend automated tests | Rules, permissions, amount conversion, reservations, duplicate prevention, approval/expiry races and recovery |
| API/fixture contract tests | Responses use agreed fields/types/states; parent projections exclude My Money; examples match actual endpoint responses |
| Frontend written interaction tests | Each agreed response drives the right view/control behavior, including retries and duplicate-submit prevention |
| Connected automated checks | Browser/API interaction uses real implemented endpoints; isolated test doubles for providers are identified |
| Live/manual evidence | Real AI output, Noir/Velo Testnet authorization/claim, backed transfers, interactive anchor behavior, design/accessibility and deployed runtime |

Mark a task **Done** only when all its relevant acceptance criteria and automated tests pass, required manual/live checks are recorded, applicable delivery guardrails pass, and the reviewed changes are merged. Record commands, actual results, sanitized proof, limitations and merge commit in its packet. A failed required check or unverified external claim keeps the task open. Code generation alone, passing mocked provider tests, or a successful PR merge without acceptance evidence is insufficient.

Use states `Planned`, `In progress`, `Blocked`, `Review`, `Done`. A blocked row names the exact missing access/decision and next action. Update only the owning row here; the packet holds evidence without a duplicate status field. Keep frontend mock completion distinct from checkpoint completion. C-006 checks the final combined commit rather than relying only on earlier branch results.

## Task migration and planning history

All renumbered tasks were unstarted. Old links are not execution instructions; use current IDs above.

| Previous task | Current task(s) |
|---|---|
| B-001 | B-001 |
| B-002 | B-002 cap exception; B-003 routing/mapping; B-004 anchor/AI access |
| B-003 | B-005 authentication; B-006 accounting |
| B-004 | B-007 |
| B-005 | B-008 AI; B-009 decisions; B-010 execution |
| B-006 | B-011 Savings/My Money; B-012 weekly clock |
| B-007 | B-013 |
| F-001–F-005 | FE-001; FE-002/FE-003; FE-004; FE-005; FE-006 respectively |
| C-002–C-005 | C-003–C-006 respectively; new C-002 is contract review |

Product IDs F-001–F-008 are unchanged; frontend task packets use FE-001 onward. Current plan has 27 active packets, including shared tasks and checkpoints.

| Planning item | State | Evidence |
|---|---|---|
| SETUP-001 Workflow/source import | Done | Original setup record, 2026-11-05 |
| PLAN-001 Concept | Done | DEC-029 |
| PLAN-002 Product spec | Draft ready | Proposed defaults still need relevant decisions |
| PLAN-003 Technical scope | Draft ready | Architecture/contracts; EV-025 local imports only |
| PLAN-004 Plan/packets | Revised draft ready | DEC-032–DEC-034; relative effort points and document checks, no build executed |


## Figma layout implementation — DEC-062/DEC-063

| Task / packet | Scope | State |
|---|---|---|
| [UI-001 Implement Figma layouts and delegated screens](../handoff/UI-001.md) | Fourteen responsive previews and role shells under DEC-062–DEC-069. Local checks pass; full repository check also passes outside the sandbox under L-001. Team review/merge remain | Review |


## Connected-function delivery — DEC-070

User authorizes implementation of the broader functions after the UI previews. Original deferred tasks retain their acceptance scope. These stages do not imply completion of the original tasks or deployment.

| Packet | Scope | State |
|---|---|---|
| [L-001 Durable rules and private activity](../handoff/L-001.md) | Migration applied; local real-account save/reload, activity/private photos and full checks pass. Review, merge and production deployment remain | Review |
| [L-003A Parent allowance distribution](../handoff/L-003A.md) | Immediate priority under DEC-075: manual saved-amount Needs/Wants distribution; migration applied, real 0.6/0.4 XLM split and replay verified, parent/student UI checked. Production deployment remains | Review |
| [L-002 Parent purchase decisions](../handoff/L-002.md) | Priority 1: ten-minute expiry, exact-request parent decisions, isolated exception execution and live approval UI | Planned |
| [L-003 Backed family-wallet flows](../handoff/L-003.md) | Priority 2: backed Wants allocation/purchases, Savings release to private My Money and student-only My Money spending | Planned |
| L-004 Weekly lifecycle | Deferred by DEC-074: parent-chosen schedule, backed repeat allocation/rollover, reminders and demo clock | Deferred |
| L-005 Interactive withdrawal | Deferred by DEC-074: authenticated anchor initiation/reconciliation and frontend wiring | Deferred |

DEC-075 supersedes the order below: bounded L-003A allowance distribution comes first, per founder correction. Other L-003 flows and L-002 remain planned. DEC-074 originally prioritized L-002 and L-003. The two-hour window is a prioritization constraint, not a promise that complex payment/accounting delivery gates will fit. If checks or live evidence do not fit, preserve the verified state and report the unfinished criteria; do not relabel partial work as delivered. Manual funding is the temporary demo operation; do not portray static data as an automated weekly transfer.

## Velo integration — DEC-076

| Packet | Scope | State |
|---|---|---|
| [L-006 Velo parent wallet top-ups](../handoff/L-006.md) | Authenticated native Testnet checkout in parent Deposit, durable session journal, receiver validation and server status. Real create/replay/status and role UI verified; checks pass. Parent-owned Velo project configured and activated; verified matching-receiver ready checkout. Paid top-up and production deployment remain | Review |

## Live layout conversion — DEC-079

| Packet | Scope | State |
|---|---|---|
| [UI-002 Live application layouts](../handoff/UI-002.md) | Preview visual system applied to connected role pages, real dashboards, native controls and explicit unfinished states; full checks and mobile/desktop navigation/private-photo verification pass. Review/deployment remain | Review |

## Everyday categories — DEC-080

| Packet | Scope | State |
|---|---|---|
| [L-007 Everyday product categories](../handoff/L-007.md) | 15 product categories, shared AI/API definitions and versioned fresh-produce permission; checks and mobile/desktop controls verified. Deployment remains | Review |
