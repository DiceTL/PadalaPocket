# Implementation plan

Revised 2026-11-06 under [DEC-033](decision-ledger.md). This is the only task-status source. All build/checkpoint tasks below are Planned. No application work has been performed or authorized by these planning changes. Product requirements remain in [product spec](product-spec.md), system design in [architecture](architecture.md), interfaces in [technical spec](technical-spec.md), and UI authority in [design brief](design-brief.md).

## Execution order

Backend first completes S-001 → S-002; both meet at C-001. Then follow these sequences without skipping tasks:

| Phase | Backend | Frontend | Joint exit |
|---|---|---|---|
| Feasibility / stable mock interface | B-001 → B-002 → B-003 → B-004 | FE-001 → FE-002 | C-002: accept feasibility results and finalize affected contracts |
| Identity / allowance | B-005 → B-006 → B-007 | FE-003 | C-003: connect real login, settings and funding |
| Purchase | B-008 → B-009 → B-010 | FE-004 | C-004: connect real AI, decisions and payment/claim |
| Private funds / weekly lifecycle / withdrawal | B-011 → B-012 → B-013 | FE-005 → FE-006 | C-005: complete deployed journey |
| Release | Both | Both | C-006: final checks, README and demo materials |

Each developer works at their own pace in their current sequence. The first to a checkpoint waits for the other and may improve current-task tests/docs without skipping ahead. During the early feasibility phase frontend completes design, stable mock states and the request boundary rather than committing to unsettled wallet behavior. This reduces speculative rework, but backend remains the critical path; splitting tasks does not eliminate that workload imbalance.

Tell an AI: “Implement B-001 from this plan and its packet, within scope; run required checks and record evidence.” Start only when dependencies and build authorization are met. Packets hold acceptance/evidence; only this document holds status. F-xxx means product feature; FE-xxx means frontend task.

## Start gates and contract timing

Before S-001, confirm scoped build authorization, repository access, working stack and available hours. Shared infrastructure can precede UI design; product UI waits for FE-001's human design source or explicit delegation. Confirm provider credentials before the relevant investigation, without storing secrets in Markdown.

S-002 establishes stable envelopes and initial synthetic examples. Provider/wallet/mapping-dependent fields stay explicitly provisional. Frontend may mock stable states while backend investigates. At C-002 both accept or revise topology, mapping, required product defaults and affected request/response examples before either builds dependent features. Record decisions first, then update architecture, technical spec and fixtures together. If a required decision fails, stop its dependent tasks rather than inventing a successful fallback.

Mock data must match the accepted contract revision and include success, pending, empty, rejection and technical errors. Use the same small request interface for mock/live modes. Mock UI completion does not complete real integration. Real APIs are connected at C-003/C-004/C-005; demo mocks are disabled before C-005 passes.

## Time allocation and investigation limits

Estimates in the tables are rough active working hours, including focused tests and review preparation, not measured performance. Shared and joint tasks consume both developers' time. They provisionally treat the target as under 30 elapsed working hours with concurrent tracks; the team must confirm elapsed versus combined person-hours at start. The target is not proven achievable, and upper estimates can exhaust it before unexpected problems.

Using the dependency graph and concurrent tracks, these assumptions give a critical path of approximately **15.25–25 active elapsed hours**, including joint checkpoints but excluding account/provider waits and unexpected rework. At the upper estimate a 30-hour elapsed window leaves about five hours of contingency. This arithmetic is not a validated delivery estimate or evidence that the team has that time available.

Reserve approximately 3.5–5 hours for C-001–C-006 together; do not spend that reserve on extra features. Review remaining critical-path estimates at every checkpoint and report work versus time left. C-006 explicitly reserves 1–1.5 hours for final setup proof, README/video/write-up, rather than starting them with no time remaining. External account approvals/waits are not included; check access before work starts.

Investigation hard limits: B-001 payment/Velo proof 2 hours; B-002 cap exception 1 hour; B-003 wallet routing/mapping 1.5 hours; B-004 anchor/AI access 1 hour total. These are proposed working limits for execution, not statements that the services will work. At the limit, record evidence, exact blocker and best supported alternatives; mark Blocked and obtain a concrete team decision to extend the limit, revise the approach/scope or stop. Do not silently extend, skip sequential dependencies or mark an unsuccessful experiment Done. Other tasks use the upper estimate as a review trigger, not permission to cut acceptance checks.

