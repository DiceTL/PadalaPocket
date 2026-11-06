# PadalaPocket

A planning workspace for developing the PadalaPocket idea before implementing an MVP.
The focused MVP concept is accepted; specifications distinguish team decisions from proposals and unverified technical claims.

Start with [the playbook](Playbook.md). Agents must first read [AGENTS.md](AGENTS.md) and [routing](AGENT_ROUTING.md).

## Develop the idea

1. Read [the idea](seed/idea.md) and [constraints](seed/context.md).
2. Work through [open questions](work/problem-capture.md), one topic at a time.
3. Build [the market comparison](seed/market.md) with [supporting evidence](work/evidence-ledger.md).
4. Record important choices in [the decision ledger](docs/decision-ledger.md).
5. Review the [MVP product spec](docs/product-spec.md) and [shared technical spec](docs/technical-spec.md).

Interviews are not required. Unknowns and assumptions may remain explicit. The team chooses when the concept is concrete enough to specify.

## Build later

The [architecture](docs/architecture.md) owns the working stack and component diagram; the [technical spec](docs/technical-spec.md) owns proposed API/data contracts and integration checks. Review them together, confirm [design ownership](docs/design-brief.md), then use [the implementation plan](docs/implementation-plan.md) and [task template](handoff/TASK-000-template.md).
S-001, S-002 and C-001 are accepted; see the implementation plan for canonical status. See [development setup](docs/development.md) for install, run and check commands. Product UI is not implemented. B-001 adds a protected Testnet proof experiment using direct Noir submission and a separate Velo checkout/status role under DEC-042; the earlier Gas attempt is preserved. SDK versions remain pinned with a scoped axios security override under DEC-043. See [proof instructions](docs/development.md#b-001-operator-proof) and [actual integration evidence and limitations](handoff/B-001.md).

B-002 adds a local isolated cap-exception experiment under DEC-044; see [its packet](handoff/B-002.md) for results and security limits. Product currency and wallet topology remain undecided.

## Guides and agent skills

[Guides](guides/README.md) are included as repository documents. [Skill setup](guides/agent-skills.md) explains the difference and how to reuse or install optional agent skills.

## Source material

The [original idea document](seed/sources/PadalaPocket_Hackathon_Idea.docx) is preserved alongside an [extracted text copy](seed/sources/padalapocket-original.md). Its statistics, deployment IDs, SDK claims, and event requirements need verification before use as current facts.

Read the [extracted competition builder handbook](seed/sources/velo-noir-builder-handbook.md) for the full supplied rules, examples and required README format. Its [original DOCX](seed/sources/velo-noir-builder-handbook.docx) is preserved; [context](seed/context.md) records current implications and evidence boundaries.
