# PadalaPocket

PadalaPocket is in MVP implementation. The current target is the [five-hour submission build](docs/implementation-plan.md#five-hour-submission-build--dec-055), with [reduced scope](docs/product-spec.md#five-hour-submission-mvp) under DEC-055.
The founder subsequently authorized [connected-function delivery](docs/implementation-plan.md#connected-function-delivery--dec-070). L-001 adds saved family rules and private Needs activity/photo views on the existing stack; later stages cover approvals, backed wallets, weekly lifecycle and withdrawal. Consult the plan for actual acceptance status.
The focused MVP concept is accepted; specifications distinguish team decisions from proposals and unverified technical claims.

Start with [the playbook](Playbook.md). Agents must first read [AGENTS.md](AGENTS.md) and [routing](AGENT_ROUTING.md).

## Develop the idea

1. Read [the idea](seed/idea.md) and [constraints](seed/context.md).
2. Work through [open questions](work/problem-capture.md), one topic at a time.
3. Build [the market comparison](seed/market.md) with [supporting evidence](work/evidence-ledger.md).
4. Record important choices in [the decision ledger](docs/decision-ledger.md).
5. Review the [MVP product spec](docs/product-spec.md) and [shared technical spec](docs/technical-spec.md).

Interviews are not required. Unknowns and assumptions may remain explicit. The team chooses when the concept is concrete enough to specify.

## Build

The [architecture](docs/architecture.md) owns the working stack and component diagram; the [technical spec](docs/technical-spec.md) owns proposed API/data contracts and integration checks. Review them together, confirm [design ownership](docs/design-brief.md), then use [the implementation plan](docs/implementation-plan.md) and [task template](handoff/TASK-000-template.md).
S-001, S-002 and C-001 are accepted; see the implementation plan for canonical status. See [development setup](docs/development.md) for install, run and check commands. A mock frontend shell is merged; the real product journey remains to implement. B-001 adds a protected Testnet proof experiment using direct Noir submission and a separate Velo checkout/status role under DEC-042; the earlier Gas attempt is preserved. SDK versions remain pinned with a scoped axios security override under DEC-043. See [proof instructions](docs/development.md#b-001-operator-proof) and [actual integration evidence and limitations](handoff/B-001.md).

B-002 adds a local isolated cap-exception experiment under DEC-044; see [its packet](handoff/B-002.md) for results and security limits. Money mapping and bucket topology are accepted under DEC-049; the reduced release uses Needs only.

## Guides and agent skills

[Guides](guides/README.md) are included as repository documents. [Skill setup](guides/agent-skills.md) explains the difference and how to reuse or install optional agent skills.

## Source material

The [original idea document](seed/sources/PadalaPocket_Hackathon_Idea.docx) is preserved alongside an [extracted text copy](seed/sources/padalapocket-original.md). Its statistics, deployment IDs, SDK claims, and event requirements need verification before use as current facts.

Read the [extracted competition builder handbook](seed/sources/velo-noir-builder-handbook.md) for the full supplied rules, examples and required README format. Its [original DOCX](seed/sources/velo-noir-builder-handbook.docx) is preserved; [context](seed/context.md) records current implications and evidence boundaries.

B-003 investigates wallet backing and escrow withdrawal; [its packet](handoff/B-003.md) records actual results and open acceptance items. [The technical spec](docs/technical-spec.md#b-003-money-mapping-and-backing-proof) defines the fixed simulated PHP/Testnet-XLM mapping and proposed rounding/reserve treatment.

R-001 identity setup: see [released contract](docs/technical-spec.md#r-001-released-identity-and-persistence-contract--dec-057) and [verification evidence](handoff/R-001.md). Provisioning credentials stay in ignored `.env.local` / `.env.r001-accounts.json`; only publishable configuration reaches the browser.

R-002 funding uses the [frozen funding contract](docs/technical-spec.md#r-002-frozen-funding-contract--dec-058); progress and observed results belong in [R-002](handoff/R-002.md).

Interrupted funding setup closure is disabled under DEC-060. See the [R-002 investigation limits](handoff/R-002.md#manual-recovery-for-interrupted-setup--dec-059); operations stay blocked.

The DEC-061 purchase slice uses versioned [server rules](apps/api/src/purchase-rules.mjs); its current API contract is in docs/technical-spec.md. Provider/payment behavior requires deployed verification.

## Manual allowance distribution — DEC-075 / L-003A

The parent-only `/api/allowance-funding` route reads saved family rules and distributes the configured total between separate parent-owned Needs and Wants Noir escrows. POST accepts `{expectedRevision}` with a UUID Idempotency-Key; stale rules reject before dispatch. The existing needs_funding journal stores Needs principal in amount_stroops, Wants in wants_stroops, total_stroops and immutable signed steps for each bucket. A global unresolved-operation index serializes shared-owner funding. Full ledger confirmation is required before either share becomes available. Partial/unknown allocations stay unavailable and block further money operations; no automatic replacement or recovery is enabled. Existing Needs deposits remain credited. The student sees confirmed Needs and funded Wants; Wants spending, Savings, My Money and weekly automation remain separate unfinished work. Manual distribution is limited to the provisioned one-student family demo.

## Velo parent top-ups — DEC-076 / L-006

Parent Deposit uses authenticated GET/POST `/api/velo-topups`. POST binds UUID Idempotency-Key and expectedRevision to the saved allowance amount, stores a server-only journal before one Velo checkout create call, and reads PaymentIntent state server-side. Only native Testnet checkout amounts and receiving wallet matching the configured parent owner are accepted. Incorrect receivers show configuration_required with no payment link; a fresh checkout can be created after selecting a Velo project owned by the parent wallet. Unknown creation never automatically repeats. No callback or local database row credits balances. Checkout deposits actual wallet funds; a separate explicit Noir allocation action distributes from that wallet. Signing and Velo API keys remain server-only. Velo checkouts pay the project owner's wallet (DEC-077). Use a Velo project owned by the existing parent Testnet wallet displayed in Deposit, and set its API key as server-only VELO_API_KEY. Do not replace OWNER_SECRET or expose it to this checkout. There is no separate receiving-wallet override in the installed SDK. Existing Velo sessions retain their original receiver, so create a new session after correction. Production deployment and a paid top-up require separate observed evidence.

DEC-078 permits a bounded operator recovery of the activation-rejected Velo session with the identical saved checkout amount and idempotency/correlation key. No new request identity or Stellar payment is submitted. Normal API unknown-session recreation remains disabled. Old configuration-mismatched history remains read-only and does not block a correctly configured checkout after API key replacement.