No agreed feature is automatically cut. Multiple children, real GCash payout and production scheduling remain deferred. Re-estimate after B-004; if critical-path work plus the joint reserve exceeds available hours, the founder must decide scope or time before dependent build continues.

## File ownership and proposed file map

These are future paths, not existing application files. Keep changes within task scope; choose small feature files as needed rather than scaffolding every future module now.

| Area | Owner | Responsibility |
|---|---|---|
| Root package/config/lockfile, `.env.example`, deployment routing | Backend | Workspaces, reproducible commands and shared configuration |
| `apps/api/` | Backend | Auth/access, rules, AI, payments, accounting, demo clock, anchor routes and backend tests |
| `supabase/` | Backend | Migrations, policies and reproducible database setup |
| `handoff/api-examples/` | Backend writes; both review | Synthetic versioned request/response fixtures and endpoint mapping, created in S-002 |
| `apps/web/` | Frontend after FE-001 | Approved views, request client, mock development mode and UI tests |
| Connected-flow tests | Backend owns suite/config; frontend owns web interaction tests | Choose one location and owner per test; avoid both developers creating competing suites |
| Architecture, contracts and decisions | Backend coordinates; both review affected interfaces | Canonical docs updated with relevant changes |
| This plan | Backend coordinates status updates | One editor at a time; frontend supplies evidence in its own task packet |
| Task packets | Task owner | Scope and verification evidence, never a separate status tracker |

Shared fixtures are data files, not a new runtime shared library. Add shared executable code only if actual reuse requires it and record any architecture change. Frontend does not independently install dependencies that change the shared lockfile; coordinate with backend first.

## Shared setup

| Task / packet | Dependency | Effort hours | State |
|---|---|---|---|
| [S-001 Shared workspace and Git foundation](../handoff/S-001.md) | Build authorization and stack review | 1–1.5 | Planned |
| [S-002 API contracts and development fixtures](../handoff/S-002.md) | S-001 | 0.5–1 | Planned |

## Backend sequence

| Task / packet | Dependency | Effort hours | State |
|---|---|---|---|
| [B-001 Noir/Velo payment and claim proof](../handoff/B-001.md) | C-001; Velo access and fresh Testnet signers | 1–2 | Planned |
| [B-002 Verify parent-approved cap exception](../handoff/B-002.md) | B-001 | 0.5–1 | Planned |
| [B-003 Verify wallet backing and money mapping](../handoff/B-003.md) | B-002 | 0.75–1.5 | Planned |
| [B-004 Verify anchor and AI access](../handoff/B-004.md) | B-003 | 0.5–1 | Planned |
| [B-005 Implement family authentication and private access](../handoff/B-005.md) | C-002 | 1–1.5 | Planned |
| [B-006 Implement durable money accounting](../handoff/B-006.md) | B-005 | 1–1.5 | Planned |
| [B-007 Parent rules and confirmed allowance funding](../handoff/B-007.md) | B-006 | 0.75–1.25 | Planned |
| [B-008 Implement photo AI and retry](../handoff/B-008.md) | C-003 | 0.75–1.25 | Planned |
| [B-009 Implement rules and parent decisions](../handoff/B-009.md) | B-008 | 0.75–1.25 | Planned |
| [B-010 Implement payment execution and reconciliation](../handoff/B-010.md) | B-009 | 1–1.5 | Planned |
| [B-011 Implement Savings and private My Money](../handoff/B-011.md) | C-004 | 0.75–1.25 | Planned |
| [B-012 Implement weekly clock and transfers](../handoff/B-012.md) | B-011 | 0.75–1.25 | Planned |
| [B-013 Withdrawal endpoints and hosted recovery](../handoff/B-013.md) | B-012 | 0.75–1.25 | Planned |

## Frontend sequence

| Task / packet | Dependency | Effort hours | State |
|---|---|---|---|
| [FE-001 Design agreement and contract review](../handoff/FE-001.md) | C-001 | 0.5–1 | Planned |
| [FE-002 Build approved shell and stable mock states](../handoff/FE-002.md) | FE-001 | 1–2 | Planned |
| [FE-003 Build allowance setup and dashboards](../handoff/FE-003.md) | C-002 | 1–2 | Planned |
| [FE-004 Student purchase, parent review and status screens](../handoff/FE-004.md) | C-003 | 1.5–2.5 | Planned |
| [FE-005 Savings, My Money and weekly clock screens](../handoff/FE-005.md) | C-004 | 1–2 | Planned |
| [FE-006 Withdrawal and complete demo integration preparation](../handoff/FE-006.md) | FE-005 | 0.75–1.25 | Planned |

## Joint checkpoints

| Task / packet | Dependency | Effort hours | State |
|---|---|---|---|
| [C-001 Shared setup handoff](../handoff/C-001.md) | S-002 | 0.25 | Planned |
| [C-002 Finalize contracts after feasibility](../handoff/C-002.md) | B-004 and FE-002 | 0.25–0.5 | Planned |
| [C-003 Connect identity and allowance funding](../handoff/C-003.md) | B-007 and FE-003 | 0.5–0.75 | Planned |
| [C-004 Connect photo purchase, approval and merchant claim](../handoff/C-004.md) | B-010 and FE-004 | 0.75–1 | Planned |
| [C-005 Connect weekly lifecycle, private funds and withdrawal](../handoff/C-005.md) | B-013 and FE-006 | 0.75–1 | Planned |
| [C-006 Submission and reproducible demo](../handoff/C-006.md) | C-005 | 1–1.5 | Planned |

## Shared-edit protocol

1. Before editing a shared file, announce the task, exact paths and intended interface change in the team's agreed channel/PR. The AI does not send messages on its own; the human developer coordinates.
2. The file owner acknowledges and names one editor and merge order. The other developer leaves those paths untouched until release; this temporary reservation is recorded in the task PR, not as a second status tracker.
3. That editor updates contracts/fixtures/tests/config together, obtains the other's review and merges the shared change first. Backend regenerates the lockfile using the agreed package manager; nobody hand-merges lockfile contents blindly.
4. The owner posts the merged commit and releases the reservation; the other developer syncs main before continuing affected work. Resolve any resulting conflicts together and rerun impacted checks.
5. Backend alone edits this plan and each checkpoint packet. Frontend provides its UI/test evidence through the checkpoint PR for backend inclusion. Each developer owns evidence edits in their own task packets. No automatic outside messaging or unsolicited posting is authorized.

## Git branches and merges

- Keep `main` runnable. Shared setup uses `setup/S-001`, then `setup/S-002`; merge each after its checks/review. Both tracks start from the C-001 base commit.
- Use one short-lived branch per task: `backend/B-001`, `frontend/FE-001`, and so on. Checkpoints may use `integration/C-003` to assemble and check coordinated changes before merging to `main`.
- At each task start, fetch and branch from the latest merged `main`. Commit small coherent changes. Do not edit another developer's active branch, rewrite shared history, force-push or resolve a conflict by blindly choosing one side.
- Completed task branches merge through a reviewed PR after relevant checks. The other developer reviews; backend coordinates root/shared files and status updates. Merge completed tasks promptly rather than waiting until the whole track ends. A passing mock-only screen may merge in its labeled development mode; it must not replace an available real integration in the submission configuration.
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

Original F task files are compatibility links only. Product IDs F-001–F-008 are unchanged. Current plan has 27 active packets, including shared tasks and checkpoints.

| Planning item | State | Evidence |
|---|---|---|
| SETUP-001 Workflow/source import | Done | Original setup record, 2026-11-05 |
| PLAN-001 Concept | Done | DEC-029 |
| PLAN-002 Product spec | Draft ready | Proposed defaults still need relevant decisions |
| PLAN-003 Technical scope | Draft ready | Architecture/contracts; EV-025 local imports only |
| PLAN-004 Plan/packets | Revised draft ready | DEC-032–DEC-033; document checks, no build executed |
